import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    sendTrialEndingWarning,
    sendDisableConfirmation,
    sendDeletionWarning,
    sendDeletionConfirmation,
} from '@/lib/resend'

const DAY_MS = 24 * 60 * 60 * 1000
const WARNING_DAYS = 75 // 15 days before the 90-day disable cutoff
const DISABLE_DAYS = 90
const DELETION_WARNING_DAYS = 255 // 15 days before the 270-day delete cutoff
const DELETION_DAYS = 270

type Org = {
    id: string
    name: string
    owner_id: string
    status: string
    trial_started_at: string | null
    trial_warning_sent_at: string | null
    deletion_warning_sent_at: string | null
}

type Results = { warned: number; disabled: number; deletionWarned: number; deleted: number }

function daysSince(dateStr: string): number {
    return (Date.now() - new Date(dateStr).getTime()) / DAY_MS
}

function extractStoragePath(publicUrl: string): string | null {
    const marker = '/object/public/videos/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(publicUrl.slice(idx + marker.length))
}

async function ownerEmail(supabase: ReturnType<typeof createAdminClient>, ownerId: string): Promise<string | null> {
    const { data, error } = await supabase.auth.admin.getUserById(ownerId)
    if (error) throw new Error(`Failed to look up owner ${ownerId}: ${error.message}`)
    return data?.user?.email ?? null
}

async function updateOrg(
    supabase: ReturnType<typeof createAdminClient>,
    orgId: string,
    updates: Record<string, unknown>
) {
    const { error } = await supabase.from('organisations').update(updates).eq('id', orgId)
    if (error) throw new Error(`Failed to update org ${orgId}: ${error.message}`)
}

// Advances a single org through at most one lifecycle stage. Every failure
// throws so the caller can attribute it to this org rather than letting it
// abort the whole run or pass unnoticed.
async function processOrg(
    supabase: ReturnType<typeof createAdminClient>,
    org: Org,
    results: Results
): Promise<void> {
    if (!org.trial_started_at) {
        throw new Error(`Org ${org.id} has no trial_started_at — cannot evaluate lifecycle stage`)
    }
    const elapsed = daysSince(org.trial_started_at)

    // Stage 1: trial-ending warning, ~15 days before disable
    if (org.status === 'active' && elapsed >= WARNING_DAYS && elapsed < DISABLE_DAYS && !org.trial_warning_sent_at) {
        const email = await ownerEmail(supabase, org.owner_id)
        if (!email) return
        await sendTrialEndingWarning(email, org.name)
        await updateOrg(supabase, org.id, { trial_warning_sent_at: new Date().toISOString() })
        results.warned++
        return
    }

    // Stage 2: disable at day 90
    if (org.status === 'active' && elapsed >= DISABLE_DAYS) {
        const email = await ownerEmail(supabase, org.owner_id)
        await updateOrg(supabase, org.id, { status: 'disabled' })
        results.disabled++
        if (email) await sendDisableConfirmation(email, org.name)
        return
    }

    // Stage 3: final deletion warning, ~15 days before delete
    if (
        org.status === 'disabled' &&
        elapsed >= DELETION_WARNING_DAYS &&
        elapsed < DELETION_DAYS &&
        !org.deletion_warning_sent_at
    ) {
        const email = await ownerEmail(supabase, org.owner_id)
        if (!email) return
        await sendDeletionWarning(email, org.name)
        await updateOrg(supabase, org.id, { deletion_warning_sent_at: new Date().toISOString() })
        results.deletionWarned++
        return
    }

    // Stage 4: hard delete at day 270
    if (org.status === 'disabled' && elapsed >= DELETION_DAYS) {
        const email = await ownerEmail(supabase, org.owner_id)

        const { data: screens, error: screensError } = await supabase.from('screens').select('slides').eq('org_id', org.id)
        if (screensError) throw new Error(`Failed to load screens for org ${org.id}: ${screensError.message}`)

        const storagePaths = (screens ?? [])
            .flatMap((s) => (Array.isArray(s.slides) ? s.slides : []))
            .filter((slide: { type: string }) => slide.type === 'video')
            .map((slide: { url: string }) => extractStoragePath(slide.url))
            .filter((p): p is string => p !== null)

        if (storagePaths.length > 0) {
            const { error: removeError } = await supabase.storage.from('videos').remove(storagePaths)
            // Orphaned files are a billing/cleanup problem, not a reason to
            // keep the account alive — record it and carry on with deletion
            if (removeError) {
                console.error(`Failed to delete stored videos for org ${org.id}:`, removeError)
            }
        }

        const { error: screenDeleteError } = await supabase.from('screens').delete().eq('org_id', org.id)
        if (screenDeleteError) throw new Error(`Failed to delete screens for org ${org.id}: ${screenDeleteError.message}`)

        const { error: orgDeleteError } = await supabase.from('organisations').delete().eq('id', org.id)
        if (orgDeleteError) throw new Error(`Failed to delete org ${org.id}: ${orgDeleteError.message}`)

        // Deleting the auth account too — otherwise the next dashboard
        // load would silently auto-create a brand-new free org via the
        // existing fallback logic, trivially bypassing the deletion
        const { error: userDeleteError } = await supabase.auth.admin.deleteUser(org.owner_id)
        if (userDeleteError) {
            throw new Error(`Failed to delete auth user ${org.owner_id}: ${userDeleteError.message}`)
        }

        results.deleted++
        if (email) await sendDeletionConfirmation(email, org.name)
    }
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results: Results = { warned: 0, disabled: 0, deletionWarned: 0, deleted: 0 }

    const { data: freeOrgs, error: fetchError } = await supabase
        .from('organisations')
        .select('id, name, owner_id, status, trial_started_at, trial_warning_sent_at, deletion_warning_sent_at')
        .eq('plan', 'free')

    // Previously an unreadable table looked exactly like "nothing to do"
    if (fetchError) {
        console.error('Lifecycle cron failed to list free orgs:', fetchError)
        return NextResponse.json({ error: `Failed to list free orgs: ${fetchError.message}` }, { status: 500 })
    }

    // One org's failure (a bounced email, a storage hiccup) used to abort
    // the whole run and leave every later org unprocessed until the next
    // day — isolate them and report which ones failed.
    const failures: { orgId: string; error: string }[] = []
    for (const org of (freeOrgs ?? []) as Org[]) {
        try {
            await processOrg(supabase, org, results)
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            console.error(`Lifecycle processing failed for org ${org.id}:`, err)
            failures.push({ orgId: org.id, error: message })
        }
    }

    // A partial run is a failure the caller (Vercel Cron) should see
    return NextResponse.json(
        { ok: failures.length === 0, ...results, failures },
        { status: failures.length === 0 ? 200 : 500 }
    )
}

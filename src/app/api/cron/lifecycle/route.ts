import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    sendTrialEndingWarning,
    sendDisableConfirmation,
    sendDeletionWarning,
    sendDeletionConfirmation,
} from '@/lib/resend'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DAY_MS = 24 * 60 * 60 * 1000
const WARNING_DAYS = 75 // 15 days before the 90-day disable cutoff
const DISABLE_DAYS = 90
const DELETION_WARNING_DAYS = 255 // 15 days before the 270-day delete cutoff
const DELETION_DAYS = 270
// Both destructive transitions require their warning email to have actually
// been delivered this many days earlier. Without this, a cron outage (or
// email delivery being switched off entirely) silently turns the state
// machine into "disable and delete with no notice".
const WARNING_GRACE_DAYS = 14
const PAGE_SIZE = 200
const STORAGE_PAGE_SIZE = 100

type Org = {
    id: string
    name: string
    owner_id: string
    status: string
    trial_started_at: string
    trial_warning_sent_at: string | null
    deletion_warning_sent_at: string | null
}

function daysSince(dateStr: string): number {
    return (Date.now() - new Date(dateStr).getTime()) / DAY_MS
}

function warningCleared(sentAt: string | null): boolean {
    return sentAt !== null && daysSince(sentAt) >= WARNING_GRACE_DAYS
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET
    // Without the fallback check, a missing CRON_SECRET makes the expected
    // header the guessable literal `Bearer undefined`.
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results = { warned: 0, disabled: 0, deletionWarned: 0, deleted: 0, skipped: 0, failed: 0 }

    // Only orgs old enough to be in some stage of the lifecycle, paged so
    // the run isn't silently truncated by PostgREST's default row cap.
    const eligibleBefore = new Date(Date.now() - WARNING_DAYS * DAY_MS).toISOString()

    for (let page = 0; ; page++) {
        const { data: freeOrgs, error } = await supabase
            .from('organisations')
            .select('id, name, owner_id, status, trial_started_at, trial_warning_sent_at, deletion_warning_sent_at')
            .eq('plan', 'free')
            .lt('trial_started_at', eligibleBefore)
            .order('trial_started_at', { ascending: true })
            .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        if (error) {
            console.error('Lifecycle cron: failed to list free orgs:', error)
            return NextResponse.json({ error: 'Failed to list organisations' }, { status: 500 })
        }

        for (const org of (freeOrgs ?? []) as Org[]) {
            try {
                await processOrg(supabase, org, results)
            } catch (err) {
                // One org's failure must not skip every org after it
                results.failed++
                console.error(`Lifecycle cron: org ${org.id} failed:`, err)
            }
        }

        if (!freeOrgs || freeOrgs.length < PAGE_SIZE) break
    }

    console.log('Lifecycle cron run:', results)
    return NextResponse.json({ ok: true, ...results })
}

type Results = { warned: number; disabled: number; deletionWarned: number; deleted: number; skipped: number; failed: number }
type Admin = ReturnType<typeof createAdminClient>

async function processOrg(supabase: Admin, org: Org, results: Results) {
    const elapsed = daysSince(org.trial_started_at)

    // Every signup auto-creates a personal org, so a user invited into
    // someone else's org also owns an unused one. Expiring that shadow org
    // would delete their auth account and cascade them out of the org they
    // were invited to manage, so those are left alone entirely.
    const { data: memberships, error: membershipError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', org.owner_id)
    if (membershipError) throw membershipError
    if (memberships && memberships.length > 0) {
        results.skipped++
        return
    }

    const ownerEmail = await getOwnerEmail(supabase, org.owner_id)

    // Stage 1: trial-ending warning. No upper bound on elapsed — if the
    // cron missed the 75-89 day window, the warning still goes out (late)
    // rather than being skipped on the way to a silent disable.
    if (org.status === 'active' && !org.trial_warning_sent_at) {
        if (!ownerEmail) {
            results.skipped++
            return
        }
        const sent = await warn(
            supabase,
            org,
            'trial_warning_sent_at',
            () => sendTrialEndingWarning(ownerEmail, org.name, Math.max(0, Math.ceil(DISABLE_DAYS - elapsed)))
        )
        if (sent) results.warned++
        else results.skipped++
        return
    }

    // Stage 2: disable, once warned and the notice period has actually passed
    if (org.status === 'active' && elapsed >= DISABLE_DAYS && warningCleared(org.trial_warning_sent_at)) {
        if (!(await update(supabase, org, { status: 'disabled' }))) {
            results.skipped++
            return
        }
        if (ownerEmail) await sendDisableConfirmation(ownerEmail, org.name)
        results.disabled++
        return
    }

    // Stage 3: final deletion warning
    if (org.status === 'disabled' && elapsed >= DELETION_WARNING_DAYS && !org.deletion_warning_sent_at) {
        if (!ownerEmail) {
            results.skipped++
            return
        }
        const sent = await warn(
            supabase,
            org,
            'deletion_warning_sent_at',
            () => sendDeletionWarning(ownerEmail, org.name, Math.max(0, Math.ceil(DELETION_DAYS - elapsed)))
        )
        if (sent) results.deletionWarned++
        else results.skipped++
        return
    }

    // Stage 4: hard delete
    if (org.status === 'disabled' && elapsed >= DELETION_DAYS && warningCleared(org.deletion_warning_sent_at)) {
        await deleteOrg(supabase, org, ownerEmail)
        results.deleted++
        return
    }

    results.skipped++
}

// Records the warning before sending it, so two overlapping runs can't both
// email the same owner, then rolls the timestamp back if delivery fails —
// otherwise a failed send would still satisfy the disable/delete gate.
async function warn(
    supabase: Admin,
    org: Org,
    column: 'trial_warning_sent_at' | 'deletion_warning_sent_at',
    send: () => Promise<unknown>
): Promise<boolean> {
    const { data, error } = await supabase
        .from('organisations')
        .update({ [column]: new Date().toISOString() })
        .eq('id', org.id)
        .eq('plan', 'free')
        .eq('status', org.status)
        .is(column, null)
        .select('id')
    if (error) throw error
    if ((data?.length ?? 0) === 0) return false

    try {
        await send()
    } catch (err) {
        await update(supabase, org, { [column]: null })
        throw err
    }
    return true
}

async function getOwnerEmail(supabase: Admin, ownerId: string): Promise<string | null> {
    const { data, error } = await supabase.auth.admin.getUserById(ownerId)
    if (error) throw error
    return data?.user?.email ?? null
}

// Compare-and-set: the org must still be free and in the state it was in
// when it was read, so a Stripe webhook that upgraded it mid-run isn't
// overwritten by a stale decision.
async function update(supabase: Admin, org: Org, values: Record<string, unknown>) {
    const { data, error } = await supabase
        .from('organisations')
        .update(values)
        .eq('id', org.id)
        .eq('plan', 'free')
        .eq('status', org.status)
        .select('id')
    if (error) throw error
    return (data?.length ?? 0) > 0
}

async function deleteOrg(supabase: Admin, org: Org, ownerEmail: string | null) {
    // Claim the org first, so an upgrade landing mid-deletion means we
    // abort before anything irreversible happens.
    const claimed = await update(supabase, org, { deletion_warning_sent_at: org.deletion_warning_sent_at })
    if (!claimed) throw new Error(`org ${org.id} changed plan/status before deletion — aborting`)

    // Every upload path is `${orgId}/...`, so removing the whole prefix
    // catches design-slide images too, not just `type: 'video'` slides.
    const paths = await listStoragePaths(supabase, org.id)
    if (paths.length > 0) {
        const { error } = await supabase.storage.from('videos').remove(paths)
        if (error) throw error
    }

    const { error: screensError } = await supabase.from('screens').delete().eq('org_id', org.id)
    if (screensError) throw screensError

    const { error: orgError } = await supabase.from('organisations').delete().eq('id', org.id)
    if (orgError) throw orgError

    // Deleting the auth account too — otherwise the next dashboard load
    // would silently auto-create a brand-new free org via the existing
    // fallback logic, trivially bypassing the deletion
    const { error: userError } = await supabase.auth.admin.deleteUser(org.owner_id)
    if (userError) throw userError

    if (ownerEmail) await sendDeletionConfirmation(ownerEmail, org.name)
}

async function listStoragePaths(supabase: Admin, prefix: string): Promise<string[]> {
    const paths: string[] = []

    for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
        const { data: entries, error } = await supabase.storage
            .from('videos')
            .list(prefix, { limit: STORAGE_PAGE_SIZE, offset })
        if (error) throw error
        if (!entries || entries.length === 0) break

        for (const entry of entries) {
            const path = `${prefix}/${entry.name}`
            // Storage returns folders as synthetic rows with no object id
            if (entry.id === null) {
                paths.push(...(await listStoragePaths(supabase, path)))
            } else {
                paths.push(path)
            }
        }

        if (entries.length < STORAGE_PAGE_SIZE) break
    }

    return paths
}

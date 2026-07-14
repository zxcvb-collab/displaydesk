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

function daysSince(dateStr: string): number {
    return (Date.now() - new Date(dateStr).getTime()) / DAY_MS
}

function extractStoragePath(publicUrl: string): string | null {
    const marker = '/object/public/videos/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(publicUrl.slice(idx + marker.length))
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const results = { warned: 0, disabled: 0, deletionWarned: 0, deleted: 0 }

    const { data: freeOrgs } = await supabase
        .from('organisations')
        .select('id, name, owner_id, status, trial_started_at, trial_warning_sent_at, deletion_warning_sent_at')
        .eq('plan', 'free')

    for (const org of freeOrgs ?? []) {
        const elapsed = daysSince(org.trial_started_at)

        // Stage 1: trial-ending warning, ~15 days before disable
        if (org.status === 'active' && elapsed >= WARNING_DAYS && elapsed < DISABLE_DAYS && !org.trial_warning_sent_at) {
            const { data: userData } = await supabase.auth.admin.getUserById(org.owner_id)
            if (userData?.user?.email) {
                await sendTrialEndingWarning(userData.user.email, org.name)
                await supabase.from('organisations').update({ trial_warning_sent_at: new Date().toISOString() }).eq('id', org.id)
                results.warned++
            }
            continue
        }

        // Stage 2: disable at day 90
        if (org.status === 'active' && elapsed >= DISABLE_DAYS) {
            const { data: userData } = await supabase.auth.admin.getUserById(org.owner_id)
            await supabase.from('organisations').update({ status: 'disabled' }).eq('id', org.id)
            if (userData?.user?.email) {
                await sendDisableConfirmation(userData.user.email, org.name)
            }
            results.disabled++
            continue
        }

        // Stage 3: final deletion warning, ~15 days before delete
        if (
            org.status === 'disabled' &&
            elapsed >= DELETION_WARNING_DAYS &&
            elapsed < DELETION_DAYS &&
            !org.deletion_warning_sent_at
        ) {
            const { data: userData } = await supabase.auth.admin.getUserById(org.owner_id)
            if (userData?.user?.email) {
                await sendDeletionWarning(userData.user.email, org.name)
                await supabase.from('organisations').update({ deletion_warning_sent_at: new Date().toISOString() }).eq('id', org.id)
                results.deletionWarned++
            }
            continue
        }

        // Stage 4: hard delete at day 270
        if (org.status === 'disabled' && elapsed >= DELETION_DAYS) {
            const { data: userData } = await supabase.auth.admin.getUserById(org.owner_id)
            const ownerEmail = userData?.user?.email

            const { data: screens } = await supabase.from('screens').select('slides').eq('org_id', org.id)
            const storagePaths = (screens ?? [])
                .flatMap((s) => (Array.isArray(s.slides) ? s.slides : []))
                .filter((slide: { type: string }) => slide.type === 'video')
                .map((slide: { url: string }) => extractStoragePath(slide.url))
                .filter((p): p is string => p !== null)

            if (storagePaths.length > 0) {
                await supabase.storage.from('videos').remove(storagePaths)
            }
            await supabase.from('screens').delete().eq('org_id', org.id)
            await supabase.from('organisations').delete().eq('id', org.id)
            // Deleting the auth account too — otherwise the next dashboard
            // load would silently auto-create a brand-new free org via the
            // existing fallback logic, trivially bypassing the deletion
            await supabase.auth.admin.deleteUser(org.owner_id)

            if (ownerEmail) {
                await sendDeletionConfirmation(ownerEmail, org.name)
            }
            results.deleted++
        }
    }

    return NextResponse.json({ ok: true, ...results })
}

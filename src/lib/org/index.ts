import type { SupabaseClient } from '@supabase/supabase-js'
import { NO_ROWS } from '@/lib/supabase/errors'

export type OrgRole = 'owner' | 'member'

/**
 * Resolves which org a user belongs to and their role in it. Owners
 * created the org (billing, invites, danger-zone actions); members were
 * invited and get full day-to-day screen-management access but not
 * billing/team-management.
 *
 * Checks membership BEFORE ownership, deliberately. Every signup
 * auto-creates a personal org, so an invited member also owns their own
 * (empty, unused) org. Someone who accepted a staff invite wants to land
 * on the business they were invited to manage, not an empty personal org
 * they never intended to use — so membership wins when both exist. Their
 * personal org still exists in the background (and is still subject to
 * the free-trial lifecycle timer) but the dashboard won't surface it.
 *
 * Returns null only when the user genuinely has neither; a failed lookup
 * throws, so callers can't mistake a database error for "no org" (which
 * would otherwise auto-create a duplicate org on the dashboard).
 */
export async function resolveOrgId(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    userId: string
): Promise<{ orgId: string; role: OrgRole } | null> {
    const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .single()
    if (membershipError && membershipError.code !== NO_ROWS) {
        throw new Error(`Failed to look up org membership: ${membershipError.message}`)
    }
    if (membership) return { orgId: membership.org_id, role: 'member' }

    const { data: owned, error: ownedError } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', userId)
        .single()
    if (ownedError && ownedError.code !== NO_ROWS) {
        throw new Error(`Failed to look up owned org: ${ownedError.message}`)
    }
    if (owned) return { orgId: owned.id, role: 'owner' }

    return null
}

import type { SupabaseClient } from '@supabase/supabase-js'

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
 */
export async function resolveOrgId(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    userId: string
): Promise<{ orgId: string; role: OrgRole } | null> {
    const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .single()
    if (membership) return { orgId: membership.org_id, role: 'member' }

    const { data: owned } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', userId)
        .single()
    if (owned) return { orgId: owned.id, role: 'owner' }

    return null
}

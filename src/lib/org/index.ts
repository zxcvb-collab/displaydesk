import type { SupabaseClient } from '@supabase/supabase-js'

export type OrgRole = 'owner' | 'member'

/**
 * Resolves which org a user belongs to and their role in it. Owners
 * created the org (billing, invites, danger-zone actions); members were
 * invited and get full day-to-day screen-management access but not
 * billing/team-management.
 */
export async function resolveOrgId(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    userId: string
): Promise<{ orgId: string; role: OrgRole } | null> {
    const { data: owned } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', userId)
        .single()
    if (owned) return { orgId: owned.id, role: 'owner' }

    const { data: membership } = await supabase
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .single()
    if (membership) return { orgId: membership.org_id, role: 'member' }

    return null
}

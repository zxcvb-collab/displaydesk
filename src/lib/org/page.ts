import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/org'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Preamble for dashboard pages that operate on an active org: signs the
 * visitor in or bounces them to /login, and bounces disabled (expired free
 * trial) orgs to /dashboard, which owns the upgrade UI. `select` lists the
 * org columns the page needs on top of the id/status this checks itself.
 */
export async function requireActiveOrgPage<T extends { id: string; status: string } = { id: string; status: string }>(
    select = 'id, status'
): Promise<{ supabase: ServerClient; user: User; org: T }> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) redirect('/login')

    const { data } = await supabase
        .from('organisations')
        .select(select)
        .eq('id', resolved.orgId)
        .single()

    const org = data as T | null
    if (!org) redirect('/login')
    if (org.status === 'disabled') redirect('/dashboard')

    return { supabase, user, org }
}

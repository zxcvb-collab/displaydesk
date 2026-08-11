import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId, type OrgRole } from '@/lib/org'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Guard result: either the resolved context, or the error response the
 * route should return as-is. Keeps every route's auth/org preamble to
 * `const auth = await requireOrg(); if (!auth.ok) return auth.response`
 * instead of re-deriving the same 401/403/404 shapes each time.
 */
export type Guarded<T> = { ok: true; value: T } | { ok: false; response: NextResponse }

export function jsonError(message: string, status: number) {
    return NextResponse.json({ error: message }, { status })
}

export type UserContext = { supabase: ServerClient; user: User }
export type OrgContext = UserContext & { orgId: string; role: OrgRole }

export type OrgRecord = {
    id: string
    plan: string
    status: string
    stripe_subscription_id: string | null
}
export type OrgRecordContext = UserContext & { role: OrgRole; org: OrgRecord }

export async function requireUser(): Promise<Guarded<UserContext>> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, response: jsonError('Unauthorized', 401) }
    return { ok: true, value: { supabase, user } }
}

export async function requireOrg(options?: { ownerOnly?: string }): Promise<Guarded<OrgContext>> {
    const auth = await requireUser()
    if (!auth.ok) return auth

    const { supabase, user } = auth.value
    const resolved = await resolveOrgId(supabase, user.id)
    if (!resolved) return { ok: false, response: jsonError('No organisation found', 404) }
    if (options?.ownerOnly && resolved.role !== 'owner') {
        return { ok: false, response: jsonError(options.ownerOnly, 403) }
    }
    return { ok: true, value: { supabase, user, orgId: resolved.orgId, role: resolved.role } }
}

/**
 * Like `requireOrg`, but also loads the org's billing/lifecycle columns.
 * Mutating routes need their own lifecycle check since RLS is scoped to
 * ownership, not status — pass `allowDisabled` when the route wants to
 * handle a disabled org itself (e.g. redirect rather than 401).
 */
export async function requireOrgRecord(options?: { allowDisabled?: boolean }): Promise<Guarded<OrgRecordContext>> {
    const auth = await requireOrg()
    if (!auth.ok) return auth

    const { supabase, user, orgId, role } = auth.value
    const { data: org } = await supabase
        .from('organisations')
        .select('id, plan, status, stripe_subscription_id')
        .eq('id', orgId)
        .single()

    if (!org) return { ok: false, response: jsonError('No organisation found', 404) }
    if (org.status === 'disabled' && !options?.allowDisabled) {
        return { ok: false, response: jsonError('Unauthorized', 401) }
    }
    return { ok: true, value: { supabase, user, role, org: org as OrgRecord } }
}

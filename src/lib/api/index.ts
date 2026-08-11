import { NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { resolveOrgId, type OrgRole } from '@/lib/org'

type ServerClient = Awaited<ReturnType<typeof createClient>>

/**
 * Parses a JSON request body. A malformed body is a client error, but
 * `request.json()` throws, which Next.js surfaces as an opaque 500 — so
 * callers get a 400 with a usable message instead.
 */
export async function readJsonBody(
    request: Request
): Promise<{ body: Record<string, unknown> } | { response: NextResponse }> {
    try {
        const body = await request.json()
        if (body === null || typeof body !== 'object' || Array.isArray(body)) {
            return { response: NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 }) }
        }
        return { body: body as Record<string, unknown> }
    } catch {
        return { response: NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 }) }
    }
}

/**
 * Resolves the caller's user and org for a route handler. Distinguishes
 * the three failure modes that used to collapse into a bare 401/404: not
 * signed in, signed in without an org, and a backend lookup that failed
 * (which is a 503, not the user's fault).
 */
export async function requireOrgContext(
    supabase: ServerClient
): Promise<{ userId: string; orgId: string; role: OrgRole } | { response: NextResponse }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
        console.error('Auth lookup failed:', authError)
        return { response: NextResponse.json({ error: 'Could not verify your session' }, { status: 503 }) }
    }
    if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

    try {
        const resolved = await resolveOrgId(supabase, user.id)
        if (!resolved) return { response: NextResponse.json({ error: 'No organisation found' }, { status: 404 }) }
        return { userId: user.id, orgId: resolved.orgId, role: resolved.role }
    } catch (err) {
        console.error('Org resolution failed:', err)
        return { response: NextResponse.json({ error: 'Could not load your organisation' }, { status: 503 }) }
    }
}

/**
 * Defence-in-depth CSRF check for cookie-authenticated, state-changing
 * routes. Several of them are plain HTML form POSTs with no token, so the
 * only thing stopping a cross-site form submission today is Supabase's
 * SameSite=Lax session cookie. Rejecting requests whose Origin/Referer
 * belongs to another site stops relying on that alone.
 *
 * Requests without either header (e.g. server-to-server calls, or curl)
 * are allowed through — those aren't browser-driven CSRF.
 */
export function isSameOrigin(request: Request): boolean {
    // Behind a proxy (Vercel), the forwarded host is the one the browser
    // actually addressed, which is what Origin will reflect.
    const target =
        request.headers.get('x-forwarded-host') ??
        request.headers.get('host') ??
        new URL(request.url).host
    const stated = request.headers.get('origin') ?? request.headers.get('referer')
    if (!stated) return true
    try {
        return new URL(stated).host === target
    } catch {
        return false
    }
}

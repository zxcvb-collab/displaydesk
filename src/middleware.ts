import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { pathname } = request.nextUrl
    const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/reset-password'
    const isDashboardPage = pathname.startsWith('/dashboard') || pathname.startsWith('/screens')

    // An unreachable auth service throws here, which would otherwise take
    // down every matched route with an opaque 500 — protected pages fail
    // closed to /login, everything else renders as an anonymous visitor
    let user
    try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw new Error(error.message)
        user = data.user
    } catch (err) {
        console.error(`[middleware] auth lookup failed for ${pathname}:`, err)
        if (isDashboardPage) {
            const loginUrl = new URL('/login', request.url)
            loginUrl.searchParams.set('error', 'Could not verify your session — please log in again')
            return NextResponse.redirect(loginUrl)
        }
        return supabaseResponse
    }

    // Log every middleware call to terminal
    console.log(`[middleware] ${pathname} | user: ${user?.email ?? 'none'}`)

    if (!user && isDashboardPage) {
        console.log(`[middleware] → redirecting to /login`)
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user && isAuthPage) {
        console.log(`[middleware] → redirecting to /dashboard`)
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|auth|api|tv).*)',
    ],
}
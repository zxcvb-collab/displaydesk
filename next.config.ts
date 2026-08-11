import type { NextConfig } from "next";

// Supabase (auth, REST, storage) is contacted directly from the browser and
// its host is deployment-specific, so it has to come from env rather than
// being hardcoded into the policy.
const supabaseOrigin = (() => {
    try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
    } catch {
        return ''
    }
})()

// 'unsafe-inline'/'unsafe-eval' are required by Next's own inline bootstrap
// scripts and React refresh in development; the rest of the policy still
// removes the easy wins (no plugins, no <base> hijacking, no framing, and
// media/frames restricted to YouTube plus our own storage).
const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://img.youtube.com https://i.ytimg.com ${supabaseOrigin}`,
    `media-src 'self' blob: ${supabaseOrigin}`,
    `connect-src 'self' ${supabaseOrigin} https://img.youtube.com https://api.stripe.com`,
    "font-src 'self' data:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://js.stripe.com",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig: NextConfig = {
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }]
    },
};

export default nextConfig;

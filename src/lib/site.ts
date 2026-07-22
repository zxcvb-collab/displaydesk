// Central place for the canonical production URL and core marketing copy,
// reused by layout metadata, sitemap.ts, robots.ts, opengraph-image.tsx,
// and the landing page's structured data — keeps SEO facts in one spot.
const envUrl = process.env.NEXT_PUBLIC_SITE_URL
export const SITE_URL =
    envUrl && envUrl.startsWith('http') && !envUrl.includes('localhost')
        ? envUrl.replace(/\/$/, '')
        : 'https://displaydesk.vercel.app'

export const SITE_NAME = 'DisplayDesk'
export const SITE_TAGLINE = 'Digital menu boards & TV signage for restaurants and cafes'
export const SITE_DESCRIPTION =
    'DisplayDesk turns any TV into a digital menu board or signage screen in minutes. Build menus with a built-in design editor, upload video, or paste a YouTube link — no hardware, no YouTube ads, works offline. Free to start.'

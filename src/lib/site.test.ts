import { afterEach, describe, expect, it, vi } from 'vitest'

const FALLBACK_URL = 'https://displaydesk.vercel.app'

async function loadSiteWith(envUrl: string | undefined) {
    vi.resetModules()
    if (envUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else vi.stubEnv('NEXT_PUBLIC_SITE_URL', envUrl)
    return import('./site')
}

afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
})

describe('SITE_URL', () => {
    it('uses the configured url', async () => {
        const { SITE_URL } = await loadSiteWith('https://menus.example.com')
        expect(SITE_URL).toBe('https://menus.example.com')
    })

    it('strips a single trailing slash', async () => {
        const { SITE_URL } = await loadSiteWith('https://menus.example.com/')
        expect(SITE_URL).toBe('https://menus.example.com')
    })

    it('falls back when the url is unset, empty, or schemeless', async () => {
        for (const value of [undefined, '', 'menus.example.com']) {
            const { SITE_URL } = await loadSiteWith(value)
            expect(SITE_URL).toBe(FALLBACK_URL)
        }
    })

    it('falls back for localhost urls so SEO metadata never points at a dev host', async () => {
        const { SITE_URL } = await loadSiteWith('http://localhost:3000')
        expect(SITE_URL).toBe(FALLBACK_URL)
    })
})

describe('marketing copy', () => {
    it('exports non-empty name, tagline, and description', async () => {
        const site = await loadSiteWith(undefined)
        expect(site.SITE_NAME).toBe('DisplayDesk')
        expect(site.SITE_TAGLINE.length).toBeGreaterThan(0)
        expect(site.SITE_DESCRIPTION.length).toBeGreaterThan(0)
    })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ kind: 'js' }))
const createBrowserClient = vi.fn(() => ({ kind: 'browser' }))
const createServerClient = vi.fn(() => ({ kind: 'server' }))
const cookieStore = { getAll: vi.fn(() => [{ name: 'sb', value: 'token' }]), set: vi.fn() }
const cookies = vi.fn(async () => cookieStore)

vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('@supabase/ssr', () => ({ createBrowserClient, createServerClient }))
vi.mock('next/headers', () => ({ cookies }))

const URL = 'https://project.supabase.co'
const ANON_KEY = 'anon-key'
const SERVICE_KEY = 'service-key'

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL)
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY)
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)

const { createAdminClient } = await import('./admin')
const { createAnonClient } = await import('./anon')
const { createClient: createBrowser } = await import('./client')
const { createClient: createServer } = await import('./server')

beforeEach(() => {
    vi.clearAllMocks()
})

describe('createAdminClient', () => {
    it('uses the service-role key, not the anon key', () => {
        createAdminClient()
        expect(createClient).toHaveBeenCalledWith(URL, SERVICE_KEY)
    })
})

describe('createAnonClient', () => {
    it('uses the public anon key', () => {
        createAnonClient()
        expect(createClient).toHaveBeenCalledWith(URL, ANON_KEY)
    })
})

describe('browser createClient', () => {
    it('builds an ssr browser client with the anon key', () => {
        expect(createBrowser()).toEqual({ kind: 'browser' })
        expect(createBrowserClient).toHaveBeenCalledWith(URL, ANON_KEY)
    })
})

describe('server createClient', () => {
    type CookieToSet = { name: string; value: string; options: Record<string, unknown> }
    type CookieHandlers = {
        getAll: () => { name: string; value: string }[]
        setAll: (cookies: CookieToSet[]) => void
    }

    async function serverCookieHandlers(): Promise<CookieHandlers> {
        await createServer()
        const args = createServerClient.mock.calls[0] as unknown as [
            string,
            string,
            { cookies: CookieHandlers },
        ]
        return args[2].cookies
    }

    it('builds an ssr server client with the anon key and the request cookie store', async () => {
        expect(await createServer()).toEqual({ kind: 'server' })
        expect((createServerClient.mock.calls[0] as unknown[]).slice(0, 2)).toEqual([URL, ANON_KEY])
        expect(cookies).toHaveBeenCalled()
    })

    it('reads cookies from the request store', async () => {
        const handlers = await serverCookieHandlers()
        expect(handlers.getAll()).toEqual([{ name: 'sb', value: 'token' }])
    })

    it('writes every cookie back to the store', async () => {
        const handlers = await serverCookieHandlers()
        handlers.setAll([
            { name: 'a', value: '1', options: { path: '/' } },
            { name: 'b', value: '2', options: {} },
        ])
        expect(cookieStore.set).toHaveBeenCalledTimes(2)
        expect(cookieStore.set).toHaveBeenCalledWith('a', '1', { path: '/' })
    })

    // Server Components can't set cookies; the write is best-effort there.
    it('swallows the error when the store rejects writes', async () => {
        const handlers = await serverCookieHandlers()
        cookieStore.set.mockImplementationOnce(() => {
            throw new Error('Cookies can only be modified in a Server Action or Route Handler')
        })
        expect(() => handlers.setAll([{ name: 'a', value: '1', options: {} }])).not.toThrow()
    })
})

import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { resolveOrgId } from './index'

type Row = Record<string, unknown> | null

/**
 * Minimal stub of the query chain used by resolveOrgId
 * (`.from(table).select(...).eq(...).single()`), returning a per-table row.
 */
function stubSupabase(rows: { org_members?: Row; organisations?: Row }) {
    const eq = vi.fn()
    const from = vi.fn((table: 'org_members' | 'organisations') => ({
        select: () => ({
            eq: (column: string, value: string) => {
                eq(table, column, value)
                return { single: async () => ({ data: rows[table] ?? null, error: null }) }
            },
        }),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { client: { from } as unknown as SupabaseClient<any>, from, eq }
}

describe('resolveOrgId', () => {
    it('returns the membership org as a member', async () => {
        const { client, eq } = stubSupabase({ org_members: { org_id: 'org_invited' } })
        await expect(resolveOrgId(client, 'user_1')).resolves.toEqual({
            orgId: 'org_invited',
            role: 'member',
        })
        expect(eq).toHaveBeenCalledWith('org_members', 'user_id', 'user_1')
    })

    it('prefers membership over ownership when the user has both', async () => {
        const { client, from } = stubSupabase({
            org_members: { org_id: 'org_invited' },
            organisations: { id: 'org_personal' },
        })
        await expect(resolveOrgId(client, 'user_1')).resolves.toEqual({
            orgId: 'org_invited',
            role: 'member',
        })
        expect(from).not.toHaveBeenCalledWith('organisations')
    })

    it('falls back to the owned org as owner', async () => {
        const { client, eq } = stubSupabase({ organisations: { id: 'org_personal' } })
        await expect(resolveOrgId(client, 'user_1')).resolves.toEqual({
            orgId: 'org_personal',
            role: 'owner',
        })
        expect(eq).toHaveBeenCalledWith('organisations', 'owner_id', 'user_1')
    })

    it('returns null when the user neither belongs to nor owns an org', async () => {
        const { client } = stubSupabase({})
        await expect(resolveOrgId(client, 'user_1')).resolves.toBeNull()
    })
})

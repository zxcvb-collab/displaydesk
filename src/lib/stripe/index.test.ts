import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscriptions = { retrieve: vi.fn() }
const subscriptionItems = { create: vi.fn(), update: vi.fn(), del: vi.fn() }

vi.mock('stripe', () => ({
    default: class {
        subscriptions = subscriptions
        subscriptionItems = subscriptionItems
    },
}))

const {
    ADDON_PRICE_IDS,
    ADDON_PRICE_ID_TO_PLAN,
    PLAN_PRICE_IDS,
    PLAN_SCREEN_LIMITS,
    PRICE_ID_TO_PLAN,
    includedScreens,
    isPaidPlan,
    syncScreenAddon,
} = await import('./index')

function subscriptionWith(items: { id: string; priceId: string; quantity: number }[]) {
    return {
        items: { data: items.map((i) => ({ id: i.id, price: { id: i.priceId }, quantity: i.quantity })) },
    }
}

describe('plan price id maps', () => {
    it('inverts the plan price ids', () => {
        for (const [plan, priceId] of Object.entries(PLAN_PRICE_IDS)) {
            expect(PRICE_ID_TO_PLAN[priceId]).toBe(plan)
        }
        expect(Object.keys(PRICE_ID_TO_PLAN)).toHaveLength(Object.keys(PLAN_PRICE_IDS).length)
    })

    it('inverts the add-on price ids', () => {
        for (const [plan, priceId] of Object.entries(ADDON_PRICE_IDS)) {
            expect(ADDON_PRICE_ID_TO_PLAN[priceId]).toBe(plan)
        }
    })

    it('uses a distinct price id for every plan and add-on', () => {
        const ids = [...Object.values(PLAN_PRICE_IDS), ...Object.values(ADDON_PRICE_IDS)]
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('defines an add-on price for every paid plan', () => {
        expect(Object.keys(ADDON_PRICE_IDS).sort()).toEqual(Object.keys(PLAN_PRICE_IDS).sort())
    })
})

describe('isPaidPlan', () => {
    it('accepts the paid tiers', () => {
        expect(Object.keys(PLAN_PRICE_IDS).every(isPaidPlan)).toBe(true)
    })

    it('rejects free and unknown plans', () => {
        expect(isPaidPlan('free')).toBe(false)
        expect(isPaidPlan('')).toBe(false)
        expect(isPaidPlan('enterprise')).toBe(false)
    })
})

describe('includedScreens', () => {
    it('returns the limit for each known plan', () => {
        expect(includedScreens('free')).toBe(1)
        expect(includedScreens('starter')).toBe(2)
        expect(includedScreens('pro')).toBe(5)
        expect(includedScreens('business')).toBe(15)
    })

    it('falls back to the free limit for unknown plans', () => {
        expect(includedScreens('mystery')).toBe(PLAN_SCREEN_LIMITS.free)
        expect(includedScreens('')).toBe(PLAN_SCREEN_LIMITS.free)
    })

    it('gives every paid plan more screens than free', () => {
        for (const plan of Object.keys(PLAN_PRICE_IDS)) {
            expect(includedScreens(plan)).toBeGreaterThan(includedScreens('free'))
        }
    })
})

describe('syncScreenAddon', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does nothing when the screen count is within the plan and no add-on exists', async () => {
        subscriptions.retrieve.mockResolvedValue(subscriptionWith([]))
        await syncScreenAddon('sub_1', 'starter', 2)

        expect(subscriptions.retrieve).toHaveBeenCalledWith('sub_1')
        expect(subscriptionItems.create).not.toHaveBeenCalled()
        expect(subscriptionItems.update).not.toHaveBeenCalled()
        expect(subscriptionItems.del).not.toHaveBeenCalled()
    })

    it('removes the add-on item rather than setting it to quantity zero', async () => {
        subscriptions.retrieve.mockResolvedValue(
            subscriptionWith([{ id: 'si_1', priceId: ADDON_PRICE_IDS.starter, quantity: 3 }])
        )
        await syncScreenAddon('sub_1', 'starter', 1)

        expect(subscriptionItems.del).toHaveBeenCalledWith('si_1')
        expect(subscriptionItems.update).not.toHaveBeenCalled()
    })

    it('creates the add-on item for the extra screens beyond the plan', async () => {
        subscriptions.retrieve.mockResolvedValue(subscriptionWith([]))
        await syncScreenAddon('sub_1', 'pro', 8)

        expect(subscriptionItems.create).toHaveBeenCalledWith({
            subscription: 'sub_1',
            price: ADDON_PRICE_IDS.pro,
            quantity: 3,
        })
    })

    it('updates an existing add-on item when the extra count changed', async () => {
        subscriptions.retrieve.mockResolvedValue(
            subscriptionWith([{ id: 'si_1', priceId: ADDON_PRICE_IDS.pro, quantity: 1 }])
        )
        await syncScreenAddon('sub_1', 'pro', 9)

        expect(subscriptionItems.update).toHaveBeenCalledWith('si_1', { quantity: 4 })
        expect(subscriptionItems.create).not.toHaveBeenCalled()
    })

    it('leaves an add-on item alone when the quantity already matches', async () => {
        subscriptions.retrieve.mockResolvedValue(
            subscriptionWith([{ id: 'si_1', priceId: ADDON_PRICE_IDS.business, quantity: 2 }])
        )
        await syncScreenAddon('sub_1', 'business', 17)

        expect(subscriptionItems.update).not.toHaveBeenCalled()
        expect(subscriptionItems.create).not.toHaveBeenCalled()
        expect(subscriptionItems.del).not.toHaveBeenCalled()
    })

    it('ignores line items for other prices, including another tier add-on', async () => {
        subscriptions.retrieve.mockResolvedValue(
            subscriptionWith([
                { id: 'si_base', priceId: PLAN_PRICE_IDS.pro, quantity: 1 },
                { id: 'si_other', priceId: ADDON_PRICE_IDS.starter, quantity: 5 },
            ])
        )
        await syncScreenAddon('sub_1', 'pro', 6)

        expect(subscriptionItems.create).toHaveBeenCalledWith({
            subscription: 'sub_1',
            price: ADDON_PRICE_IDS.pro,
            quantity: 1,
        })
        expect(subscriptionItems.del).not.toHaveBeenCalled()
    })
})

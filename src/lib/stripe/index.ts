import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PLAN_PRICE_IDS = {
    starter: 'price_1ToaxC0IIn3DetD8MnxR1Sou',
    pro: 'price_1ToaxP0IIn3DetD89GJgfdiv',
    business: 'price_1Toaxb0IIn3DetD8KlSRK0Fv',
} as const

export type PaidPlan = keyof typeof PLAN_PRICE_IDS

export const PRICE_ID_TO_PLAN: Record<string, PaidPlan> = Object.fromEntries(
    Object.entries(PLAN_PRICE_IDS).map(([plan, priceId]) => [priceId, plan])
) as Record<string, PaidPlan>

export function isPaidPlan(plan: string): plan is PaidPlan {
    return plan in PLAN_PRICE_IDS
}

// Additional-screen add-on prices, one per paid tier (billed per extra
// screen beyond the tier's included count). Free tier has no add-on -
// it's hard-capped at 1 screen, no path to buy more without upgrading.
export const ADDON_PRICE_IDS: Record<PaidPlan, string> = {
    starter: 'price_1TuLF00IIn3DetD8KSMc4926',
    pro: 'price_1TuLF10IIn3DetD8xxBUT8Q1',
    business: 'price_1TuLF10IIn3DetD811Fpje1I',
}

export const ADDON_PRICE_ID_TO_PLAN: Record<string, PaidPlan> = Object.fromEntries(
    Object.entries(ADDON_PRICE_IDS).map(([plan, priceId]) => [priceId, plan])
) as Record<string, PaidPlan>

// Included screens per plan - single source of truth, was previously
// duplicated as inline ternaries in the dashboard and API routes.
export const PLAN_SCREEN_LIMITS: Record<string, number> = {
    free: 1,
    starter: 2,
    pro: 5,
    business: 15,
}

export function includedScreens(plan: string): number {
    return PLAN_SCREEN_LIMITS[plan] ?? PLAN_SCREEN_LIMITS.free
}

/**
 * Syncs the org's Stripe subscription add-on line item to match the
 * number of screens beyond the plan's included count. Adds, updates, or
 * removes the add-on item as needed - Stripe doesn't allow a licensed
 * price item to sit at quantity 0, so "no extra screens" means removing
 * the item entirely rather than setting it to zero.
 */
export async function syncScreenAddon(subscriptionId: string, plan: PaidPlan, screenCount: number) {
    const extra = Math.max(0, screenCount - includedScreens(plan))
    const addonPriceId = ADDON_PRICE_IDS[plan]

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const existingItem = subscription.items.data.find((item) => item.price.id === addonPriceId)

    if (extra === 0) {
        if (existingItem) {
            await stripe.subscriptionItems.del(existingItem.id)
        }
        return
    }

    if (existingItem) {
        if (existingItem.quantity !== extra) {
            await stripe.subscriptionItems.update(existingItem.id, { quantity: extra })
        }
    } else {
        await stripe.subscriptionItems.create({
            subscription: subscriptionId,
            price: addonPriceId,
            quantity: extra,
        })
    }
}

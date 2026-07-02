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

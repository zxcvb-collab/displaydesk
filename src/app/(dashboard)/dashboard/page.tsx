import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import OrgScheduleSettings from './org-schedule-settings'

export const dynamic = 'force-dynamic'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2x the TV's 60s poll interval, plus buffer

function getScreenStatus(lastSeenAt: string | null): 'online' | 'offline' | 'never' {
    if (!lastSeenAt) return 'never'
    return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS ? 'online' : 'offline'
}

function formatTimeAgo(dateStr: string): string {
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    let { data: org, error: orgError } = await supabase
        .from('organisations')
        .select('*')
        .eq('owner_id', user.id)
        .single()

    if (orgError && orgError.code !== 'PGRST116') {
        console.error('Dashboard org fetch error:', orgError)
        throw new Error(`Failed to fetch organisation: ${orgError.code} - ${orgError.message}`)
    }

    if (!org) {
        const businessName = user.user_metadata?.business_name || 'My Business'
        const { data: newOrg, error: insertError } = await supabase
            .from('organisations')
            .insert({ owner_id: user.id, name: businessName, plan: 'free' })
            .select('*')
            .single()

        if (insertError) {
            console.error('Failed to create organisation:', insertError)
            throw new Error(`Failed to create organisation: ${insertError.message}`)
        }
        org = newOrg
    }

    const { data: screens } = await supabase
        .from('screens')
        .select('*')
        .eq('org_id', org.id)
        .order('created_at', { ascending: true })

    const screenList = screens ?? []
    const planLimit = org.plan === 'free' ? 1 : org.plan === 'starter' ? 2 : org.plan === 'pro' ? 5 : 15

    const PLANS = [
        { id: 'starter', name: 'Starter', price: '$9/mo', screens: 2 },
        { id: 'pro', name: 'Pro', price: '$24/mo', screens: 5 },
        { id: 'business', name: 'Business', price: '$59/mo', screens: 15 },
    ] as const

    // Free trial expired without upgrading — block screen management,
    // but still allow upgrading to instantly restore full access
    if (org.status === 'disabled') {
        return (
            <div>
                <div className="text-center py-16 border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50 mb-10">
                    <p className="font-semibold text-zinc-900 mb-1">Your free trial has ended</p>
                    <p className="text-sm text-zinc-600">
                        Your screens are paused, but all your videos and settings are safe. Upgrade below to resume playback instantly.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PLANS.map((plan) => (
                        <div key={plan.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
                            <p className="font-semibold text-zinc-900">{plan.name}</p>
                            <p className="text-sm text-zinc-500 mb-1">{plan.price}</p>
                            <p className="text-xs text-zinc-400 mb-3">{plan.screens} screens included</p>
                            <form action={`/api/billing/checkout?plan=${plan.id}`} method="POST">
                                <Button type="submit" size="sm" className="w-full">
                                    Upgrade
                                </Button>
                            </form>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Screens</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        {screenList.length} of {planLimit} screens used
                    </p>
                </div>
                <form action="/api/screens" method="POST">
                    <Button
                        type="submit"
                        disabled={screenList.length >= planLimit}
                    >
                        + Add screen
                    </Button>
                </form>
            </div>

            {/* Empty state */}
            {screenList.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-zinc-200 rounded-2xl bg-white">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-100 rounded-xl mb-4">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="text-zinc-400">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <path d="M8 21h8M12 17v4" />
                        </svg>
                    </div>
                    <p className="font-semibold text-zinc-900 mb-1">No screens yet</p>
                    <p className="text-sm text-zinc-500 mb-6">Add your first screen to get started</p>
                    <form action="/api/screens" method="POST">
                        <Button type="submit">+ Add your first screen</Button>
                    </form>
                </div>
            )}

            {/* Screen list */}
            {screenList.length > 0 && (
                <div className="space-y-3">
                    {screenList.map((screen) => {
                        const slides = Array.isArray(screen.slides) ? screen.slides : []
                        const slideCount = slides.length
                        const status = getScreenStatus(screen.last_seen_at)
                        const currentSlide = slides[screen.current_slide_index]

                        return (
                            <Link
                                key={screen.id}
                                href={`/screens/${screen.id}`}
                                className="block bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-400 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-10 h-10 bg-zinc-900 rounded-xl text-white font-bold text-sm font-mono tracking-widest">
                                            {screen.pin}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-zinc-900">
                                                {screen.name || <span className="text-zinc-400 font-normal">Untitled screen</span>}
                                            </p>
                                            <p className="text-sm text-zinc-500 mt-0.5">
                                                {slideCount} video{slideCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                PIN {screen.pin}
                                            </Badge>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-400">
                                                <path d="M9 18l6-6-6-6" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${
                                                    status === 'online' && screen.is_open
                                                        ? 'bg-green-500'
                                                        : status === 'online'
                                                        ? 'bg-zinc-400'
                                                        : status === 'offline'
                                                        ? 'bg-amber-500'
                                                        : 'bg-zinc-300'
                                                }`}
                                            />
                                            {status === 'online' && !screen.is_open && (
                                                <span className="text-zinc-500">Closed · Outside business hours</span>
                                            )}
                                            {status === 'online' && screen.is_open && (
                                                <span className="text-zinc-500">
                                                    Online{currentSlide ? ` · Playing ${screen.current_slide_index + 1}/${slideCount} (${currentSlide.type === 'youtube' ? 'YouTube' : 'Uploaded'})` : ''}
                                                </span>
                                            )}
                                            {status === 'offline' && (
                                                <span className="text-zinc-400">Offline · Last seen {formatTimeAgo(screen.last_seen_at)}</span>
                                            )}
                                            {status === 'never' && (
                                                <span className="text-zinc-400">Not connected yet</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}

            <OrgScheduleSettings initialSchedule={org.default_schedule ?? null} />

            {/* Billing */}
            <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-zinc-900">Billing</h2>
                    {org.stripe_subscription_id && (
                        <form action="/api/billing/portal" method="POST">
                            <Button type="submit" variant="ghost" size="sm">
                                Manage billing
                            </Button>
                        </form>
                    )}
                </div>
                <p className="text-sm text-zinc-500 mb-4">
                    Current plan: <span className="font-medium text-zinc-900 capitalize">{org.plan}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PLANS.map((plan) => (
                        <div key={plan.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
                            <p className="font-semibold text-zinc-900">{plan.name}</p>
                            <p className="text-sm text-zinc-500 mb-1">{plan.price}</p>
                            <p className="text-xs text-zinc-400 mb-3">{plan.screens} screens included</p>
                            {org.plan === plan.id ? (
                                <Badge variant="outline">Current plan</Badge>
                            ) : (
                                <form action={`/api/billing/checkout?plan=${plan.id}`} method="POST">
                                    <Button type="submit" size="sm" className="w-full">
                                        {org.plan === 'free' ? 'Upgrade' : 'Switch'}
                                    </Button>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
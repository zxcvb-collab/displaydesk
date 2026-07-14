import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

const PLANS = [
    { name: 'Free', price: '$0', screens: '1 screen', detail: '3-month trial' },
    { name: 'Starter', price: '$9/mo', screens: '2 screens', detail: '+$5 per extra screen' },
    { name: 'Pro', price: '$24/mo', screens: '5 screens', detail: '+$4 per extra screen' },
    { name: 'Business', price: '$59/mo', screens: '15 screens', detail: '+$3 per extra screen' },
] as const

const STEPS = [
    {
        title: 'Sign up & create a screen',
        detail: 'Get a unique 4-digit PIN instantly — no hardware, no setup calls.',
    },
    {
        title: 'Upload your menu video',
        detail: 'Export from Canva as an MP4, or just paste a YouTube link.',
    },
    {
        title: 'Open the link on your TV, tap once',
        detail: 'It goes fullscreen and loops automatically — forever, no further interaction needed.',
    },
] as const

const BENEFITS = [
    'No more "Are you still watching?" YouTube interruptions',
    'Update your menu from your phone — never touch the TV again',
    'Screens can go dark automatically outside business hours',
    'See at a glance which screens are online and what’s playing',
] as const

export default async function HomePage() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) redirect('/dashboard')
    } catch (error) {
        console.error('Root page error:', error)
    }

    return (
        <div className="min-h-screen bg-zinc-50">
            {/* Header */}
            <header className="border-b border-zinc-200 bg-white">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-7 h-7 bg-zinc-900 rounded-lg">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <path d="M8 21h8M12 17v4" />
                            </svg>
                        </div>
                        <span className="font-semibold text-zinc-900 tracking-tight">DisplayDesk</span>
                    </div>
                    <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900">
                        Log in
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
                    Your menu, live on any TV — in minutes
                </h1>
                <p className="text-lg text-zinc-500 mb-8 max-w-xl mx-auto">
                    No cables, no new hardware, no YouTube ads interrupting your menu.
                    Upload a video, get a PIN, tap once on the TV — done.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <Button asChild size="lg" className="px-6 text-base h-11">
                        <Link href="/signup">Get started free</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="px-6 text-base h-11">
                        <Link href="/login">Log in</Link>
                    </Button>
                </div>
                <p className="text-xs text-zinc-400 mt-4">Free for 1 screen, 3 months. No credit card required.</p>
            </section>

            {/* How it works */}
            <section className="max-w-4xl mx-auto px-6 pb-16">
                <h2 className="text-center text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-8">
                    Set up in 3 steps
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {STEPS.map((step, i) => (
                        <div key={step.title} className="bg-white border border-zinc-200 rounded-2xl p-6">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 text-white font-semibold text-sm mb-4">
                                {i + 1}
                            </div>
                            <p className="font-semibold text-zinc-900 mb-1">{step.title}</p>
                            <p className="text-sm text-zinc-500">{step.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Benefits */}
            <section className="max-w-3xl mx-auto px-6 pb-16">
                <div className="bg-white border border-zinc-200 rounded-2xl p-8">
                    <ul className="space-y-3">
                        {BENEFITS.map((benefit) => (
                            <li key={benefit} className="flex items-start gap-3 text-sm text-zinc-700">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-green-600 shrink-0 mt-0.5">
                                    <path d="M20 6L9 17l-5-5" />
                                </svg>
                                {benefit}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Pricing */}
            <section className="max-w-4xl mx-auto px-6 pb-20">
                <h2 className="text-center text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-8">
                    Simple pricing
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {PLANS.map((plan) => (
                        <div key={plan.name} className="bg-white border border-zinc-200 rounded-2xl p-5 text-center">
                            <p className="font-semibold text-zinc-900">{plan.name}</p>
                            <p className="text-2xl font-bold text-zinc-900 mt-1">{plan.price}</p>
                            <p className="text-sm text-zinc-500 mt-2">{plan.screens}</p>
                            <p className="text-xs text-zinc-400 mt-1">{plan.detail}</p>
                        </div>
                    ))}
                </div>
                <div className="text-center mt-8">
                    <Button asChild size="lg" className="px-6 text-base h-11">
                        <Link href="/signup">Get started free</Link>
                    </Button>
                </div>
            </section>

            <footer className="border-t border-zinc-200 py-8">
                <p className="text-center text-xs text-zinc-400">DisplayDesk</p>
            </footer>
        </div>
    )
}

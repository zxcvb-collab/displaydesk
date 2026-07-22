import { redirect } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

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
        title: 'Build your menu, right in the browser',
        detail: 'Use the built-in design editor, upload an MP4, paste a YouTube link, or design in Canva.',
    },
    {
        title: 'Open the link on your TV, tap once',
        detail: 'It goes fullscreen and loops automatically — forever, no further interaction needed.',
    },
] as const

const FEATURES = [
    {
        title: 'Built-in design editor',
        detail: 'Drag-and-drop text, images, tables, and shapes into a menu board — no video export or re-upload needed to change a price.',
    },
    {
        title: 'Image slideshows & tables',
        detail: 'Rotate through multiple photos automatically, and lay out pricing in clean, aligned rows and columns.',
    },
    {
        title: 'Ready-made templates',
        detail: 'Start from a menu board, specials, or announcement template, or save your own layout to reuse across screens.',
    },
    {
        title: 'Works offline',
        detail: 'Once loaded, a screen keeps playing cached content straight through a Wi-Fi or internet outage.',
    },
    {
        title: 'Automatic scheduling',
        detail: 'Screens can go dark automatically outside business hours — no one has to remember to turn the TV off.',
    },
    {
        title: 'Team access',
        detail: 'Invite staff to manage screens under one shared account, with owner and member roles.',
    },
] as const

const BENEFITS = [
    'No more "Are you still watching?" YouTube interruptions or ads on your menu board',
    'Update your menu from your phone — never touch the TV again',
    'Screens can go dark automatically outside business hours',
    'See at a glance which screens are online and what’s playing',
    'Content keeps playing even if the internet drops mid-shift',
] as const

const USE_CASES = [
    'Cafes and coffee shops',
    'Restaurants and quick-service menu boards',
    'Bars and breweries',
    'Salons and barbershops',
    'Gyms and studios',
] as const

const FAQS = [
    {
        q: 'What is a digital menu board?',
        a: 'A digital menu board is a TV or screen that displays your menu, prices, and promotions instead of a printed sign — updated instantly from a phone or computer rather than reprinted every time something changes.',
    },
    {
        q: 'Do I need special hardware to use DisplayDesk?',
        a: 'No. Any smart TV, streaming stick, or device with a web browser works. Open the DisplayDesk player page on the TV, enter your screen\'s 4-digit PIN once, and it plays fullscreen on a loop from then on.',
    },
    {
        q: 'Can I build my menu without Canva or video editing software?',
        a: 'Yes. DisplayDesk includes a built-in design editor with text, images, image slideshows, tables, and shapes — built to render natively on the TV, so there\'s no video export or re-upload step when you change a price or item.',
    },
    {
        q: 'What happens if my restaurant\'s internet or Wi-Fi goes down?',
        a: 'Once a screen has loaded, DisplayDesk caches the content locally so it keeps playing through a Wi-Fi or internet outage instead of going blank or freezing.',
    },
    {
        q: 'Can I still use YouTube videos or Canva exports?',
        a: 'Yes. You can paste a YouTube link, upload an MP4 you made in Canva or any other tool, or build a menu directly in DisplayDesk\'s own editor — all three can be mixed on the same screen\'s slideshow.',
    },
    {
        q: 'How much does DisplayDesk cost?',
        a: 'DisplayDesk is free for 1 screen for 3 months with no credit card required. Paid plans start at $9/month for 2 screens, scaling up to $59/month for 15 screens, with extra screens billed per-screen beyond each plan\'s included count.',
    },
    {
        q: 'Can multiple staff members manage the same screens?',
        a: 'Yes. The account owner can invite team members who can then update menus and manage screens under the same organisation.',
    },
] as const

// Structured data: SoftwareApplication (pricing, category) helps search
// engines show rich results; FAQPage helps both classic search snippets
// and AI answer engines (ChatGPT, Perplexity, Google AI Overviews) quote
// DisplayDesk directly when answering digital-signage questions.
const softwareAppJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (web-based)',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    offers: PLANS.map((plan) => ({
        '@type': 'Offer',
        name: `${plan.name} plan`,
        price: plan.price.replace(/[^0-9.]/g, '') || '0',
        priceCurrency: 'USD',
    })),
}

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
}

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
            <Script id="software-app-jsonld" type="application/ld+json">
                {JSON.stringify(softwareAppJsonLd)}
            </Script>
            <Script id="faq-jsonld" type="application/ld+json">
                {JSON.stringify(faqJsonLd)}
            </Script>

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
                        <span className="font-semibold text-zinc-900 tracking-tight">{SITE_NAME}</span>
                    </div>
                    <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900">
                        Log in
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 mb-4">
                    Turn any TV into a digital menu board — in minutes
                </h1>
                <p className="text-lg text-zinc-500 mb-8 max-w-xl mx-auto">
                    DisplayDesk is digital signage software for restaurants, cafes, and small
                    businesses. Build your menu with a drag-and-drop editor, upload a video, or
                    paste a YouTube link. No hardware to buy, no ads interrupting your screen,
                    works even if the internet drops.
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

            {/* Features */}
            <section className="max-w-4xl mx-auto px-6 pb-16">
                <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 mb-2">
                    Everything you need to run your menu board
                </h2>
                <p className="text-center text-sm text-zinc-500 mb-8 max-w-lg mx-auto">
                    From a built-in design tool to offline playback, DisplayDesk covers the whole
                    workflow — not just video hosting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FEATURES.map((f) => (
                        <div key={f.title} className="bg-white border border-zinc-200 rounded-2xl p-5">
                            <p className="font-semibold text-zinc-900 mb-1">{f.title}</p>
                            <p className="text-sm text-zinc-500">{f.detail}</p>
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

            {/* Use cases */}
            <section className="max-w-3xl mx-auto px-6 pb-16 text-center">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-4">
                    Built for
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {USE_CASES.map((use) => (
                        <span key={use} className="bg-white border border-zinc-200 rounded-full px-4 py-1.5 text-sm text-zinc-600">
                            {use}
                        </span>
                    ))}
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

            {/* FAQ — plain Q&A text mirrors the FAQPage schema above, so
                both classic search snippets and AI answer engines can quote
                these answers directly. */}
            <section className="max-w-3xl mx-auto px-6 pb-20">
                <h2 className="text-center text-2xl font-bold tracking-tight text-zinc-900 mb-8">
                    Frequently asked questions
                </h2>
                <div className="space-y-4">
                    {FAQS.map((faq) => (
                        <div key={faq.q} className="bg-white border border-zinc-200 rounded-2xl p-6">
                            <h3 className="font-semibold text-zinc-900 mb-1.5">{faq.q}</h3>
                            <p className="text-sm text-zinc-500">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </section>

            <footer className="border-t border-zinc-200 py-8">
                <p className="text-center text-xs text-zinc-400">{SITE_NAME} — digital menu boards & TV signage for restaurants and cafes</p>
            </footer>
        </div>
    )
}

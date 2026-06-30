import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

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
                        const slideCount = Array.isArray(screen.slides) ? screen.slides.length : 0
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
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="font-mono text-xs">
                                            PIN {screen.pin}
                                        </Badge>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-400">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
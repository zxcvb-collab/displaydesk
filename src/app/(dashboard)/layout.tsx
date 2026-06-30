import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: org } = await supabase
        .from('organisations')
        .select('name, plan')
        .eq('owner_id', user.id)
        .single()

    return (
        <div className="min-h-screen bg-zinc-50">
            <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
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
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-500 hidden sm:block">
                            {org?.name}
                        </span>
                        <form action="/auth/signout" method="POST">
                            <Button variant="ghost" size="sm" formAction="/auth/signout">
                                Sign out
                            </Button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-6 py-8">
                {children}
            </main>
        </div>
    )
}
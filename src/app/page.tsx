import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        redirect(user ? '/dashboard' : '/login')
    } catch (error) {
        console.error('Root page error:', error)
        redirect('/login')
    }
}
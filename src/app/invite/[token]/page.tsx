import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RedeemInvite from './redeem-invite'

export const dynamic = 'force-dynamic'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Not logged in — send to login, then bring them right back here to
        // finish redeeming. If they don't have an account yet, the login
        // page links to signup; after confirming their email they can just
        // revisit this same invite link.
        redirect(`/login?redirect=/invite/${token}`)
    }

    return <RedeemInvite token={token} />
}

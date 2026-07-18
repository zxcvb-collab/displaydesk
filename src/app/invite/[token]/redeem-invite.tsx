'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RedeemInvite({ token }: { token: string }) {
    const router = useRouter()
    const [error, setError] = useState('')

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/invites/redeem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                })
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    setError(body.error || 'Could not redeem this invite')
                    return
                }
                router.push('/dashboard')
                router.refresh()
            } catch {
                setError('Could not redeem this invite — check your connection and try again')
            }
        })()
    }, [token, router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
            <div className="text-center">
                {error ? (
                    <>
                        <p className="font-semibold text-zinc-900 mb-1">Couldn&rsquo;t join this team</p>
                        <p className="text-sm text-zinc-500">{error}</p>
                    </>
                ) : (
                    <p className="text-sm text-zinc-500">Joining team…</p>
                )}
            </div>
        </div>
    )
}

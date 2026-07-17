'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createAnonClient } from '@/lib/supabase/anon'

export default function TVPinEntryPage() {
    const router = useRouter()
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')

    const submit = useCallback(async (fullPin: string) => {
        setError('')
        try {
            // Validate directly via RPC rather than the polling endpoint —
            // that endpoint also records a heartbeat as a side effect,
            // which would show a screen as "online" before it's actually
            // loaded and playing
            const supabase = createAnonClient()
            const { data } = await supabase.rpc('get_screen_by_pin', { p_pin: fullPin })
            if (!data?.[0]) {
                setError('No screen found with that PIN')
                setPin('')
                return
            }
            router.push(`/tv/${fullPin}`)
        } catch {
            setError('Could not check that PIN — try again')
            setPin('')
        }
    }, [router])

    function pressDigit(d: string) {
        if (pin.length >= 4) return
        const next = pin + d
        setPin(next)
        setError('')
        if (next.length === 4) submit(next)
    }

    function backspace() {
        setPin((p) => p.slice(0, -1))
        setError('')
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
            <p className="text-lg opacity-60 mb-6">Enter this screen&rsquo;s PIN</p>

            <div className="flex gap-3 mb-10">
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="w-14 h-16 rounded-xl bg-white/10 flex items-center justify-center text-3xl font-mono tracking-widest"
                    >
                        {pin[i] ?? ''}
                    </div>
                ))}
            </div>

            {error && <p className="text-red-400 text-sm mb-6">{error}</p>}

            <div className="grid grid-cols-3 gap-3 w-72">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                        key={d}
                        onClick={() => pressDigit(d)}
                        className="h-16 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white/30 text-2xl font-medium transition-colors"
                    >
                        {d}
                    </button>
                ))}
                <button
                    onClick={backspace}
                    className="h-16 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white/30 flex items-center justify-center transition-colors"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="M18 9l-6 6M12 9l6 6" /></svg>
                </button>
                <button
                    onClick={() => pressDigit('0')}
                    className="h-16 rounded-xl bg-white/10 hover:bg-white/20 focus:bg-white/30 text-2xl font-medium transition-colors"
                >
                    0
                </button>
                <div />
            </div>

            <p className="text-xs opacity-30 mt-10">Bookmark this page — you&rsquo;ll only need to type the PIN from now on</p>
        </div>
    )
}

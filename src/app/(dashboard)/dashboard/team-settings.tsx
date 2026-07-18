'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Member = { userId: string; email: string }

export default function TeamSettings({
    isOwner,
    initialMembers,
}: {
    isOwner: boolean
    initialMembers: Member[]
}) {
    const [members, setMembers] = useState(initialMembers)
    const [email, setEmail] = useState('')
    const [inviteUrl, setInviteUrl] = useState('')
    const [error, setError] = useState('')
    const [sending, setSending] = useState(false)
    const [removingId, setRemovingId] = useState('')

    async function sendInvite() {
        setError('')
        setInviteUrl('')
        if (!email.trim()) return
        setSending(true)
        try {
            const res = await fetch('/api/org/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            })
            const body = await res.json()
            if (!res.ok) {
                setError(body.error || 'Failed to create invite')
                return
            }
            setInviteUrl(body.url)
            setEmail('')
        } finally {
            setSending(false)
        }
    }

    async function removeMember(userId: string) {
        if (!confirm('Remove this team member? They will lose access immediately.')) return
        setRemovingId(userId)
        try {
            await fetch(`/api/org/members?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' })
            setMembers((prev) => prev.filter((m) => m.userId !== userId))
        } finally {
            setRemovingId('')
        }
    }

    return (
        <div className="mt-10">
            <h2 className="font-semibold text-zinc-900 mb-1">Team</h2>
            <p className="text-sm text-zinc-500 mb-4">
                {isOwner
                    ? 'Team members can manage screens and videos, but not billing.'
                    : "You're a team member on this account — screen management only, no billing access."}
            </p>

            {members.length > 0 && (
                <div className="space-y-2 mb-4">
                    {members.map((m) => (
                        <div
                            key={m.userId}
                            className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm"
                        >
                            <span className="text-zinc-700">{m.email}</span>
                            {isOwner && (
                                <button
                                    onClick={() => removeMember(m.userId)}
                                    disabled={removingId === m.userId}
                                    className="text-xs text-red-500 hover:text-red-700"
                                >
                                    {removingId === m.userId ? 'Removing…' : 'Remove'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isOwner && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-3">Invite a team member</p>
                    <div className="flex gap-2">
                        <Input
                            type="email"
                            placeholder="teammate@example.com"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(''); setInviteUrl('') }}
                            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                            className="flex-1"
                        />
                        <Button onClick={sendInvite} disabled={sending}>
                            {sending ? 'Creating…' : 'Create invite link'}
                        </Button>
                    </div>
                    {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                    {inviteUrl && (
                        <div className="mt-3 p-3 bg-zinc-50 rounded-lg">
                            <p className="text-xs text-zinc-500 mb-1">
                                Copy and send this link to {email || 'your teammate'} — no email is sent automatically:
                            </p>
                            <p className="text-xs font-mono text-zinc-700 break-all">{inviteUrl}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

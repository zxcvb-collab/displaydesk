'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
    const router = useRouter()
    const [businessName, setBusinessName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { business_name: businessName },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        setLoading(false)
        if (error) { setError(error.message); return }
        setDone(true)
    }

    if (done) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Check your email</CardTitle>
                    <CardDescription>
                        We sent a confirmation link to <strong>{email}</strong>.
                        Click it to activate your account.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create your account</CardTitle>
                <CardDescription>Start displaying menus in minutes</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="business">Business name</Label>
                        <Input
                            id="business"
                            placeholder="e.g. The Corner Café"
                            value={businessName}
                            onChange={e => setBusinessName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="At least 8 characters"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            minLength={8}
                            required
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Creating account…' : 'Create account'}
                    </Button>
                    <p className="text-sm text-zinc-500 text-center">
                        Already have an account?{' '}
                        <Link href="/login" className="text-zinc-900 font-medium hover:underline">
                            Log in
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    )
}
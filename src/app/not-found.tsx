import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="text-center max-w-md">
                <p className="text-6xl font-bold text-zinc-200 mb-4">404</p>
                <h1 className="text-2xl font-bold text-zinc-900 mb-2">Page not found</h1>
                <p className="text-zinc-500 mb-8">
                    We couldn't find the screen you're looking for. Check your PIN and try again.
                </p>
                <div className="flex gap-3 justify-center">
                    <Link href="/">
                        <Button variant="outline">Home</Button>
                    </Link>
                    <Link href="/dashboard">
                        <Button>Dashboard</Button>
                    </Link>
                </div>
            </div>
        </div>
    )
}

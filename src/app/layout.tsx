import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'DisplayDesk',
    description: 'Digital signage for small businesses',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={geist.className}>
                {/*
                  Registered here (root layout, beforeInteractive) rather
                  than inside the TV player component, so it fires as early
                  as possible — before React hydrates. A registration
                  buried in a component effect only runs after the whole
                  page has hydrated, by which point the first visit's JS/CSS
                  chunks and initial data fetch have often already completed
                  outside the service worker's control, so nothing from
                  that first load gets cached. Safe to register site-wide:
                  the explicit scope restricts it to /tv/* regardless of
                  where registration is called from — it can never gain
                  control of the admin dashboard.
                */}
                <Script id="sw-register" strategy="beforeInteractive">
                    {`if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js', { scope: '/tv/' }).catch(() => {}) }`}
                </Script>
                {children}
            </body>
        </html>
    )
}
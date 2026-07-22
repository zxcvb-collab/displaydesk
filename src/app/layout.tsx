import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { SITE_URL, SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/site'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: `${SITE_NAME} — ${SITE_TAGLINE}`,
        template: `%s — ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
        'digital menu board',
        'digital signage software',
        'restaurant menu board TV',
        'cafe TV menu display',
        'digital menu board for small business',
        'TV signage app',
        'replace paper menu board',
        'YouTube TV menu board alternative',
        'menu board design tool',
    ],
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME }],
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        url: SITE_URL,
        siteName: SITE_NAME,
        title: `${SITE_NAME} — ${SITE_TAGLINE}`,
        description: SITE_DESCRIPTION,
        images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `${SITE_NAME} — ${SITE_TAGLINE}`,
        description: SITE_DESCRIPTION,
        images: ['/opengraph-image'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: {
        icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    },
}

// Organization schema on every page — helps search engines and AI answer
// engines (ChatGPT, Perplexity, Google AI Overviews) reliably identify who
// DisplayDesk is when citing or summarizing the site.
const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
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
                <Script id="org-jsonld" type="application/ld+json" strategy="beforeInteractive">
                    {JSON.stringify(organizationJsonLd)}
                </Script>
                {children}
            </body>
        </html>
    )
}

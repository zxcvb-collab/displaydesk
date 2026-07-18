// Scoped to /tv/* only (see registration in the root layout, beforeInteractive)
// — lets the TV player survive a full reload/restart during an outage, not
// just a mid-session network blip. Network-first, falling back to the last
// successfully cached response when offline: always prefer fresh content
// when reachable, fall back to last-known-good when not.
//
// Only helps once the TV has successfully loaded at least once while
// online — there's no way to serve a page that's never been cached.

const CACHE_NAME = 'displaydesk-shell-v1'

self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
})

function shouldHandle(url) {
    return (
        url.pathname.startsWith('/tv') ||
        url.pathname.startsWith('/api/tv/') ||
        url.pathname.startsWith('/_next/static') ||
        // YouTube's auto-generated thumbnails, used as the offline fallback
        // image for YouTube slides — cross-origin, so the response comes
        // back opaque (status 0, ok: false) even on success; must be
        // cached unconditionally rather than gated on response.ok
        url.hostname === 'img.youtube.com'
    )
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)
    if (event.request.method !== 'GET' || !shouldHandle(url)) return

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME)
            try {
                const networkResponse = await fetch(event.request)
                if (networkResponse.ok || networkResponse.type === 'opaque') {
                    cache.put(event.request, networkResponse.clone())
                }
                return networkResponse
            } catch {
                const cached = await cache.match(event.request)
                if (cached) return cached
                throw new Error('Offline and no cached response available')
            }
        })()
    )
})

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { resolveEffectiveSchedule, isOpenNow, type ScheduleMode, type WeekSchedule } from '@/lib/schedule'
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_DURATION_SECONDS, DEFAULT_IMAGE_INTERVAL_SECONDS, imageUrls, findMergeAt, isMergedAway, columnBadgeColor, type DesignData, type ImageElement } from '@/lib/design'

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        YT: any
        onYouTubeIframeAPIReady: () => void
    }
}

function getYouTubeId(url: string): string | null {
    const patterns = [
        /youtu\.be\/([^?&#]+)/,
        /[?&]v=([^&#]+)/,
        /youtube\.com\/embed\/([^?&#]+)/,
        /youtube\.com\/shorts\/([^?&#]+)/,
    ]
    for (const p of patterns) {
        const m = url.match(p)
        if (m) return m[1]
    }
    return null
}

type Slide = {
    url?: string
    type: 'youtube' | 'video' | 'design'
    design?: DesignData
    duration?: number
    name?: string
}

// Cycles through an image element's urls on its own timer, independent of
// the overall slide's duration — a slideshow within one design element.
function DesignImageSlideshow({ el, style }: { el: ImageElement; style: React.CSSProperties }) {
    const urls = imageUrls(el)
    const [index, setIndex] = useState(0)

    useEffect(() => {
        setIndex(0)
        if (urls.length <= 1) return
        const interval = setInterval(() => {
            setIndex((i) => (i + 1) % urls.length)
        }, (el.intervalSeconds || DEFAULT_IMAGE_INTERVAL_SECONDS) * 1000)
        return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urls.join('|'), el.intervalSeconds])

    if (urls.length === 0) return null
    return <img src={urls[index]} alt="" style={style} className="object-cover" />
}

function getVideoIds(slides: Slide[]): string[] {
    return slides
        .filter(s => s.type === 'youtube' && s.url)
        .map(s => getYouTubeId(s.url!))
        .filter((id): id is string => id !== null)
}

function getUploadedVideos(slides: Slide[]): string[] {
    return slides.filter(s => s.type === 'video' && s.url).map(s => s.url!)
}

// hqdefault.jpg (480x360) is guaranteed to exist for any video but looks
// soft stretched across a TV screen. maxresdefault.jpg (1280x720) is much
// sharper but only exists for videos with a true HD source — when it
// doesn't, YouTube returns HTTP 200 with a tiny 120x90 placeholder instead
// of a real 404, so a plain fetch/response-status check can't tell the
// difference. Loading it as an actual Image and checking naturalWidth
// (a real maxresdefault is 1280px wide; the placeholder is 120px) is the
// standard way to detect this.
function resolveBestThumbnail(videoId: string): Promise<string> {
    return new Promise((resolve) => {
        const maxresUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        const img = new Image()
        const timeout = setTimeout(() => resolve(hqUrl), 4000)
        img.onload = () => {
            clearTimeout(timeout)
            resolve(img.naturalWidth >= 640 ? maxresUrl : hqUrl)
        }
        img.onerror = () => {
            clearTimeout(timeout)
            resolve(hqUrl)
        }
        img.src = maxresUrl
    })
}

// Offline resilience for uploaded videos: opportunistically cache them in
// the browser's Cache Storage as they're seen, then fall back to the
// cached copy if a network fetch fails (e.g. wifi drops mid-loop). This
// only covers uploaded videos — YouTube slides stream live from YouTube's
// own servers and can never work offline, no way around that.
//
// Surviving a full page reload/restart during an outage (not just a
// mid-session blip) is handled separately by the service worker
// registered below (public/sw.js, scoped to /tv/*) — it network-first
// caches the page shell and content poll so a reload can still render
// from the last successful load even with zero connectivity.
const MEDIA_CACHE_NAME = 'displaydesk-media-v1'

async function getMediaCache(): Promise<Cache | null> {
    if (typeof caches === 'undefined') return null
    try {
        return await caches.open(MEDIA_CACHE_NAME)
    } catch {
        return null
    }
}

type FullscreenElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void
    mozRequestFullScreen?: () => Promise<void> | void
    msRequestFullscreen?: () => Promise<void> | void
}

function isFullscreenActive(): boolean {
    if (typeof document === 'undefined') return false
    const doc = document as Document & {
        webkitFullscreenElement?: Element | null
        mozFullScreenElement?: Element | null
        msFullscreenElement?: Element | null
    }
    return !!(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
    )
}

async function requestFullscreenSafe(el: HTMLElement) {
    const target = el as FullscreenElement
    try {
        if (target.requestFullscreen) {
            await target.requestFullscreen()
        } else if (target.webkitRequestFullscreen) {
            await target.webkitRequestFullscreen()
        } else if (target.mozRequestFullScreen) {
            await target.mozRequestFullScreen()
        } else if (target.msRequestFullscreen) {
            await target.msRequestFullscreen()
        }
    } catch {
        // TV browsers frequently throw or silently fail — ignore and continue playback
    }
}

export default function TVPlayer({
    pin,
    initialSlides,
    initialScheduleMode,
    initialSchedule,
    initialOrgDefaultSchedule,
    initialOrgStatus,
}: {
    pin: string
    initialSlides: Slide[]
    initialScheduleMode?: ScheduleMode
    initialSchedule?: WeekSchedule | null
    initialOrgDefaultSchedule?: WeekSchedule | null
    initialOrgStatus?: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ytPlayer = useRef<any>(null)
    const [slides, setSlides] = useState(initialSlides)
    const [ready, setReady] = useState(false)
    const [currentType, setCurrentType] = useState<'youtube' | 'video' | 'design' | null>(null)
    const currentTypeRef = useRef(currentType)
    useEffect(() => { currentTypeRef.current = currentType }, [currentType])
    const designTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [started, setStarted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const currentIndex = useRef(0)
    const hasInitialized = useRef(false)
    const slidesRef = useRef(slides)
    useEffect(() => { slidesRef.current = slides }, [slides])
    const triedCacheFallback = useRef(false)
    const lastObjectUrl = useRef<string | null>(null)
    const handleVideoErrorRef = useRef<() => void>(() => {})
    const advanceSlideRef = useRef<() => void>(() => {})

    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialScheduleMode ?? 'inherit')
    const [schedule, setSchedule] = useState<WeekSchedule | null>(initialSchedule ?? null)
    const [orgDefaultSchedule, setOrgDefaultSchedule] = useState<WeekSchedule | null>(initialOrgDefaultSchedule ?? null)
    const effectiveSchedule = resolveEffectiveSchedule(scheduleMode, schedule, orgDefaultSchedule)
    const [isOpen, setIsOpen] = useState(() => isOpenNow(effectiveSchedule))
    const wasOpen = useRef(isOpen)
    const isOpenRef = useRef(isOpen)
    useEffect(() => { isOpenRef.current = isOpen }, [isOpen])
    const [orgStatus, setOrgStatus] = useState(initialOrgStatus ?? 'active')
    const orgStatusRef = useRef(orgStatus)
    useEffect(() => { orgStatusRef.current = orgStatus }, [orgStatus])
    const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
    const [resolvedThumbs, setResolvedThumbs] = useState<Record<string, string>>({})

    // Extract valid video IDs and uploaded videos
    const youtubeIds = getVideoIds(slides)
    const uploadedVideos = getUploadedVideos(slides)
    const allSlides = slides

    const playSlideIndex = useCallback((index: number, allSlides: Slide[]) => {
        if (allSlides.length === 0) return
        const safeIndex = index % allSlides.length
        const slide = allSlides[safeIndex]
        currentIndex.current = safeIndex
        setCurrentType(slide.type)

        // Clear any pending design-slide auto-advance timer regardless of
        // the new slide's type — otherwise a stale timer from a previous
        // design slide could fire later and cause a double-advance after
        // the slide has already moved on some other way
        if (designTimer.current) {
            clearTimeout(designTimer.current)
            designTimer.current = null
        }

        if (slide.type === 'youtube' && slide.url) {
            const videoId = getYouTubeId(slide.url)
            if (videoId && ytPlayer.current) {
                ytPlayer.current.loadVideoById(videoId)
            }
        } else if (slide.type === 'video' && slide.url) {
            if (videoRef.current) {
                triedCacheFallback.current = false
                videoRef.current.src = slide.url
                videoRef.current.play().catch(() => {
                    handleVideoErrorRef.current()
                })
            }
        } else if (slide.type === 'design') {
            // No natural "ended" event like video has — advance on a timer
            // instead, using the duration set in the design editor
            const seconds = slide.duration ?? DEFAULT_DURATION_SECONDS
            designTimer.current = setTimeout(() => {
                // Don't silently advance in the background while the
                // screen is showing black (closed for hours / disabled) —
                // the resume-from-close/disable effects below restart this
                // timer when playback actually resumes
                if (!isOpenRef.current || orgStatusRef.current === 'disabled') return
                advanceSlideRef.current()
            }, seconds * 1000)
        }
    }, [])

    const advanceSlide = useCallback(() => {
        setSlides((current) => {
            playSlideIndex((currentIndex.current + 1) % current.length, current)
            return current
        })
    }, [playSlideIndex])

    useEffect(() => { advanceSlideRef.current = advanceSlide }, [advanceSlide])

    // On a load/playback error, try the cached copy (if we have one) before
    // giving up and skipping to the next slide — this is what actually
    // survives a brief network blip mid-loop.
    const handleVideoError = useCallback(async () => {
        const slide = slidesRef.current[currentIndex.current]

        if (triedCacheFallback.current || !slide || slide.type !== 'video' || !slide.url || !videoRef.current) {
            advanceSlide()
            return
        }
        triedCacheFallback.current = true

        try {
            const cache = await getMediaCache()
            const match = await cache?.match(slide.url)
            if (!match) throw new Error('not cached')

            const blob = await match.blob()
            if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current)
            const objectUrl = URL.createObjectURL(blob)
            lastObjectUrl.current = objectUrl

            if (!videoRef.current) return
            videoRef.current.src = objectUrl
            await videoRef.current.play()
        } catch {
            advanceSlide()
        }
    }, [advanceSlide])

    useEffect(() => { handleVideoErrorRef.current = handleVideoError }, [handleVideoError])

    // Opportunistically cache uploaded videos as they're seen, so a later
    // network blip has something to fall back to. Runs in the background,
    // never blocks playback.
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const cache = await getMediaCache()
            if (!cache) return
            for (const url of getUploadedVideos(slides)) {
                if (cancelled) return
                if (await cache.match(url)) continue
                try {
                    const res = await fetch(url)
                    if (res.ok) await cache.put(url, res.clone())
                } catch {
                    // offline or failed — will retry next time slides change
                }
            }
        })()
        return () => { cancelled = true }
    }, [slides])

    // Resolve the best available thumbnail per video (maxresdefault if it
    // really exists, hqdefault otherwise) and proactively warm the cache
    // for it. The fallback <img> only exists in the DOM once already
    // offline (a conditional render), so without this, the browser never
    // actually requests the thumbnail while online and the service worker
    // never gets a chance to cache it. no-cors since these are
    // cross-origin; we don't need to read the response, just want the SW
    // to intercept and cache it.
    useEffect(() => {
        let cancelled = false
        const ids = Array.from(new Set(
            slides.filter((s) => s.type === 'youtube' && s.url).map((s) => getYouTubeId(s.url!)).filter((id): id is string => id !== null)
        ))

        ;(async () => {
            for (const id of ids) {
                const url = await resolveBestThumbnail(id)
                if (cancelled) return
                setResolvedThumbs((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }))
                fetch(url, { mode: 'no-cors' }).catch(() => {})
            }
        })()

        return () => { cancelled = true }
    }, [slides])

    // Re-evaluate open/closed state locally every 15s using the TV's own
    // clock — no network call needed, just catches the exact minute the
    // schedule crosses an open/close boundary between content polls.
    useEffect(() => {
        const check = () => setIsOpen(isOpenNow(effectiveSchedule))
        check()
        const interval = setInterval(check, 15_000)
        return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduleMode, schedule, orgDefaultSchedule])

    // Pause on close, resume on open — avoids playing audio/video for a
    // closed shop and avoids re-triggering fullscreen/autoplay issues
    useEffect(() => {
        if (isOpen === wasOpen.current) return
        wasOpen.current = isOpen

        if (!isOpen) {
            videoRef.current?.pause()
            ytPlayer.current?.pauseVideo?.()
        } else if (started) {
            if (currentTypeRef.current === 'design') {
                playSlideIndex(currentIndex.current, slidesRef.current)
            } else {
                videoRef.current?.play().catch(() => {})
                ytPlayer.current?.playVideo?.()
            }
        }
    }, [isOpen, started, playSlideIndex])

    // Pause playback if the org gets disabled mid-session (non-payment
    // after the free trial), matches the pause-on-close behavior above
    const wasDisabled = useRef(orgStatus === 'disabled')
    useEffect(() => {
        const disabled = orgStatus === 'disabled'
        if (disabled === wasDisabled.current) return
        wasDisabled.current = disabled
        if (disabled) {
            videoRef.current?.pause()
            ytPlayer.current?.pauseVideo?.()
        } else if (started && isOpen) {
            if (currentTypeRef.current === 'design') {
                playSlideIndex(currentIndex.current, slidesRef.current)
            } else {
                videoRef.current?.play().catch(() => {})
                ytPlayer.current?.playVideo?.()
            }
        }
    }, [orgStatus, started, isOpen, playSlideIndex])

    // Track connectivity via the browser's native online/offline signal —
    // this is what actually detects the outage for YouTube slides, since
    // we can't observe failures inside YouTube's cross-origin iframe
    // directly. On reconnect, nudge the YouTube player to reload the
    // current video — a stalled embed doesn't always resume cleanly on
    // its own once the network returns.
    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true)
            const slide = slidesRef.current[currentIndex.current]
            if (slide?.type === 'youtube' && slide.url) {
                const videoId = getYouTubeId(slide.url)
                if (videoId && ytPlayer.current?.loadVideoById) {
                    ytPlayer.current.loadVideoById(videoId)
                }
            }
        }
        const goOffline = () => setIsOnline(false)
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    // Track fullscreen state across browser-specific events
    useEffect(() => {
        const handleChange = () => setIsFullscreen(isFullscreenActive())
        const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
        events.forEach((e) => document.addEventListener(e, handleChange))
        return () => events.forEach((e) => document.removeEventListener(e, handleChange))
    }, [])

    const handleStart = useCallback(() => {
        setStarted(true)
        if (containerRef.current) {
            requestFullscreenSafe(containerRef.current)
        }
        // Some TV browsers block muted autoplay until a real gesture occurs — nudge playback here
        if (currentType === 'video' && videoRef.current) {
            videoRef.current.play().catch(() => {})
        }
        if (currentType === 'youtube' && ytPlayer.current?.playVideo) {
            ytPlayer.current.playVideo()
        }
    }, [currentType])

    // Poll for slide updates every 60 s; also reports a heartbeat + current
    // slide index + open/closed state so the admin dashboard can show live
    // status (including "closed for business hours", not just online/
    // offline). Fires once immediately on mount too, so status shows up
    // right away instead of waiting a full interval.
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(`/api/tv/${pin}?slide=${currentIndex.current}&open=${isOpenRef.current}`)
                if (!res.ok) return
                const { slides: fresh, scheduleMode: freshMode, schedule: freshSchedule, orgDefaultSchedule: freshOrgSchedule, orgStatus: freshOrgStatus } = await res.json()
                setSlides((prev) => {
                    if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev
                    return fresh
                })
                if (freshMode) setScheduleMode(freshMode)
                setSchedule(freshSchedule ?? null)
                setOrgDefaultSchedule(freshOrgSchedule ?? null)
                if (freshOrgStatus) setOrgStatus(freshOrgStatus)
                // A successful request to our own server is real proof of
                // connectivity — more reliable than the browser's online
                // flag (see the offline-detection note below)
                setIsOnline(true)
            } catch {
                // The fetch itself threw (not just a non-2xx response) —
                // this is the real signal we rely on for offline detection.
                // navigator.onLine/online/offline events only reflect "is
                // there any network link at all," which stays true for the
                // most common real outage (the router/ISP loses internet
                // but the TV stays connected to the local wifi AP) — that
                // case never fires those events, so relying on them alone
                // silently never triggers the YouTube fallback image
                // during exactly the outage it's meant to handle.
                setIsOnline(false)
            }
        }
        poll()
        const interval = setInterval(poll, 60_000)
        return () => clearInterval(interval)
    }, [pin])

    // Bootstrap YouTube IFrame API once
    useEffect(() => {
        if (typeof window === 'undefined') return

        const init = () => {
            if (!playerRef.current) return
            const firstYTId = getVideoIds(initialSlides)[0] ?? ''
            ytPlayer.current = new window.YT.Player(playerRef.current, {
                width: '100%',
                height: '100%',
                videoId: firstYTId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    fs: 0,
                    mute: 1,
                },
                events: {
                    onReady: () => setReady(true),
                    onStateChange: (event: { data: number }) => {
                        if (event.data === 0) advanceSlide()
                    },
                },
            })
        }

        if (window.YT && window.YT.Player) {
            init()
        } else {
            window.onYouTubeIframeAPIReady = init
            if (!document.getElementById('yt-iframe-api')) {
                const script = document.createElement('script')
                script.id = 'yt-iframe-api'
                script.src = 'https://www.youtube.com/iframe_api'
                document.head.appendChild(script)
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Initialize playback of the first slide once the YouTube API is ready,
    // regardless of its type — previously only ran for youtube slides via the
    // player's initial videoId, so a video-only screen never started playing.
    useEffect(() => {
        if (!ready || slides.length === 0) return
        if (!hasInitialized.current) {
            hasInitialized.current = true
            playSlideIndex(0, slides)
            return
        }
        if (currentIndex.current >= slides.length) {
            playSlideIndex(0, slides)
        }
    }, [slides, ready, playSlideIndex])

    // --- Disabled (free trial expired, not upgraded) — takes priority over
    // the schedule/empty-state checks below, since there's no content to
    // show regardless of hours or slide count until the account upgrades.
    if (orgStatus === 'disabled') {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
                <p className="text-lg font-medium opacity-60 mb-1">Upgrade required</p>
                <p className="text-sm opacity-30">This screen&rsquo;s free trial has ended — upgrade in the dashboard to resume playback</p>
            </div>
        )
    }

    // --- Closed (outside business hours) ---
    if (!isOpen) {
        return <div className="fixed inset-0 bg-black" />
    }

    // --- Empty state ---
    if (allSlides.length === 0) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-6 opacity-40">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                </svg>
                <p className="text-lg font-medium opacity-60 mb-1">No videos added yet</p>
                <p className="text-sm opacity-30">Go to DisplayDesk and add videos to this screen</p>
                <div className="mt-8 px-4 py-2 bg-white/10 rounded-xl font-mono text-xl tracking-widest">
                    PIN {pin}
                </div>
            </div>
        )
    }

    // --- Player ---
    const currentSlide = slides[currentIndex.current]
    const currentYouTubeId = currentType === 'youtube' && currentSlide?.url ? getYouTubeId(currentSlide.url) : null
    const showOfflineFallback = !isOnline && currentType === 'youtube' && currentYouTubeId

    return (
        <div ref={containerRef} className="fixed inset-0 bg-black">
            <div ref={playerRef} className={`w-full h-full ${currentType === 'video' || currentType === 'design' ? 'hidden' : ''}`} />
            <video
                ref={videoRef}
                className={`fixed inset-0 w-full h-full object-contain ${currentType === 'youtube' || currentType === 'design' ? 'hidden' : ''}`}
                muted
                onEnded={advanceSlide}
                onError={handleVideoError}
            />

            {/* Homegrown design slide — rendered live from structured data,
                not a pre-rendered video. Same percentage-based scaling math
                as the design editor, so what you see there matches what
                plays here exactly. */}
            {currentType === 'design' && currentSlide?.design && (
                <div
                    className="fixed inset-0"
                    style={{
                        background: currentSlide.design.background.type === 'color' ? currentSlide.design.background.value : undefined,
                        backgroundImage: currentSlide.design.background.type === 'image' ? `url(${currentSlide.design.background.url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        containerType: 'size',
                    } as React.CSSProperties}
                >
                    {currentSlide.design.elements.map((el) => {
                        const style: React.CSSProperties = {
                            position: 'absolute',
                            left: `${(el.x / CANVAS_WIDTH) * 100}%`,
                            top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
                            width: `${(el.width / CANVAS_WIDTH) * 100}%`,
                            height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        }
                        if (el.kind === 'text') {
                            return (
                                <div
                                    key={el.id}
                                    style={{
                                        ...style,
                                        fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                        color: el.color,
                                        fontWeight: el.bold ? 700 : 400,
                                        textAlign: el.align,
                                        whiteSpace: 'pre-wrap',
                                    } as React.CSSProperties}
                                >
                                    {el.text}
                                </div>
                            )
                        }
                        if (el.kind === 'image') {
                            return <DesignImageSlideshow key={el.id} el={el} style={style} />
                        }
                        if (el.kind === 'table') {
                            return (
                                <table
                                    key={el.id}
                                    style={{
                                        ...style,
                                        borderCollapse: 'collapse',
                                        fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                        color: el.color,
                                    } as React.CSSProperties}
                                >
                                    <tbody>
                                        {el.rows.map((row, r) => (
                                            <tr key={r}>
                                                {row.map((cell, c) => {
                                                    if (isMergedAway(el, r, c)) return null
                                                    const merge = findMergeAt(el, r, c)
                                                    const badgeColor = columnBadgeColor(el, c, cell)
                                                    return (
                                                        <td
                                                            key={c}
                                                            colSpan={merge?.colspan ?? 1}
                                                            style={{
                                                                border: `1px solid ${el.borderColor}`,
                                                                padding: '0.3cqh 0.6cqw',
                                                                fontWeight: r === 0 && el.headerRow ? 700 : 400,
                                                                whiteSpace: 'pre-wrap',
                                                            } as React.CSSProperties}
                                                        >
                                                            {badgeColor ? (
                                                                <span style={{ display: 'inline-block', border: `2px solid ${badgeColor}`, borderRadius: 999, padding: '2px 12px' }}>
                                                                    {cell}
                                                                </span>
                                                            ) : (
                                                                cell
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        }
                        return <div key={el.id} style={{ ...style, background: el.color }} />
                    })}
                </div>
            )}

            {/* YouTube can't play offline (streams live from YouTube's own
                servers) — show YouTube's best available thumbnail instead
                of a frozen/broken embed while connectivity is down.
                maxresdefault (1280x720) when the video actually has one,
                hqdefault (480x360) otherwise — resolved and cache-warmed
                in the effect above, since maxresdefault silently 200s with
                a tiny placeholder for videos that don't have a real one. */}
            {showOfflineFallback && (
                <img
                    src={currentYouTubeId ? (resolvedThumbs[currentYouTubeId] ?? `https://img.youtube.com/vi/${currentYouTubeId}/hqdefault.jpg`) : ''}
                    alt=""
                    className="fixed inset-0 w-full h-full object-contain bg-black"
                />
            )}

            {/* Tap-to-start overlay — fullscreen can only be requested from a real user gesture */}
            {!started && (
                <button
                    onClick={handleStart}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white cursor-pointer"
                >
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-6 opacity-80">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                    <p className="text-2xl font-semibold mb-2">Tap to start</p>
                    <p className="text-sm opacity-50">Starts fullscreen playback for this screen</p>
                </button>
            )}

            {/* Small re-enter-fullscreen affordance if fullscreen is exited mid-playback */}
            {started && !isFullscreen && (
                <button
                    onClick={handleStart}
                    className="fixed top-4 right-4 z-50 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs"
                >
                    Enter fullscreen
                </button>
            )}
        </div>
    )
}

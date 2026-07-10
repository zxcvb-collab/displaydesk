'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { resolveEffectiveSchedule, isOpenNow, type ScheduleMode, type WeekSchedule } from '@/lib/schedule'

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
    url: string
    type: 'youtube' | 'video'
}

function getVideoIds(slides: Slide[]): string[] {
    return slides
        .filter(s => s.type === 'youtube')
        .map(s => getYouTubeId(s.url))
        .filter((id): id is string => id !== null)
}

function getUploadedVideos(slides: Slide[]): string[] {
    return slides.filter(s => s.type === 'video').map(s => s.url)
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
}: {
    pin: string
    initialSlides: Slide[]
    initialScheduleMode?: ScheduleMode
    initialSchedule?: WeekSchedule | null
    initialOrgDefaultSchedule?: WeekSchedule | null
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ytPlayer = useRef<any>(null)
    const [slides, setSlides] = useState(initialSlides)
    const [ready, setReady] = useState(false)
    const [currentType, setCurrentType] = useState<'youtube' | 'video' | null>(null)
    const [started, setStarted] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const currentIndex = useRef(0)
    const hasInitialized = useRef(false)

    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(initialScheduleMode ?? 'inherit')
    const [schedule, setSchedule] = useState<WeekSchedule | null>(initialSchedule ?? null)
    const [orgDefaultSchedule, setOrgDefaultSchedule] = useState<WeekSchedule | null>(initialOrgDefaultSchedule ?? null)
    const effectiveSchedule = resolveEffectiveSchedule(scheduleMode, schedule, orgDefaultSchedule)
    const [isOpen, setIsOpen] = useState(() => isOpenNow(effectiveSchedule))
    const wasOpen = useRef(isOpen)

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

        if (slide.type === 'youtube') {
            const videoId = getYouTubeId(slide.url)
            if (videoId && ytPlayer.current) {
                ytPlayer.current.loadVideoById(videoId)
            }
        } else if (slide.type === 'video') {
            if (videoRef.current) {
                videoRef.current.src = slide.url
                videoRef.current.play().catch(() => {
                    // On error, advance to next video
                    setSlides((s) => {
                        playSlideIndex((currentIndex.current + 1) % s.length, s)
                        return s
                    })
                })
            }
        }
    }, [])

    const advanceSlide = useCallback(() => {
        setSlides((current) => {
            playSlideIndex((currentIndex.current + 1) % current.length, current)
            return current
        })
    }, [playSlideIndex])

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
            videoRef.current?.play().catch(() => {})
            ytPlayer.current?.playVideo?.()
        }
    }, [isOpen, started])

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
    // slide index so the admin dashboard can show live status. Fires once
    // immediately on mount too, so "Online" shows up right away instead of
    // waiting a full interval.
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(`/api/tv/${pin}?slide=${currentIndex.current}`)
                if (!res.ok) return
                const { slides: fresh, scheduleMode: freshMode, schedule: freshSchedule, orgDefaultSchedule: freshOrgSchedule } = await res.json()
                setSlides((prev) => {
                    if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev
                    return fresh
                })
                if (freshMode) setScheduleMode(freshMode)
                setSchedule(freshSchedule ?? null)
                setOrgDefaultSchedule(freshOrgSchedule ?? null)
            } catch {
                // silently ignore — keep playing what we have
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
    return (
        <div ref={containerRef} className="fixed inset-0 bg-black">
            <div ref={playerRef} className={`w-full h-full ${currentType === 'video' ? 'hidden' : ''}`} />
            <video
                ref={videoRef}
                className={`fixed inset-0 w-full h-full object-contain ${currentType === 'youtube' ? 'hidden' : ''}`}
                muted
                onEnded={advanceSlide}
                onError={advanceSlide}
            />

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

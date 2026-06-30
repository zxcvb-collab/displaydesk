'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

export default function TVPlayer({ pin, initialSlides }: { pin: string; initialSlides: Slide[] }) {
    const playerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ytPlayer = useRef<any>(null)
    const [slides, setSlides] = useState(initialSlides)
    const [ready, setReady] = useState(false)
    const [currentType, setCurrentType] = useState<'youtube' | 'video' | null>(null)
    const currentIndex = useRef(0)

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

    // Poll for slide updates every 60 s; update state without interrupting playback
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/tv/${pin}`)
                if (!res.ok) return
                const { slides: fresh } = await res.json()
                setSlides((prev) => {
                    if (JSON.stringify(prev) === JSON.stringify(fresh)) return prev
                    return fresh
                })
            } catch {
                // silently ignore — keep playing what we have
            }
        }, 60_000)
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

    // When slides change after initial load, keep current video but update future queue
    useEffect(() => {
        if (!ready || slides.length === 0) return
        if (currentIndex.current >= slides.length) {
            playSlideIndex(0, slides)
        }
    }, [slides, ready, playSlideIndex])

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
        <div className="fixed inset-0 bg-black">
            <div ref={playerRef} className={`w-full h-full ${currentType === 'video' ? 'hidden' : ''}`} />
            <video
                ref={videoRef}
                className={`fixed inset-0 w-full h-full object-contain ${currentType === 'youtube' ? 'hidden' : ''}`}
                muted
                onEnded={advanceSlide}
                onError={advanceSlide}
            />
        </div>
    )
}

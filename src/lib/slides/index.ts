import { emptyDesign, type DesignData } from '@/lib/design'

export type SlideType = 'youtube' | 'video' | 'design'

export type Slide = {
    url?: string
    type: SlideType
    design?: DesignData
    duration?: number
    name?: string
}

const YOUTUBE_ID_PATTERNS = [
    /youtu\.be\/([^?&#]+)/,
    /[?&]v=([^&#]+)/,
    /youtube\.com\/embed\/([^?&#]+)/,
    /youtube\.com\/shorts\/([^?&#]+)/,
]

export function getYouTubeId(url: string): string | null {
    for (const pattern of YOUTUBE_ID_PATTERNS) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

// Public storage URLs are what's persisted on slides, but the storage API
// deletes by bucket-relative path.
const STORAGE_PATH_MARKER = '/object/public/videos/'

export function extractStoragePath(publicUrl: string): string | null {
    const idx = publicUrl.indexOf(STORAGE_PATH_MARKER)
    if (idx === -1) return null
    return decodeURIComponent(publicUrl.slice(idx + STORAGE_PATH_MARKER.length))
}

/** Bucket-relative paths of every uploaded video file referenced by these slides. */
export function videoStoragePaths(slides: Slide[]): string[] {
    return slides
        .filter((slide) => slide.type === 'video' && slide.url)
        .map((slide) => extractStoragePath(slide.url!))
        .filter((path): path is string => path !== null)
}

/**
 * Coerces the raw `slides` JSON column into Slides. Rows saved before the
 * slide-object format hold plain YouTube URL strings, and design slides
 * saved before a given design field existed may be missing it.
 */
export function normalizeSlides(raw: unknown): Slide[] {
    if (!Array.isArray(raw)) return []
    return raw.map((slide) => {
        if (typeof slide === 'string') return { url: slide, type: 'youtube' as const }
        if (typeof slide === 'object' && slide !== null && 'type' in slide) {
            const s = slide as Slide
            if (s.type === 'design') {
                return { type: 'design' as const, design: s.design ?? emptyDesign(), duration: s.duration, name: s.name }
            }
            if ('url' in s) return s
        }
        return { url: '', type: 'youtube' as const }
    })
}

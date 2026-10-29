'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import WeekScheduleEditor from '@/components/week-schedule-editor'
import { emptySchedule, type ScheduleMode, type WeekSchedule } from '@/lib/schedule'
import type { DesignData } from '@/lib/design'

type Slide = {
    url?: string
    type: 'youtube' | 'video' | 'design' | 'image'
    design?: DesignData
    duration?: number
    name?: string
    offlineImage?: string
}

type Screen = {
    id: string
    name: string
    pin: string
    slides: Slide[]
    schedule_mode?: ScheduleMode
    schedule?: WeekSchedule | null
}

type ActivityEntry = {
    id: string
    action: 'upload' | 'delete'
    detail: string | null
    actor_email: string | null
    created_at: string
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

async function patchScreen(id: string, updates: { name?: string; slides?: Slide[]; schedule_mode?: ScheduleMode; schedule?: WeekSchedule | null }) {
    const res = await fetch(`/api/screens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to save')
}

// supabase-js's upload() exposes no progress, so videos go through a signed
// upload URL via XHR instead (same endpoint/format uploadToSignedUrl uses).
// Resolves 'ok', 'cancelled', or a human-readable failure message.
const DEFAULT_IMAGE_SLIDE_SECONDS = 8

function putWithProgress(
    url: string,
    file: File,
    headers: Record<string, string>,
    onProgress: (pct: number) => void,
    xhrRef: { current: XMLHttpRequest | null }
): Promise<'ok' | 'cancelled' | string> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhrRef.current = xhr
        xhr.open('PUT', url)
        Object.entries(headers).forEach(([k, v]) => v && xhr.setRequestHeader(k, v))
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) return resolve('ok')
            let detail = ''
            try { detail = JSON.parse(xhr.responseText)?.message ?? '' } catch {}
            if (xhr.status === 413 || /exceeded the maximum allowed size/i.test(detail)) {
                return resolve(`This file is too large to upload (${(file.size / 1024 / 1024).toFixed(0)} MB). Try compressing the video or exporting at a lower quality.`)
            }
            resolve(detail || `Upload failed (error ${xhr.status})`)
        }
        xhr.onerror = () => resolve('Upload failed — check the internet connection and try again.')
        xhr.ontimeout = () => resolve('Upload timed out — check the internet connection and try again.')
        xhr.onabort = () => resolve('cancelled')
        const body = new FormData()
        body.append('cacheControl', '31536000')
        body.append('', file)
        xhr.send(body)
    })
}

function extractStoragePath(publicUrl: string): string | null {
    const marker = '/object/public/videos/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(publicUrl.slice(idx + marker.length))
}

export default function ScreenEditor({
    screen,
    orgId,
    orgDefaultSchedule,
}: {
    screen: Screen
    orgId: string
    orgDefaultSchedule: WeekSchedule | null
}) {
    const router = useRouter()
    const supabase = createClient()
    const [name, setName] = useState(screen.name)
    const [slides, setSlides] = useState<Slide[]>(screen.slides ?? [])
    const [urlInput, setUrlInput] = useState('')
    const [urlError, setUrlError] = useState('')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(screen.schedule_mode ?? 'inherit')
    const [schedule, setSchedule] = useState<WeekSchedule>(screen.schedule ?? emptySchedule())
    const [scheduleSaving, setScheduleSaving] = useState(false)
    const [scheduleSaved, setScheduleSaved] = useState(false)
    const nameRef = useRef(screen.name)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadProgress, setUploadProgress] = useState<number | null>(null)
    const [uploadFileName, setUploadFileName] = useState('')
    const [uploadDone, setUploadDone] = useState('')
    const [imageUploading, setImageUploading] = useState(false)
    const [imageError, setImageError] = useState('')
    const imageInputRef = useRef<HTMLInputElement>(null)
    const [uploadError, setUploadError] = useState('')
    const uploadXhr = useRef<XMLHttpRequest | null>(null)
    const offlineInputRef = useRef<HTMLInputElement>(null)
    const offlineTargetIndex = useRef(-1)
    const [offlineUploading, setOfflineUploading] = useState<number | null>(null)
    const [activity, setActivity] = useState<ActivityEntry[]>([])
    const actorEmailRef = useRef('')

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser()
            actorEmailRef.current = user?.email ?? ''

            const { data } = await supabase
                .from('screen_activity')
                .select('*')
                .eq('screen_id', screen.id)
                .order('created_at', { ascending: false })
            setActivity(data ?? [])
        })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen.id])

    async function logActivity(action: ActivityEntry['action'], detail: string) {
        const { data } = await supabase
            .from('screen_activity')
            .insert({
                screen_id: screen.id,
                org_id: orgId,
                action,
                detail,
                actor_email: actorEmailRef.current,
            })
            .select()
            .single()
        if (data) setActivity((prev) => [data, ...prev])
    }

    async function saveName() {
        if (name === nameRef.current) return
        nameRef.current = name
        await patchScreen(screen.id, { name })
    }

    async function updateSlides(next: Slide[]) {
        setSlides(next)
        setSaving(true)
        try {
            await patchScreen(screen.id, { slides: next })
        } finally {
            setSaving(false)
        }
    }

    async function saveSchedule() {
        setScheduleSaving(true)
        setScheduleSaved(false)
        try {
            await patchScreen(screen.id, {
                schedule_mode: scheduleMode,
                schedule: scheduleMode === 'custom' ? schedule : null,
            })
            setScheduleSaved(true)
        } finally {
            setScheduleSaving(false)
        }
    }

    function addSlide() {
        setUrlError('')
        const trimmed = urlInput.trim()
        if (!trimmed) return
        if (!getYouTubeId(trimmed)) {
            setUrlError('Please enter a valid YouTube URL')
            return
        }
        updateSlides([...slides, { url: trimmed, type: 'youtube' }])
        logActivity('upload', trimmed)
        setUrlInput('')
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        setUploadError('')
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('video/')) {
            setUploadError('Please select a video file')
            return
        }

        setUploading(true)
        setUploadProgress(0)
        setUploadFileName(file.name)
        setUploadDone('')
        try {
            const ext = file.name.split('.').pop() || 'mp4'
            const path = `${orgId}/${screen.id}/${Date.now()}.${ext}`

            const { data: signed, error: signError } = await supabase.storage
                .from('videos')
                .createSignedUploadUrl(path)
            if (signError || !signed) {
                setUploadError(signError?.message || 'Could not start the upload')
                return
            }
            const { data: { session } } = await supabase.auth.getSession()

            const result = await putWithProgress(
                signed.signedUrl,
                file,
                { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
                (pct) => setUploadProgress(pct),
                uploadXhr
            )
            if (result === 'cancelled') {
                setUploadError('Upload cancelled')
                return
            }
            if (result !== 'ok') {
                setUploadError(result)
                return
            }

            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path)
            updateSlides([...slides, { url: urlData.publicUrl, type: 'video' }])
            logActivity('upload', file.name)
            setUploadDone(file.name)
        } finally {
            setUploading(false)
            setUploadProgress(null)
            uploadXhr.current = null
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleImageSlideUpload(e: React.ChangeEvent<HTMLInputElement>) {
        setImageError('')
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setImageError('Please select an image file')
            return
        }
        setImageUploading(true)
        try {
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `${orgId}/${screen.id}/slide-images/${Date.now()}.${ext}`
            const { data, error } = await supabase.storage
                .from('videos')
                .upload(path, file, { upsert: false, cacheControl: '31536000' })
            if (error) {
                setImageError(error.message || 'Upload failed')
                return
            }
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(data.path)
            updateSlides([...slides, { url: urlData.publicUrl, type: 'image', duration: DEFAULT_IMAGE_SLIDE_SECONDS, name: file.name }])
            logActivity('upload', file.name)
        } finally {
            setImageUploading(false)
            if (imageInputRef.current) imageInputRef.current.value = ''
        }
    }

    function setSlideDuration(index: number, seconds: number) {
        updateSlides(slides.map((s, i) => (i === index ? { ...s, duration: Math.max(2, seconds || DEFAULT_IMAGE_SLIDE_SECONDS) } : s)))
    }

    async function removeSlide(index: number) {
        const slide = slides[index]

        if (slide.type === 'video' && slide.url) {
            const confirmed = confirm(
                'This will permanently delete the uploaded video file from storage. This cannot be undone. Continue?'
            )
            if (!confirmed) return

            const path = extractStoragePath(slide.url)
            if (path) {
                const { error } = await supabase.storage.from('videos').remove([path])
                if (error) {
                    setUrlError(`Failed to delete video file: ${error.message}`)
                    return
                }
            }
        }

        if (slide.type === 'image' && slide.url) {
            if (!confirm('This will permanently delete the uploaded image from storage. This cannot be undone. Continue?')) return
            await deleteStoredFile(slide.url)
        }
        await deleteStoredFile(slide.offlineImage)
        updateSlides(slides.filter((_, i) => i !== index))
        logActivity('delete', slide.url ?? 'design slide')
    }

    async function deleteStoredFile(publicUrl: string | undefined) {
        const path = extractStoragePath(publicUrl ?? '')
        if (path) await supabase.storage.from('videos').remove([path])
    }

    async function handleOfflineImage(e: React.ChangeEvent<HTMLInputElement>) {
        const index = offlineTargetIndex.current
        const file = e.target.files?.[0]
        if (!file || index < 0) return
        setUrlError('')
        if (!file.type.startsWith('image/')) {
            setUrlError('Please select an image file')
            return
        }
        setOfflineUploading(index)
        try {
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `${orgId}/${screen.id}/offline-images/${Date.now()}.${ext}`
            const { data, error } = await supabase.storage
                .from('videos')
                .upload(path, file, { upsert: false, cacheControl: '31536000' })
            if (error) {
                setUrlError(error.message || 'Upload failed')
                return
            }
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(data.path)
            await deleteStoredFile(slides[index]?.offlineImage)
            updateSlides(slides.map((s, i) => (i === index ? { ...s, offlineImage: urlData.publicUrl } : s)))
        } finally {
            setOfflineUploading(null)
            if (offlineInputRef.current) offlineInputRef.current.value = ''
        }
    }

    async function removeOfflineImage(index: number) {
        await deleteStoredFile(slides[index]?.offlineImage)
        updateSlides(slides.map((s, i) => {
            if (i !== index) return s
            const { offlineImage: _removed, ...rest } = s
            return rest
        }))
    }

    function moveSlide(index: number, direction: -1 | 1) {
        const next = [...slides]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        updateSlides(next)
    }

    async function deleteScreen() {
        const videoSlides = slides.filter((s) => s.type === 'video' || s.type === 'image')
        const message = videoSlides.length > 0
            ? `Delete this screen? This will also permanently delete ${videoSlides.length} uploaded file${videoSlides.length > 1 ? 's' : ''} from storage. This cannot be undone.`
            : 'Delete this screen? This cannot be undone.'

        if (!confirm(message)) return

        setDeleting(true)
        try {
            const paths = [
                ...videoSlides.map((s) => extractStoragePath(s.url ?? '')),
                ...slides.map((s) => extractStoragePath(s.offlineImage ?? '')),
            ].filter((p): p is string => p !== null)
            if (paths.length > 0) {
                await supabase.storage.from('videos').remove(paths)
            }

            await fetch(`/api/screens/${screen.id}`, { method: 'DELETE' })
            router.push('/dashboard')
            router.refresh()
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div className="flex-1 min-w-0">
                    <Link
                        href="/dashboard"
                        className="text-sm text-zinc-400 hover:text-zinc-700 mb-3 inline-block"
                    >
                        ← Screens
                    </Link>
                    <input
                        className="text-2xl font-bold tracking-tight text-zinc-900 bg-transparent border-0 border-b-2 border-transparent focus:border-zinc-300 focus:outline-none w-full max-w-sm transition-colors"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onBlur={saveName}
                        placeholder="Untitled screen"
                    />
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0 mt-7">
                    <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                        PIN {screen.pin}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={deleteScreen}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting…' : 'Delete screen'}
                    </Button>
                </div>
            </div>

            {/* TV setup instructions */}
            <div className="bg-zinc-900 text-white rounded-2xl p-4 mb-8 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium mb-0.5">TV setup</p>
                    <p className="text-sm text-zinc-400">
                        On the TV, bookmark <span className="font-mono text-white">displaydesk.vercel.app/tv</span> and enter PIN <span className="font-mono text-white">{screen.pin}</span>
                    </p>
                </div>
            </div>

            {/* Slides */}
            <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900">Videos</h2>
                {saving && <span className="text-xs text-zinc-400">Saving…</span>}
            </div>

            {slides.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-zinc-200 rounded-2xl bg-white mb-6">
                    <p className="font-medium text-zinc-900 mb-1">No videos yet</p>
                    <p className="text-sm text-zinc-500">Add a YouTube URL below to get started</p>
                </div>
            )}

            {slides.length > 0 && (
                <div className="space-y-3 mb-6">
                    {slides.map((slide, i) => {
                        const videoId = slide.type === 'youtube' && slide.url ? getYouTubeId(slide.url) : null
                        const isUploaded = slide.type === 'video'
                        const isDesign = slide.type === 'design'
                        const isImage = slide.type === 'image'
                        return (
                            <div
                                key={i}
                                className="bg-white border border-zinc-200 rounded-2xl p-3"
                            >
                                <div className="flex items-center gap-3">
                                    {videoId ? (
                                        <img
                                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                            alt=""
                                            className="w-24 h-14 object-cover rounded-lg shrink-0 bg-zinc-100"
                                        />
                                    ) : isImage && slide.url ? (
                                        <img src={slide.url} alt="" className="w-24 h-14 object-cover rounded-lg shrink-0 bg-zinc-100" />
                                    ) : isUploaded ? (
                                        <div className="w-24 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shrink-0 flex items-center justify-center">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                        </div>
                                    ) : isDesign ? (
                                        <div
                                            className="w-24 h-14 rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
                                            style={{ background: slide.design?.background.type === 'color' ? slide.design.background.value : '#27272a' }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 12h8M8 8h5M8 16h3" /></svg>
                                        </div>
                                    ) : (
                                        <div className="w-24 h-14 bg-zinc-100 rounded-lg shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-zinc-600 truncate font-mono">
                                            {isDesign
                                                ? slide.name || `Design (${slide.design?.elements.length ?? 0} elements)`
                                                : isImage
                                                    ? slide.name || 'Image'
                                                    : slide.url}
                                        </p>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            {slide.type === 'youtube' ? 'YouTube' : slide.type === 'video' ? 'Uploaded' : slide.type === 'image' ? 'Image' : 'Design'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isImage && (
                                            <label className="flex items-center gap-1 mr-1 text-xs text-zinc-400">
                                                <input
                                                    type="number"
                                                    min={2}
                                                    defaultValue={slide.duration ?? DEFAULT_IMAGE_SLIDE_SECONDS}
                                                    onBlur={(e) => setSlideDuration(i, Number(e.target.value))}
                                                    aria-label="Seconds on screen"
                                                    className="w-14 px-1.5 py-1 border border-zinc-200 rounded-md text-xs text-zinc-700"
                                                />
                                                sec
                                            </label>
                                        )}
                                        {isDesign && (
                                            <Link
                                                href={`/screens/${screen.id}/design/${i}`}
                                                className="px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 text-xs font-medium"
                                            >
                                                Edit
                                            </Link>
                                        )}
                                        <button
                                            onClick={() => moveSlide(i, -1)}
                                            disabled={i === 0}
                                            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 text-zinc-500"
                                            title="Move up"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 15l-6-6-6 6" /></svg>
                                        </button>
                                        <button
                                            onClick={() => moveSlide(i, 1)}
                                            disabled={i === slides.length - 1}
                                            className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-30 text-zinc-500"
                                            title="Move down"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                                        </button>
                                        <button
                                            onClick={() => removeSlide(i)}
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"
                                            title="Remove"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {(videoId || isUploaded) && (
                                    <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-3">
                                        {slide.offlineImage ? (
                                            <img src={slide.offlineImage} alt="" className="w-16 h-9 object-cover rounded-md bg-zinc-100 shrink-0" />
                                        ) : null}
                                        <p className="flex-1 text-xs text-zinc-400">
                                            {slide.offlineImage
                                                ? 'Your image shows on the TV if this video fails to load or the internet drops.'
                                                : videoId
                                                    ? 'If this video fails or the internet drops, the TV skips ahead (or shows YouTube’s soft 1280×720 thumbnail when offline). Upload a 1920×1080 image to show instead.'
                                                    : 'If this video fails to load, the TV skips to the next slide. Upload a 1920×1080 image to show instead.'}
                                        </p>
                                        <button
                                            onClick={() => { offlineTargetIndex.current = i; offlineInputRef.current?.click() }}
                                            disabled={offlineUploading === i}
                                            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-medium shrink-0 disabled:opacity-50"
                                        >
                                            {offlineUploading === i ? 'Uploading…' : slide.offlineImage ? 'Replace' : 'Upload image'}
                                        </button>
                                        {slide.offlineImage && (
                                            <button
                                                onClick={() => removeOfflineImage(i)}
                                                className="text-xs text-zinc-400 hover:text-red-500 shrink-0"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <input ref={offlineInputRef} type="file" accept="image/*" onChange={handleOfflineImage} className="hidden" />

            {/* Add slide */}
            <div className="space-y-4">
                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-3">Add a YouTube video</p>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={urlInput}
                            onChange={e => { setUrlInput(e.target.value); setUrlError('') }}
                            onKeyDown={e => e.key === 'Enter' && addSlide()}
                            className="flex-1"
                        />
                        <Button onClick={addSlide}>Add</Button>
                    </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-3">Or upload a video file</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading…' : 'Choose video file'}
                    </Button>

                    {uploading && uploadProgress !== null && (
                        <div className="mt-3" role="status" aria-live="polite">
                            <div className="flex items-center justify-between gap-3 text-xs text-zinc-600 mb-1.5">
                                <span className="truncate">{uploadFileName}</span>
                                <span className="tabular-nums shrink-0">
                                    {uploadProgress >= 100 ? 'Finishing up…' : `${uploadProgress}%`}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-zinc-900 transition-[width] duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <p className="text-xs text-zinc-400">Keep this page open until the upload finishes.</p>
                                <button
                                    onClick={() => uploadXhr.current?.abort()}
                                    className="text-xs text-zinc-400 hover:text-red-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    {!uploading && uploadDone && !uploadError && (
                        <p className="mt-3 text-xs text-green-700" role="status">Uploaded {uploadDone}</p>
                    )}
                    {!uploading && uploadError && (
                        <p className="mt-3 text-sm text-red-600" role="alert">{uploadError}</p>
                    )}
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-1">Or upload an image</p>
                    <p className="text-xs text-zinc-500 mb-3">
                        For menus that are just a picture — a 1920×1080 image fills the screen. Set how long it stays up after adding it.
                    </p>
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSlideUpload}
                        disabled={imageUploading}
                        className="hidden"
                    />
                    <Button onClick={() => imageInputRef.current?.click()} disabled={imageUploading}>
                        {imageUploading ? 'Uploading…' : 'Choose image'}
                    </Button>
                    {imageError && <p className="mt-3 text-sm text-red-600" role="alert">{imageError}</p>}
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-1">Build a menu board here</p>
                    <p className="text-xs text-zinc-500 mb-3">
                        Design text, images, and backgrounds directly — no video export needed, updates instantly.
                    </p>
                    <Button asChild>
                        <Link href={`/screens/${screen.id}/design/new`}>Create a design</Link>
                    </Button>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                    <p className="text-sm font-medium text-zinc-700 mb-1">Or design your menu in Canva</p>
                    <p className="text-xs text-zinc-500 mb-3">
                        Opens Canva in a new tab. When you&rsquo;re done, export as MP4 and upload it above.
                    </p>
                    <Button asChild variant="outline">
                        <a href="https://www.canva.com/create/videos/" target="_blank" rel="noopener noreferrer">
                            Open Canva
                        </a>
                    </Button>
                </div>

                {urlError && <p className="text-sm text-red-600">{urlError}</p>}
            </div>

            {/* Schedule */}
            <div className="mt-8">
                <h2 className="font-semibold text-zinc-900 mb-1">Schedule</h2>
                <p className="text-sm text-zinc-500 mb-4">
                    Outside open hours, this TV shows a black screen instead of playing content.
                </p>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-4 space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name="schedule_mode"
                            checked={scheduleMode === 'always_on'}
                            onChange={() => setScheduleMode('always_on')}
                        />
                        Always on
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name="schedule_mode"
                            checked={scheduleMode === 'inherit'}
                            onChange={() => setScheduleMode('inherit')}
                        />
                        Use business hours
                        {!orgDefaultSchedule && (
                            <span className="text-xs text-zinc-400">(not set — see dashboard)</span>
                        )}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="radio"
                            name="schedule_mode"
                            checked={scheduleMode === 'custom'}
                            onChange={() => setScheduleMode('custom')}
                        />
                        Custom hours for this screen
                    </label>
                </div>

                {scheduleMode === 'custom' && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-4">
                        <WeekScheduleEditor value={schedule} onChange={setSchedule} />
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <Button onClick={saveSchedule} disabled={scheduleSaving} size="sm">
                        {scheduleSaving ? 'Saving…' : 'Save schedule'}
                    </Button>
                    {scheduleSaved && <span className="text-xs text-zinc-400">Saved</span>}
                </div>
            </div>

            {/* Activity log */}
            <div className="mt-8">
                <h2 className="font-semibold text-zinc-900 mb-4">Activity</h2>
                {activity.length === 0 ? (
                    <p className="text-sm text-zinc-400">No activity yet</p>
                ) : (
                    <div className="space-y-2">
                        {activity.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-center gap-3 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm"
                            >
                                <Badge variant={entry.action === 'upload' ? 'default' : 'outline'} className="shrink-0">
                                    {entry.action === 'upload' ? 'Added' : 'Deleted'}
                                </Badge>
                                <span className="text-zinc-600 truncate flex-1 min-w-0 font-mono text-xs">
                                    {entry.detail}
                                </span>
                                <span className="text-zinc-400 text-xs shrink-0">
                                    {entry.actor_email}
                                </span>
                                <span className="text-zinc-400 text-xs shrink-0">
                                    {new Date(entry.created_at).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

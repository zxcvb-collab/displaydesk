'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type Slide = {
    url: string
    type: 'youtube' | 'video'
}

type Screen = {
    id: string
    name: string
    pin: string
    slides: Slide[]
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

async function patchScreen(id: string, updates: { name?: string; slides?: Slide[] }) {
    const res = await fetch(`/api/screens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to save')
}

function extractStoragePath(publicUrl: string): string | null {
    const marker = '/object/public/videos/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(publicUrl.slice(idx + marker.length))
}

export default function ScreenEditor({ screen, orgId }: { screen: Screen; orgId: string }) {
    const router = useRouter()
    const supabase = createClient()
    const [name, setName] = useState(screen.name)
    const [slides, setSlides] = useState<Slide[]>(screen.slides ?? [])
    const [urlInput, setUrlInput] = useState('')
    const [urlError, setUrlError] = useState('')
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const nameRef = useRef(screen.name)
    const fileInputRef = useRef<HTMLInputElement>(null)

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

    function addSlide() {
        setUrlError('')
        const trimmed = urlInput.trim()
        if (!trimmed) return
        if (!getYouTubeId(trimmed)) {
            setUrlError('Please enter a valid YouTube URL')
            return
        }
        updateSlides([...slides, { url: trimmed, type: 'youtube' }])
        setUrlInput('')
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        setUrlError('')
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('video/')) {
            setUrlError('Please select a video file')
            return
        }

        setUploading(true)
        try {
            const ext = file.name.split('.').pop() || 'mp4'
            const path = `${orgId}/${screen.id}/${Date.now()}.${ext}`

            const { data, error } = await supabase.storage
                .from('videos')
                .upload(path, file, { upsert: false })

            if (error) {
                setUrlError(error.message || 'Upload failed')
                return
            }

            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(data.path)
            updateSlides([...slides, { url: urlData.publicUrl, type: 'video' }])
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function removeSlide(index: number) {
        const slide = slides[index]

        if (slide.type === 'video') {
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

        updateSlides(slides.filter((_, i) => i !== index))
    }

    function moveSlide(index: number, direction: -1 | 1) {
        const next = [...slides]
        const target = index + direction
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        updateSlides(next)
    }

    async function deleteScreen() {
        const videoSlides = slides.filter((s) => s.type === 'video')
        const message = videoSlides.length > 0
            ? `Delete this screen? This will also permanently delete ${videoSlides.length} uploaded video file${videoSlides.length > 1 ? 's' : ''} from storage. This cannot be undone.`
            : 'Delete this screen? This cannot be undone.'

        if (!confirm(message)) return

        setDeleting(true)
        try {
            const paths = videoSlides
                .map((s) => extractStoragePath(s.url))
                .filter((p): p is string => p !== null)
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
                        const videoId = slide.type === 'youtube' ? getYouTubeId(slide.url) : null
                        const isUploaded = slide.type === 'video'
                        return (
                            <div
                                key={i}
                                className="flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl p-3"
                            >
                                {videoId ? (
                                    <img
                                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                        alt=""
                                        className="w-24 h-14 object-cover rounded-lg shrink-0 bg-zinc-100"
                                    />
                                ) : isUploaded ? (
                                    <div className="w-24 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shrink-0 flex items-center justify-center">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                    </div>
                                ) : (
                                    <div className="w-24 h-14 bg-zinc-100 rounded-lg shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-zinc-600 truncate font-mono">{slide.url}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">{slide.type === 'youtube' ? 'YouTube' : 'Uploaded'}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
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
                        )
                    })}
                </div>
            )}

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
                    <div className="flex gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="video/*"
                            onChange={handleFileUpload}
                            disabled={uploading}
                            className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                        />
                        <Button disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</Button>
                    </div>
                </div>

                {urlError && <p className="text-sm text-red-600">{urlError}</p>}
            </div>
        </div>
    )
}

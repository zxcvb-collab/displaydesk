'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    newTextElement,
    newRectElement,
    newImageElement,
    type DesignData,
    type DesignElement,
    type TextElement,
} from '@/lib/design'

type Slide = {
    url?: string
    type: 'youtube' | 'video' | 'design'
    design?: DesignData
    duration?: number
}

export default function DesignEditor({
    screenId,
    orgId,
    slideIndex,
    initialDesign,
    initialDuration,
}: {
    screenId: string
    orgId: string
    slideIndex: number
    initialDesign: DesignData
    initialDuration: number
}) {
    const router = useRouter()
    const supabase = createClient()
    const canvasRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bgFileInputRef = useRef<HTMLInputElement>(null)
    const pendingImageTarget = useRef<'background' | 'element'>('element')

    const [design, setDesign] = useState<DesignData>(initialDesign)
    const [duration, setDuration] = useState(initialDuration)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editingTextId, setEditingTextId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [error, setError] = useState('')

    const selected = design.elements.find((e) => e.id === selectedId) ?? null

    function updateElement(id: string, patch: Partial<DesignElement>) {
        setDesign((d) => ({
            ...d,
            elements: d.elements.map((e) => (e.id === id ? { ...e, ...patch } as DesignElement : e)),
        }))
    }

    function addElement(el: DesignElement) {
        setDesign((d) => ({ ...d, elements: [...d.elements, el] }))
        setSelectedId(el.id)
    }

    function removeSelected() {
        if (!selectedId) return
        setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== selectedId) }))
        setSelectedId(null)
    }

    function moveLayer(direction: -1 | 1) {
        if (!selectedId) return
        setDesign((d) => {
            const idx = d.elements.findIndex((e) => e.id === selectedId)
            const target = idx + direction
            if (target < 0 || target >= d.elements.length) return d
            const next = [...d.elements]
            ;[next[idx], next[target]] = [next[target], next[idx]]
            return { ...d, elements: next }
        })
    }

    // --- Drag & resize (pointer events, canvas-unit math via container rect) ---
    const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
    const resizeState = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)

    const onElementPointerDown = useCallback((e: React.PointerEvent, el: DesignElement) => {
        e.stopPropagation()
        setSelectedId(el.id)
        dragState.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y }
    }, [])

    const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, el: DesignElement) => {
        e.stopPropagation()
        resizeState.current = { id: el.id, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height }
    }, [])

    useEffect(() => {
        function onMove(e: PointerEvent) {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (!rect) return

            if (dragState.current) {
                const { id, startX, startY, origX, origY } = dragState.current
                const dx = ((e.clientX - startX) / rect.width) * CANVAS_WIDTH
                const dy = ((e.clientY - startY) / rect.height) * CANVAS_HEIGHT
                updateElement(id, { x: Math.round(origX + dx), y: Math.round(origY + dy) })
            }
            if (resizeState.current) {
                const { id, startX, startY, origW, origH } = resizeState.current
                const dw = ((e.clientX - startX) / rect.width) * CANVAS_WIDTH
                const dh = ((e.clientY - startY) / rect.height) * CANVAS_HEIGHT
                updateElement(id, { width: Math.max(40, Math.round(origW + dw)), height: Math.max(40, Math.round(origH + dh)) })
            }
        }
        function onUp() {
            dragState.current = null
            resizeState.current = null
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // --- Image upload (background or element) ---
    async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file')
            return
        }

        setUploadingImage(true)
        setError('')
        try {
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `${orgId}/${screenId}/design-images/${Date.now()}.${ext}`
            const { data, error: uploadError } = await supabase.storage
                .from('videos')
                .upload(path, file, { upsert: false, cacheControl: '31536000' })

            if (uploadError) {
                setError(uploadError.message)
                return
            }
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(data.path)

            if (pendingImageTarget.current === 'background') {
                setDesign((d) => ({ ...d, background: { type: 'image', url: urlData.publicUrl } }))
            } else {
                addElement(newImageElement(urlData.publicUrl))
            }
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (bgFileInputRef.current) bgFileInputRef.current.value = ''
        }
    }

    // --- Save: fetch current slides fresh (this page doesn't share state
    // with the main screen editor), splice in this design at slideIndex ---
    async function save() {
        setSaving(true)
        setError('')
        try {
            const { data: screen, error: fetchError } = await supabase
                .from('screens')
                .select('slides')
                .eq('id', screenId)
                .single()

            if (fetchError || !screen) {
                setError('Could not load current slides — try again')
                return
            }

            const slides: Slide[] = Array.isArray(screen.slides) ? screen.slides : []
            const nextSlide: Slide = { type: 'design', design, duration }
            const nextSlides = [...slides]
            if (slideIndex < nextSlides.length) {
                nextSlides[slideIndex] = nextSlide
            } else {
                nextSlides.push(nextSlide)
            }

            const res = await fetch(`/api/screens/${screenId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides: nextSlides }),
            })
            if (!res.ok) {
                setError('Failed to save design')
                return
            }
            router.push(`/screens/${screenId}`)
            router.refresh()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-zinc-100 flex">
            {/* Toolbar */}
            <div className="w-64 bg-white border-r border-zinc-200 p-4 flex flex-col gap-4 overflow-y-auto">
                <Link href={`/screens/${screenId}`} className="text-sm text-zinc-400 hover:text-zinc-700">
                    ← Back to screen
                </Link>

                <div>
                    <p className="text-sm font-semibold text-zinc-900 mb-2">Add element</p>
                    <div className="space-y-2">
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addElement(newTextElement())}>
                            + Text
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addElement(newRectElement())}>
                            + Shape
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            disabled={uploadingImage}
                            onClick={() => { pendingImageTarget.current = 'element'; fileInputRef.current?.click() }}
                        >
                            {uploadingImage ? 'Uploading…' : '+ Image'}
                        </Button>
                    </div>
                </div>

                <div>
                    <p className="text-sm font-semibold text-zinc-900 mb-2">Background</p>
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            type="color"
                            value={design.background.type === 'color' ? design.background.value : '#18181b'}
                            onChange={(e) => setDesign((d) => ({ ...d, background: { type: 'color', value: e.target.value } }))}
                            className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                        />
                        <span className="text-xs text-zinc-500">Background color</span>
                    </div>
                    <input ref={bgFileInputRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={uploadingImage}
                        onClick={() => { pendingImageTarget.current = 'background'; bgFileInputRef.current?.click() }}
                    >
                        Upload background image
                    </Button>
                </div>

                {selected && (
                    <div className="border-t border-zinc-200 pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-zinc-900">Selected: {selected.kind}</p>
                            <button onClick={removeSelected} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <Button variant="outline" size="xs" onClick={() => moveLayer(-1)}>Send back</Button>
                            <Button variant="outline" size="xs" onClick={() => moveLayer(1)}>Bring forward</Button>
                        </div>

                        {selected.kind === 'text' && (
                            <div className="space-y-2">
                                <textarea
                                    value={selected.text}
                                    onChange={(e) => updateElement(selected.id, { text: e.target.value })}
                                    className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                                    rows={3}
                                />
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-500 w-16">Size</label>
                                    <input
                                        type="number"
                                        value={selected.fontSize}
                                        onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) || 16 })}
                                        className="w-full px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-500 w-16">Color</label>
                                    <input
                                        type="color"
                                        value={selected.color}
                                        onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                                        className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => updateElement(selected.id, { bold: !(selected as TextElement).bold })}
                                        className={`px-2.5 py-1 rounded-lg text-sm font-bold border ${selected.bold ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
                                    >
                                        B
                                    </button>
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                        <button
                                            key={align}
                                            onClick={() => updateElement(selected.id, { align })}
                                            className={`px-2.5 py-1 rounded-lg text-xs border ${selected.align === align ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
                                        >
                                            {align}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selected.kind === 'rect' && (
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-zinc-500 w-16">Color</label>
                                <input
                                    type="color"
                                    value={selected.color}
                                    onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                                    className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="border-t border-zinc-200 pt-4">
                    <label className="text-xs text-zinc-500 block mb-1">Duration (seconds)</label>
                    <input
                        type="number"
                        min={2}
                        value={duration}
                        onChange={(e) => setDuration(Math.max(2, Number(e.target.value) || 8))}
                        className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Button onClick={save} disabled={saving} className="mt-auto">
                    {saving ? 'Saving…' : 'Save design'}
                </Button>
            </div>

            {/* Canvas */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div
                    ref={canvasRef}
                    onPointerDown={() => setSelectedId(null)}
                    className="relative bg-black shadow-2xl"
                    style={{
                        width: '100%',
                        maxWidth: `min(calc(90vh * ${(CANVAS_WIDTH / CANVAS_HEIGHT).toFixed(4)}), 100%)`,
                        aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                        containerType: 'size',
                        background: design.background.type === 'color' ? design.background.value : undefined,
                        backgroundImage: design.background.type === 'image' ? `url(${design.background.url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    } as React.CSSProperties}
                >
                    {design.elements.map((el) => {
                        const style: React.CSSProperties = {
                            position: 'absolute',
                            left: `${(el.x / CANVAS_WIDTH) * 100}%`,
                            top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
                            width: `${(el.width / CANVAS_WIDTH) * 100}%`,
                            height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
                            outline: selectedId === el.id ? '2px solid #3b82f6' : 'none',
                            cursor: 'move',
                        }

                        return (
                            <div key={el.id} style={style} onPointerDown={(e) => onElementPointerDown(e, el)}>
                                {el.kind === 'text' && (
                                    editingTextId === el.id ? (
                                        <textarea
                                            autoFocus
                                            value={el.text}
                                            onChange={(e) => updateElement(el.id, { text: e.target.value })}
                                            onBlur={() => setEditingTextId(null)}
                                            className="w-full h-full bg-transparent resize-none outline-none"
                                            style={{
                                                fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                                color: el.color,
                                                fontWeight: el.bold ? 700 : 400,
                                                textAlign: el.align,
                                            }}
                                        />
                                    ) : (
                                        <div
                                            onDoubleClick={() => setEditingTextId(el.id)}
                                            className="w-full h-full whitespace-pre-wrap"
                                            style={{
                                                fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                                color: el.color,
                                                fontWeight: el.bold ? 700 : 400,
                                                textAlign: el.align,
                                            }}
                                        >
                                            {el.text}
                                        </div>
                                    )
                                )}
                                {el.kind === 'image' && (
                                    <img src={el.url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                                )}
                                {el.kind === 'rect' && (
                                    <div className="w-full h-full" style={{ background: el.color }} />
                                )}
                                {selectedId === el.id && (
                                    <div
                                        onPointerDown={(e) => onResizeHandlePointerDown(e, el)}
                                        className="absolute -right-1.5 -bottom-1.5 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize"
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

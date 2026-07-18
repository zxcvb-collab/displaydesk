'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    DEFAULT_IMAGE_INTERVAL_SECONDS,
    newTextElement,
    newRectElement,
    newImageElement,
    newTableElement,
    imageUrls,
    cloneDesignWithFreshIds,
    type DesignData,
    type DesignElement,
    type TextElement,
    type ImageElement,
    type TableElement,
} from '@/lib/design'
import { STARTER_TEMPLATES } from '@/lib/design/starter-templates'

type Slide = {
    url?: string
    type: 'youtube' | 'video' | 'design'
    design?: DesignData
    duration?: number
    name?: string
}

type SavedTemplate = { id: string; name: string; design: DesignData }

export default function DesignEditor({
    screenId,
    orgId,
    slideIndex,
    isNew,
    initialDesign,
    initialDuration,
    initialName,
}: {
    screenId: string
    orgId: string
    slideIndex: number
    isNew: boolean
    initialDesign: DesignData
    initialDuration: number
    initialName: string
}) {
    const router = useRouter()
    const supabase = createClient()
    const canvasRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bgFileInputRef = useRef<HTMLInputElement>(null)
    const addImagesInputRef = useRef<HTMLInputElement>(null)
    const pendingImageTarget = useRef<'background' | 'element'>('element')

    const [design, setDesign] = useState<DesignData>(initialDesign)
    const [duration, setDuration] = useState(initialDuration)
    const [name, setName] = useState(initialName)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [editingTextId, setEditingTextId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [error, setError] = useState('')

    const [templates, setTemplates] = useState<SavedTemplate[]>([])
    const [showTemplatePicker, setShowTemplatePicker] = useState(isNew && design.elements.length === 0)
    const [savingTemplate, setSavingTemplate] = useState(false)

    useEffect(() => {
        fetch('/api/design-templates')
            .then((r) => r.json())
            .then((d) => setTemplates(d.templates ?? []))
            .catch(() => {})
    }, [])

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

    function applyTemplate(templateDesign: DesignData) {
        setDesign(cloneDesignWithFreshIds(templateDesign))
        setSelectedId(null)
        setShowTemplatePicker(false)
    }

    async function saveAsTemplate() {
        const templateName = window.prompt('Name this template:')
        if (!templateName || !templateName.trim()) return
        setSavingTemplate(true)
        try {
            const res = await fetch('/api/design-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: templateName.trim(), design }),
            })
            if (res.ok) {
                const { template } = await res.json()
                setTemplates((t) => [template, ...t])
            } else {
                setError('Failed to save template')
            }
        } finally {
            setSavingTemplate(false)
        }
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

    // --- Image upload (background, new element, or appending to an existing slideshow element) ---
    async function uploadImages(files: FileList): Promise<string[]> {
        const urls: string[] = []
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue
            const ext = file.name.split('.').pop() || 'jpg'
            const path = `${orgId}/${screenId}/design-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
            const { data, error: uploadError } = await supabase.storage
                .from('videos')
                .upload(path, file, { upsert: false, cacheControl: '31536000' })
            if (uploadError) {
                setError(uploadError.message)
                continue
            }
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(data.path)
            urls.push(urlData.publicUrl)
        }
        return urls
    }

    async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return
        setUploadingImage(true)
        setError('')
        try {
            const urls = await uploadImages(files)
            if (urls.length === 0) return
            if (pendingImageTarget.current === 'background') {
                setDesign((d) => ({ ...d, background: { type: 'image', url: urls[0] } }))
            } else {
                addElement(newImageElement(urls))
            }
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (bgFileInputRef.current) bgFileInputRef.current.value = ''
        }
    }

    async function handleAddMoreImages(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0 || !selected || selected.kind !== 'image') return
        setUploadingImage(true)
        setError('')
        try {
            const urls = await uploadImages(files)
            if (urls.length === 0) return
            updateElement(selected.id, { urls: [...imageUrls(selected), ...urls] })
        } finally {
            setUploadingImage(false)
            if (addImagesInputRef.current) addImagesInputRef.current.value = ''
        }
    }

    function removeImageAt(el: ImageElement, index: number) {
        const urls = imageUrls(el).filter((_, i) => i !== index)
        updateElement(el.id, { urls, url: undefined })
    }

    // --- Table editing helpers ---
    function updateTableCell(el: TableElement, r: number, c: number, value: string) {
        const rows = el.rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row))
        updateElement(el.id, { rows })
    }
    function addTableRow(el: TableElement) {
        const cols = el.rows[0]?.length ?? 2
        updateElement(el.id, { rows: [...el.rows, Array(cols).fill('')] })
    }
    function removeTableRow(el: TableElement) {
        if (el.rows.length <= 1) return
        updateElement(el.id, { rows: el.rows.slice(0, -1) })
    }
    function addTableColumn(el: TableElement) {
        updateElement(el.id, { rows: el.rows.map((row) => [...row, '']) })
    }
    function removeTableColumn(el: TableElement) {
        if ((el.rows[0]?.length ?? 0) <= 1) return
        updateElement(el.id, { rows: el.rows.map((row) => row.slice(0, -1)) })
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
            const nextSlide: Slide = { type: 'design', design, duration, name: name.trim() || undefined }
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
            {/* Template picker overlay — shown for new, empty designs */}
            {showTemplatePicker && (
                <div className="absolute inset-0 z-20 bg-black/40 flex items-center justify-center p-8">
                    <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <p className="font-semibold text-zinc-900">Start from a template?</p>
                            <button
                                onClick={() => setShowTemplatePicker(false)}
                                className="text-sm text-zinc-400 hover:text-zinc-700"
                            >
                                Start blank →
                            </button>
                        </div>

                        <p className="text-xs font-semibold text-zinc-500 mb-2">Starter templates</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            {STARTER_TEMPLATES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => applyTemplate(t.design)}
                                    className="border border-zinc-200 rounded-xl p-3 text-left hover:border-zinc-400 transition-colors"
                                >
                                    <div
                                        className="w-full aspect-video rounded-lg mb-2"
                                        style={{
                                            background: t.design.background.type === 'color' ? t.design.background.value : '#27272a',
                                        }}
                                    />
                                    <p className="text-xs font-medium text-zinc-700">{t.name}</p>
                                </button>
                            ))}
                        </div>

                        {templates.length > 0 && (
                            <>
                                <p className="text-xs font-semibold text-zinc-500 mb-2">Your saved templates</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {templates.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => applyTemplate(t.design)}
                                            className="border border-zinc-200 rounded-xl p-3 text-left hover:border-zinc-400 transition-colors"
                                        >
                                            <div
                                                className="w-full aspect-video rounded-lg mb-2"
                                                style={{
                                                    background: t.design.background.type === 'color' ? t.design.background.value : '#27272a',
                                                }}
                                            />
                                            <p className="text-xs font-medium text-zinc-700">{t.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="w-64 bg-white border-r border-zinc-200 p-4 flex flex-col gap-4 overflow-y-auto">
                <Link href={`/screens/${screenId}`} className="text-sm text-zinc-400 hover:text-zinc-700">
                    ← Back to screen
                </Link>

                <div>
                    <label className="text-xs text-zinc-500 block mb-1">Design name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Breakfast menu"
                        className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                    />
                </div>

                <div>
                    <p className="text-sm font-semibold text-zinc-900 mb-2">Add element</p>
                    <div className="space-y-2">
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addElement(newTextElement())}>
                            + Text
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addElement(newRectElement())}>
                            + Shape
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => addElement(newTableElement())}>
                            + Table
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageFile} className="hidden" />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            disabled={uploadingImage}
                            onClick={() => { pendingImageTarget.current = 'element'; fileInputRef.current?.click() }}
                        >
                            {uploadingImage ? 'Uploading…' : '+ Image(s)'}
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

                <div className="border-t border-zinc-200 pt-4 space-y-2">
                    <Button variant="outline" size="sm" className="w-full" disabled={savingTemplate} onClick={saveAsTemplate}>
                        {savingTemplate ? 'Saving…' : 'Save as template'}
                    </Button>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowTemplatePicker(true)}>
                        Load a template…
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

                        {selected.kind === 'image' && (
                            <div className="space-y-2">
                                <p className="text-xs text-zinc-500">
                                    {imageUrls(selected).length} image{imageUrls(selected).length !== 1 ? 's' : ''}
                                    {imageUrls(selected).length > 1 ? ' · slideshow' : ''}
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {imageUrls(selected).map((url, i) => (
                                        <div key={i} className="relative group">
                                            <img src={url} alt="" className="w-full aspect-square object-cover rounded-md border border-zinc-200" />
                                            <button
                                                onClick={() => removeImageAt(selected, i)}
                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-4"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <input ref={addImagesInputRef} type="file" accept="image/*" multiple onChange={handleAddMoreImages} className="hidden" />
                                <Button
                                    variant="outline"
                                    size="xs"
                                    className="w-full"
                                    disabled={uploadingImage}
                                    onClick={() => addImagesInputRef.current?.click()}
                                >
                                    + Add more images
                                </Button>
                                {imageUrls(selected).length > 1 && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-zinc-500 w-24">Switch every</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={selected.intervalSeconds ?? DEFAULT_IMAGE_INTERVAL_SECONDS}
                                            onChange={(e) => updateElement(selected.id, { intervalSeconds: Math.max(1, Number(e.target.value) || DEFAULT_IMAGE_INTERVAL_SECONDS) })}
                                            className="w-16 px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                        />
                                        <span className="text-xs text-zinc-400">sec</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {selected.kind === 'table' && (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Button variant="outline" size="xs" onClick={() => addTableRow(selected)}>+ Row</Button>
                                    <Button variant="outline" size="xs" onClick={() => removeTableRow(selected)}>− Row</Button>
                                    <Button variant="outline" size="xs" onClick={() => addTableColumn(selected)}>+ Col</Button>
                                    <Button variant="outline" size="xs" onClick={() => removeTableColumn(selected)}>− Col</Button>
                                </div>
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {selected.rows.map((row, r) => (
                                        <div key={r} className="flex gap-1">
                                            {row.map((cell, c) => (
                                                <input
                                                    key={c}
                                                    value={cell}
                                                    onChange={(e) => updateTableCell(selected, r, c, e.target.value)}
                                                    className={`w-full px-1.5 py-1 border rounded text-xs ${r === 0 && selected.headerRow ? 'font-semibold bg-zinc-50 border-zinc-300' : 'border-zinc-200'}`}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <label className="flex items-center gap-2 text-xs text-zinc-500">
                                    <input
                                        type="checkbox"
                                        checked={selected.headerRow}
                                        onChange={(e) => updateElement(selected.id, { headerRow: e.target.checked })}
                                    />
                                    First row is a header
                                </label>
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
                                    <label className="text-xs text-zinc-500 w-16">Text</label>
                                    <input
                                        type="color"
                                        value={selected.color}
                                        onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                                        className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                                    />
                                    <label className="text-xs text-zinc-500 w-16">Border</label>
                                    <input
                                        type="color"
                                        value={selected.borderColor}
                                        onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })}
                                        className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                                    />
                                </div>
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
                                    imageUrls(el).length > 0 ? (
                                        <img src={imageUrls(el)[0]} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs border border-dashed border-zinc-600">
                                            No image yet
                                        </div>
                                    )
                                )}
                                {el.kind === 'rect' && (
                                    <div className="w-full h-full" style={{ background: el.color }} />
                                )}
                                {el.kind === 'table' && (
                                    <table
                                        className="w-full h-full border-collapse"
                                        style={{
                                            fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                            color: el.color,
                                        }}
                                    >
                                        <tbody>
                                            {el.rows.map((row, r) => (
                                                <tr key={r}>
                                                    {row.map((cell, c) => (
                                                        <td
                                                            key={c}
                                                            className="px-2 py-1"
                                                            style={{
                                                                border: `1px solid ${el.borderColor}`,
                                                                fontWeight: r === 0 && el.headerRow ? 700 : 400,
                                                            }}
                                                        >
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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

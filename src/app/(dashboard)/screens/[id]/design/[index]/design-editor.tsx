'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Type, Square, Table2, Image as ImageIcon, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    DEFAULT_IMAGE_INTERVAL_SECONDS,
    FONT_FAMILY_OPTIONS,
    newTextElement,
    newRectElement,
    newImageElement,
    newTableElement,
    newPhotoWithCaptionSet,
    imageUrls,
    cloneDesignWithFreshIds,
    findMergeAt,
    isMergedAway,
    columnBadgeColor,
    cellFontSize,
    fontFamilyCssVar,
    rotatedResizeDelta,
    type DesignData,
    type DesignElement,
    type TextElement,
    type ImageElement,
    type TableElement,
    type Rotation,
    type FontFamily,
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

// Miniature, non-interactive render of a design's elements, scaled to fit
// whatever box it's placed in — used so the template picker shows what a
// layout actually looks like instead of just its background color.
function DesignThumbnail({ design }: { design: DesignData }) {
    return (
        <div
            className="relative w-full aspect-video rounded-lg overflow-hidden"
            style={{
                background: design.background.type === 'color' ? design.background.value : '#27272a',
                backgroundImage: design.background.type === 'image' ? `url(${design.background.url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                containerType: 'size',
            } as React.CSSProperties}
        >
            {design.elements.map((el) => {
                const style: React.CSSProperties = {
                    position: 'absolute',
                    left: `${(el.x / CANVAS_WIDTH) * 100}%`,
                    top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
                    width: `${(el.width / CANVAS_WIDTH) * 100}%`,
                    height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
                    overflow: 'hidden',
                    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                }
                if (el.kind === 'text') {
                    return (
                        <div
                            key={el.id}
                            style={{
                                ...style,
                                fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                fontFamily: fontFamilyCssVar(el.fontFamily),
                                color: el.color,
                                fontWeight: el.bold ? 700 : 400,
                                textAlign: el.align,
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.1,
                            } as React.CSSProperties}
                        >
                            {el.text}
                        </div>
                    )
                }
                if (el.kind === 'image') {
                    const urls = imageUrls(el)
                    return urls.length > 0 ? (
                        <img key={el.id} src={urls[0]} alt="" style={style} className="object-cover" />
                    ) : null
                }
                if (el.kind === 'table') {
                    return (
                        <table
                            key={el.id}
                            style={{
                                ...style,
                                borderCollapse: 'collapse',
                                fontSize: `${(el.fontSize / CANVAS_HEIGHT) * 100}cqh`,
                                fontFamily: fontFamilyCssVar(el.fontFamily),
                                color: el.color,
                            } as React.CSSProperties}
                        >
                            <tbody>
                                {el.rows.map((row, r) => (
                                    <tr key={r}>
                                        {row.map((cell, c) => {
                                            if (isMergedAway(el, r, c)) return null
                                            const merge = findMergeAt(el, r, c)
                                            return (
                                                <td
                                                    key={c}
                                                    colSpan={merge?.colspan ?? 1}
                                                    style={{
                                                        border: `1px solid ${el.borderColor}`,
                                                        padding: '0.2cqh 0.4cqw',
                                                        fontSize: `${(cellFontSize(el, r, c) / CANVAS_HEIGHT) * 100}cqh`,
                                                        fontWeight: r === 0 && el.headerRow ? 700 : 400,
                                                        whiteSpace: 'nowrap',
                                                    } as React.CSSProperties}
                                                >
                                                    {cell}
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
    )
}

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
    const [tableSelection, setTableSelection] = useState<{ tableId: string; row: number; anchorCol: number; endCol: number } | null>(null)

    useEffect(() => {
        fetch('/api/design-templates')
            .then((r) => r.json())
            .then((d) => setTemplates(d.templates ?? []))
            .catch(() => {})
    }, [])

    const selected = design.elements.find((e) => e.id === selectedId) ?? null

    // If any image element is a multi-image slideshow, the slide's overall
    // duration should be at least long enough for one full cycle through
    // it — otherwise the slide advances before every image has had a turn.
    const slideshowTotalSeconds = design.elements.reduce((max, el) => {
        if (el.kind !== 'image') return max
        const urls = imageUrls(el)
        if (urls.length <= 1) return max
        const total = urls.length * (el.intervalSeconds || DEFAULT_IMAGE_INTERVAL_SECONDS)
        return Math.max(max, total)
    }, 0)

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
    const resizeState = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number; rotation: Rotation } | null>(null)

    const onElementPointerDown = useCallback((e: React.PointerEvent, el: DesignElement) => {
        e.stopPropagation()
        setSelectedId(el.id)
        dragState.current = { id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y }
    }, [])

    const onResizeHandlePointerDown = useCallback((e: React.PointerEvent, el: DesignElement) => {
        e.stopPropagation()
        resizeState.current = { id: el.id, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height, rotation: el.rotation ?? 0 }
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
                const { id, startX, startY, origW, origH, rotation } = resizeState.current
                const dxCanvas = ((e.clientX - startX) / rect.width) * CANVAS_WIDTH
                const dyCanvas = ((e.clientY - startY) / rect.height) * CANVAS_HEIGHT
                const { dw, dh } = rotatedResizeDelta(dxCanvas, dyCanvas, rotation)
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
        updateElement(el.id, {
            rows: [...el.rows, Array(cols).fill('')],
            cellFontSizes: el.cellFontSizes ? [...el.cellFontSizes, Array(cols).fill(null)] : undefined,
        })
    }
    function removeTableRow(el: TableElement) {
        if (el.rows.length <= 1) return
        updateElement(el.id, {
            rows: el.rows.slice(0, -1),
            cellFontSizes: el.cellFontSizes?.slice(0, -1),
        })
    }
    function addTableColumn(el: TableElement) {
        updateElement(el.id, {
            rows: el.rows.map((row) => [...row, '']),
            columnBadges: [...(el.columnBadges ?? []), null],
            cellFontSizes: el.cellFontSizes?.map((row) => [...row, null]),
        })
    }
    function removeTableColumn(el: TableElement) {
        const cols = el.rows[0]?.length ?? 0
        if (cols <= 1) return
        const newCols = cols - 1
        updateElement(el.id, {
            rows: el.rows.map((row) => row.slice(0, -1)),
            columnBadges: (el.columnBadges ?? []).slice(0, newCols),
            cellFontSizes: el.cellFontSizes?.map((row) => row.slice(0, newCols)),
            merges: (el.merges ?? [])
                .filter((m) => m.col < newCols)
                .map((m) => ({ ...m, colspan: Math.min(m.colspan, newCols - m.col) })),
        })
    }
    function setCellFontSize(el: TableElement, row: number, col: number, size: number | null) {
        const cols = el.rows[0]?.length ?? 0
        const cellFontSizes = (el.cellFontSizes ?? el.rows.map(() => Array(cols).fill(null))).map((r) => [...r])
        cellFontSizes[row][col] = size
        updateElement(el.id, { cellFontSizes })
    }
    function setColumnBadge(el: TableElement, col: number, color: string | null) {
        const cols = el.rows[0]?.length ?? 0
        const badges = [...(el.columnBadges ?? [])]
        while (badges.length < cols) badges.push(null)
        badges[col] = color
        updateElement(el.id, { columnBadges: badges })
    }
    function mergeSelectedCells(el: TableElement) {
        if (!tableSelection || tableSelection.tableId !== el.id) return
        const { row, anchorCol, endCol } = tableSelection
        const fromCol = Math.min(anchorCol, endCol)
        const toCol = Math.max(anchorCol, endCol)
        if (toCol <= fromCol) return
        const texts: string[] = []
        for (let c = fromCol; c <= toCol; c++) {
            if (!isMergedAway(el, row, c) && el.rows[row][c]) texts.push(el.rows[row][c])
        }
        const rows = el.rows.map((r, ri) =>
            ri === row ? r.map((cell, ci) => (ci === fromCol ? texts.join(' ') : ci > fromCol && ci <= toCol ? '' : cell)) : r
        )
        const merges = (el.merges ?? []).filter((m) => {
            if (m.row !== row) return true
            const mEnd = m.col + m.colspan - 1
            return mEnd < fromCol || m.col > toCol
        })
        updateElement(el.id, { rows, merges: [...merges, { row, col: fromCol, colspan: toCol - fromCol + 1 }] })
        setTableSelection(null)
    }
    function unmergeCell(el: TableElement, row: number, col: number) {
        updateElement(el.id, { merges: (el.merges ?? []).filter((m) => !(m.row === row && m.col === col)) })
    }
    function addPhotoWithCaption() {
        const set = newPhotoWithCaptionSet()
        setDesign((d) => ({ ...d, elements: [...d.elements, ...set] }))
        setSelectedId(set[0].id)
    }
    function rotateSelected() {
        if (!selected) return
        const current = selected.rotation ?? 0
        const next = ((current + 90) % 360) as Rotation
        updateElement(selected.id, { rotation: next })
    }

    // --- Save: fetch current slides fresh (this page doesn't share state
    // with the main screen editor), splice in this design at slideIndex ---
    async function save() {
        if (slideshowTotalSeconds > duration) {
            const proceed = window.confirm(
                `This slide's image slideshow takes ${slideshowTotalSeconds}s to cycle through, but the slide duration is only ${duration}s — some images won't get shown. Save anyway?`
            )
            if (!proceed) return
        }
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
                                className="text-sm text-zinc-400 hover:text-zinc-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                                    className="border border-zinc-200 rounded-xl p-3 text-left hover:border-zinc-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                >
                                    <div className="mb-2">
                                        <DesignThumbnail design={t.design} />
                                    </div>
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
                                            className="border border-zinc-200 rounded-xl p-3 text-left hover:border-zinc-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        >
                                            <div className="mb-2">
                                                <DesignThumbnail design={t.design} />
                                            </div>
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
                    <div className="space-y-1.5">
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => addElement(newTextElement())}>
                            <Type className="size-3.5 text-zinc-400" /> Text
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => addElement(newRectElement())}>
                            <Square className="size-3.5 text-zinc-400" /> Shape
                        </Button>
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => addElement(newTableElement())}>
                            <Table2 className="size-3.5 text-zinc-400" /> Table
                        </Button>
                        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageFile} className="hidden" />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2"
                            disabled={uploadingImage}
                            onClick={() => { pendingImageTarget.current = 'element'; fileInputRef.current?.click() }}
                        >
                            <ImageIcon className="size-3.5 text-zinc-400" /> {uploadingImage ? 'Uploading…' : 'Image(s)'}
                        </Button>
                    </div>
                    <div className="mt-2 pt-2 border-t border-dashed border-zinc-200">
                        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={addPhotoWithCaption}>
                            <Camera className="size-3.5 text-zinc-400" /> Photo with caption
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

                <div className="space-y-2">
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
                            <button onClick={removeSelected} className="text-xs text-red-500 hover:text-red-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Delete</button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                            <Button variant="outline" size="xs" title="Send backward" onClick={() => moveLayer(-1)}>Back</Button>
                            <Button variant="outline" size="xs" title="Bring forward" onClick={() => moveLayer(1)}>Front</Button>
                            <Button variant="outline" size="xs" title="Rotate 90°" onClick={rotateSelected}>Rotate</Button>
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
                                    <label className="text-xs text-zinc-500 w-16">Font</label>
                                    <select
                                        value={selected.fontFamily ?? 'sans'}
                                        onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value as FontFamily })}
                                        className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                                    >
                                        {FONT_FAMILY_OPTIONS.map((f) => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
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
                                        className={`px-2.5 py-1 rounded-lg text-sm font-bold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected.bold ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
                                    >
                                        B
                                    </button>
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                        <button
                                            key={align}
                                            onClick={() => updateElement(selected.id, { align })}
                                            className={`px-2.5 py-1 rounded-lg text-xs border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selected.align === align ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600'}`}
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
                                <div className="flex flex-wrap gap-1.5">
                                    <Button variant="outline" size="xs" onClick={() => addTableRow(selected)}>+ Row</Button>
                                    <Button variant="outline" size="xs" onClick={() => removeTableRow(selected)}>− Row</Button>
                                    <Button variant="outline" size="xs" onClick={() => addTableColumn(selected)}>+ Col</Button>
                                    <Button variant="outline" size="xs" onClick={() => removeTableColumn(selected)}>− Col</Button>
                                </div>
                                <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {selected.rows.map((row, r) => (
                                        <div key={r} className="flex gap-1">
                                            {row.map((cell, c) => {
                                                if (isMergedAway(selected, r, c)) return null
                                                const merge = findMergeAt(selected, r, c)
                                                const isSelected =
                                                    tableSelection?.tableId === selected.id &&
                                                    tableSelection.row === r &&
                                                    c >= Math.min(tableSelection.anchorCol, tableSelection.endCol) &&
                                                    c <= Math.max(tableSelection.anchorCol, tableSelection.endCol)
                                                return (
                                                    <input
                                                        key={c}
                                                        value={cell}
                                                        onChange={(e) => updateTableCell(selected, r, c, e.target.value)}
                                                        onClick={(e) =>
                                                            setTableSelection((sel) =>
                                                                e.shiftKey && sel && sel.tableId === selected.id && sel.row === r
                                                                    ? { ...sel, endCol: c }
                                                                    : { tableId: selected.id, row: r, anchorCol: c, endCol: c }
                                                            )
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (!e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
                                                            e.preventDefault()
                                                            const cols = selected.rows[0]?.length ?? 1
                                                            setTableSelection((sel) => {
                                                                const base = sel && sel.tableId === selected.id && sel.row === r ? sel : { tableId: selected.id, row: r, anchorCol: c, endCol: c }
                                                                const nextEnd = Math.min(cols - 1, Math.max(0, base.endCol + (e.key === 'ArrowRight' ? 1 : -1)))
                                                                return { ...base, endCol: nextEnd }
                                                            })
                                                        }}
                                                        style={{ flexGrow: merge?.colspan ?? 1 }}
                                                        className={`flex-1 px-1.5 py-1 border rounded text-xs ${r === 0 && selected.headerRow ? 'font-semibold bg-zinc-50 border-zinc-300' : 'border-zinc-200'} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                                                    />
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        disabled={!tableSelection || tableSelection.tableId !== selected.id || tableSelection.anchorCol === tableSelection.endCol}
                                        onClick={() => mergeSelectedCells(selected)}
                                    >
                                        Merge cells
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        disabled={
                                            !tableSelection ||
                                            tableSelection.tableId !== selected.id ||
                                            !findMergeAt(selected, tableSelection.row, Math.min(tableSelection.anchorCol, tableSelection.endCol))
                                        }
                                        onClick={() =>
                                            tableSelection && unmergeCell(selected, tableSelection.row, Math.min(tableSelection.anchorCol, tableSelection.endCol))
                                        }
                                    >
                                        Unmerge
                                    </Button>
                                </div>
                                <p className="text-[11px] text-zinc-400">Click a cell, then shift-click (or shift+arrow keys) to select a range.</p>
                                <label className="flex items-center gap-2 text-xs text-zinc-500">
                                    <input
                                        type="checkbox"
                                        checked={selected.headerRow}
                                        onChange={(e) => updateElement(selected.id, { headerRow: e.target.checked })}
                                    />
                                    First row is a header
                                </label>
                                <div className="space-y-1">
                                    <p className="text-xs text-zinc-500">Column price badges</p>
                                    {(selected.rows[0] ?? []).map((_, c) => (
                                        <div key={c} className="flex items-center gap-2">
                                            <label className="text-xs text-zinc-500 w-16">Col {c + 1}</label>
                                            <input
                                                type="checkbox"
                                                checked={!!selected.columnBadges?.[c]}
                                                onChange={(e) => setColumnBadge(selected, c, e.target.checked ? '#3b82f6' : null)}
                                            />
                                            {selected.columnBadges?.[c] && (
                                                <input
                                                    type="color"
                                                    value={selected.columnBadges[c] as string}
                                                    onChange={(e) => setColumnBadge(selected, c, e.target.value)}
                                                    className="w-9 h-9 rounded border border-zinc-200 cursor-pointer"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-500 w-16">Size</label>
                                    <input
                                        type="number"
                                        value={selected.fontSize}
                                        onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) || 16 })}
                                        className="w-full px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                    />
                                </div>
                                {tableSelection && tableSelection.tableId === selected.id && tableSelection.anchorCol === tableSelection.endCol && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-zinc-500 w-16">Cell size</label>
                                        <input
                                            type="number"
                                            placeholder={String(selected.fontSize)}
                                            value={cellFontSize(selected, tableSelection.row, tableSelection.anchorCol)}
                                            onChange={(e) => {
                                                const v = e.target.value
                                                setCellFontSize(selected, tableSelection.row, tableSelection.anchorCol, v === '' ? null : Number(v) || null)
                                            }}
                                            className="w-full px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                        />
                                        <span className="text-[11px] text-zinc-400 shrink-0">selected cell</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-zinc-500 w-16">Font</label>
                                    <select
                                        value={selected.fontFamily ?? 'sans'}
                                        onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value as FontFamily })}
                                        className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                                    >
                                        {FONT_FAMILY_OPTIONS.map((f) => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
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

                <div>
                    <label className="text-xs text-zinc-500 block mb-1">Duration (seconds)</label>
                    <input
                        type="number"
                        min={2}
                        value={duration}
                        onChange={(e) => setDuration(Math.max(2, Number(e.target.value) || 8))}
                        className="w-full px-2 py-1.5 border border-zinc-300 rounded-lg text-sm"
                    />
                    {slideshowTotalSeconds > duration && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                            <p className="text-xs text-amber-800 mb-1.5">
                                This slide has an image slideshow that takes {slideshowTotalSeconds}s to cycle
                                through, longer than the {duration}s slide duration — some images may never show.
                            </p>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setDuration(slideshowTotalSeconds)}
                            >
                                Match duration to {slideshowTotalSeconds}s
                            </Button>
                        </div>
                    )}
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
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
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
                                                fontFamily: fontFamilyCssVar(el.fontFamily),
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
                                                fontFamily: fontFamilyCssVar(el.fontFamily),
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
                                            fontFamily: fontFamilyCssVar(el.fontFamily),
                                            color: el.color,
                                        }}
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
                                                                className="px-2 py-1"
                                                                style={{
                                                                    border: `1px solid ${el.borderColor}`,
                                                                    fontSize: `${(cellFontSize(el, r, c) / CANVAS_HEIGHT) * 100}cqh`,
                                                                    fontWeight: r === 0 && el.headerRow ? 700 : 400,
                                                                    whiteSpace: 'pre-wrap',
                                                                }}
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

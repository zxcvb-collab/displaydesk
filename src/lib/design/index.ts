// Homegrown alternative to the Canva export workflow: a design slide is
// structured data (background + positioned elements) that the TV player
// renders directly as HTML/CSS, not a pre-rendered video file. No export
// pipeline, no encoding, no render queue — the same architecture already
// used for everything else in the player. Content stays instantly
// editable (change a price, no re-export/re-upload) and renders crisp at
// whatever resolution the actual TV has, since nothing is baked into a
// fixed-resolution video ahead of time.
//
// Elements are positioned in a fixed 1920x1080 reference canvas; the
// player scales the whole canvas to fit the real viewport, preserving
// aspect ratio (letterboxed if the TV's aspect ratio differs).

export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080
export const DEFAULT_DURATION_SECONDS = 8
export const DEFAULT_IMAGE_INTERVAL_SECONDS = 5

// 90-degree steps only — this keeps resize math a simple axis swap
// instead of needing a full trig-based transform system.
export type Rotation = 0 | 90 | 180 | 270

export type FontFamily = 'sans' | 'serif' | 'display' | 'script'

export const FONT_FAMILY_OPTIONS: { value: FontFamily; label: string; cssVar: string }[] = [
    { value: 'sans', label: 'Sans', cssVar: 'var(--font-sans)' },
    { value: 'serif', label: 'Serif (Playfair)', cssVar: 'var(--font-menu-serif)' },
    { value: 'display', label: 'Display (Oswald)', cssVar: 'var(--font-menu-display)' },
    { value: 'script', label: 'Script (Caveat)', cssVar: 'var(--font-menu-script)' },
]

export function fontFamilyCssVar(family: FontFamily | undefined): string {
    return FONT_FAMILY_OPTIONS.find((f) => f.value === family)?.cssVar ?? 'var(--font-sans)'
}

export type TextElement = {
    id: string
    kind: 'text'
    x: number
    y: number
    width: number
    height: number
    rotation?: Rotation
    text: string
    fontSize: number
    fontFamily?: FontFamily
    color: string
    bold: boolean
    align: 'left' | 'center' | 'right'
}

// `urls` holds one or more images; when there's more than one, the player
// cycles through them on its own timer (a slideshow within this one
// element's position/size), independent of the overall slide duration.
export type ImageElement = {
    id: string
    kind: 'image'
    x: number
    y: number
    width: number
    height: number
    rotation?: Rotation
    urls: string[]
    intervalSeconds: number
    /** @deprecated old single-image shape, kept only for reading designs saved before the slideshow feature */
    url?: string
}

export type RectElement = {
    id: string
    kind: 'rect'
    x: number
    y: number
    width: number
    height: number
    rotation?: Rotation
    color: string
}

export type TableMerge = { row: number; col: number; colspan: number }

export type TableElement = {
    id: string
    kind: 'table'
    x: number
    y: number
    width: number
    height: number
    rotation?: Rotation
    rows: string[][]
    fontSize: number
    fontFamily?: FontFamily
    color: string
    borderColor: string
    headerRow: boolean
    /** Per-column pill/badge styling — index matches column index; a color string enables a badge in that column, null/undefined leaves it plain. Empty cells never get a badge. */
    columnBadges?: (string | null)[]
    /** Colspan-only cell merges. A covered (non-anchor) cell is skipped on render. */
    merges?: TableMerge[]
    /** Per-cell font size overrides, same [row][col] shape as `rows`. null/undefined falls back to the table's `fontSize`. */
    cellFontSizes?: (number | null)[][]
}

export function cellFontSize(el: TableElement, row: number, col: number): number {
    return el.cellFontSizes?.[row]?.[col] ?? el.fontSize
}

export type DesignElement = TextElement | ImageElement | RectElement | TableElement

export type DesignBackground = { type: 'color'; value: string } | { type: 'image'; url: string }

export type DesignData = {
    background: DesignBackground
    elements: DesignElement[]
}

// Reads an ImageElement of either the old (`url`) or new (`urls`) shape and
// always returns a non-empty urls array.
export function imageUrls(el: ImageElement): string[] {
    if (el.urls && el.urls.length > 0) return el.urls
    if (el.url) return [el.url]
    return []
}

export function emptyDesign(): DesignData {
    return { background: { type: 'color', value: '#18181b' }, elements: [] }
}

export function newTextElement(): TextElement {
    return {
        id: crypto.randomUUID(),
        kind: 'text',
        x: 560,
        y: 460,
        width: 800,
        height: 160,
        rotation: 0,
        text: 'Double-click to edit',
        fontSize: 64,
        color: '#ffffff',
        bold: true,
        align: 'center',
    }
}

export function newRectElement(): RectElement {
    return {
        id: crypto.randomUUID(),
        kind: 'rect',
        x: 660,
        y: 440,
        width: 600,
        height: 200,
        rotation: 0,
        color: '#27272a',
    }
}

export function newImageElement(urls: string[]): ImageElement {
    return {
        id: crypto.randomUUID(),
        kind: 'image',
        x: 560,
        y: 340,
        width: 800,
        height: 450,
        rotation: 0,
        urls,
        intervalSeconds: DEFAULT_IMAGE_INTERVAL_SECONDS,
    }
}

export function newTableElement(): TableElement {
    return {
        id: crypto.randomUUID(),
        kind: 'table',
        x: 460,
        y: 300,
        width: 1000,
        height: 480,
        rotation: 0,
        rows: [
            ['Item', 'Price'],
            ['Latte', '$4.50'],
            ['Cappuccino', '$4.75'],
            ['Espresso', '$3.00'],
        ],
        fontSize: 40,
        color: '#ffffff',
        borderColor: '#52525b',
        headerRow: true,
        columnBadges: [null, null],
        merges: [],
    }
}

// Bundles a photo region with a bottom scrim and a caption as three
// independent elements (image, rect, text) — pre-positioned as a set so
// there's no manual alignment step, but each stays freely movable/
// resizable afterward, including moving the caption off the photo.
export function newPhotoWithCaptionSet(): DesignElement[] {
    const x = 560, y = 140, width = 800, height = 650
    const scrimHeight = 140
    const image: ImageElement = {
        id: crypto.randomUUID(), kind: 'image',
        x, y, width, height, rotation: 0,
        urls: [], intervalSeconds: DEFAULT_IMAGE_INTERVAL_SECONDS,
    }
    const scrim: RectElement = {
        id: crypto.randomUUID(), kind: 'rect',
        x, y: y + height - scrimHeight, width, height: scrimHeight, rotation: 0,
        color: '#000000aa',
    }
    const caption: TextElement = {
        id: crypto.randomUUID(), kind: 'text',
        x: x + 24, y: y + height - scrimHeight + 30, width: width - 48, height: scrimHeight - 60, rotation: 0,
        text: 'Caption', fontSize: 32, color: '#ffffff', bold: true, align: 'left',
    }
    return [image, scrim, caption]
}

// Converts a mouse-drag delta (in the canvas's fixed screen frame) into
// the element's own local width/height delta, accounting for the fact
// that a rotated element's resize handle moves along with it visually
// (it's a CSS transform on the element, so the handle rotates for free)
// but dragging it still needs to grow/shrink the *local*, pre-rotation
// box in the direction the handle now visually points.
const ROT_COS: Record<Rotation, number> = { 0: 1, 90: 0, 180: -1, 270: 0 }
const ROT_SIN: Record<Rotation, number> = { 0: 0, 90: 1, 180: 0, 270: -1 }
export function rotatedResizeDelta(dx: number, dy: number, rotation: Rotation): { dw: number; dh: number } {
    const cos = ROT_COS[rotation]
    const sin = ROT_SIN[rotation]
    return { dw: dx * cos + dy * sin, dh: -dx * sin + dy * cos }
}

// Table cell merge helpers — shared by the editor canvas, the editor's
// property-panel cell grid, the TV player, and template thumbnails, so
// merge/badge rendering stays identical everywhere it's drawn.
export function findMergeAt(el: TableElement, row: number, col: number): TableMerge | undefined {
    return (el.merges ?? []).find((m) => m.row === row && m.col === col)
}

export function isMergedAway(el: TableElement, row: number, col: number): boolean {
    return (el.merges ?? []).some((m) => m.row === row && col > m.col && col < m.col + m.colspan)
}

export function columnBadgeColor(el: TableElement, col: number, cellText: string): string | null {
    const color = el.columnBadges?.[col]
    if (!color) return null
    const trimmed = cellText.trim()
    if (trimmed === '' || trimmed === '-' || trimmed === '—') return null
    return color
}

// Regenerates every element ID in a design — used whenever a design is
// loaded from a template so that repeated uses of the same template don't
// end up sharing element identity across unrelated slides.
export function cloneDesignWithFreshIds(design: DesignData): DesignData {
    return {
        background: design.background,
        elements: design.elements.map((el) => ({ ...el, id: crypto.randomUUID() })),
    }
}

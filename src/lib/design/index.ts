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

export type TextElement = {
    id: string
    kind: 'text'
    x: number
    y: number
    width: number
    height: number
    text: string
    fontSize: number
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
    color: string
}

export type TableElement = {
    id: string
    kind: 'table'
    x: number
    y: number
    width: number
    height: number
    rows: string[][]
    fontSize: number
    color: string
    borderColor: string
    headerRow: boolean
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
    }
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

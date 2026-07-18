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

export type ImageElement = {
    id: string
    kind: 'image'
    x: number
    y: number
    width: number
    height: number
    url: string
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

export type DesignElement = TextElement | ImageElement | RectElement

export type DesignBackground = { type: 'color'; value: string } | { type: 'image'; url: string }

export type DesignData = {
    background: DesignBackground
    elements: DesignElement[]
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

export function newImageElement(url: string): ImageElement {
    return {
        id: crypto.randomUUID(),
        kind: 'image',
        x: 560,
        y: 340,
        width: 800,
        height: 450,
        url,
    }
}

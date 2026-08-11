import { describe, expect, it } from 'vitest'
import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    DEFAULT_IMAGE_INTERVAL_SECONDS,
    FONT_FAMILY_OPTIONS,
    cellFontSize,
    cloneDesignWithFreshIds,
    columnBadgeColor,
    emptyDesign,
    findMergeAt,
    fontFamilyCssVar,
    imageUrls,
    isMergedAway,
    newImageElement,
    newPhotoWithCaptionSet,
    newRectElement,
    newTableElement,
    newTextElement,
    rotatedResizeDelta,
    type DesignElement,
    type ImageElement,
    type Rotation,
    type TableElement,
} from './index'

function table(overrides: Partial<TableElement> = {}): TableElement {
    return { ...newTableElement(), ...overrides }
}

describe('fontFamilyCssVar', () => {
    it('maps every known family to its css variable', () => {
        for (const option of FONT_FAMILY_OPTIONS) {
            expect(fontFamilyCssVar(option.value)).toBe(option.cssVar)
        }
    })

    it('falls back to the sans variable when the family is missing', () => {
        expect(fontFamilyCssVar(undefined)).toBe('var(--font-sans)')
    })
})

describe('imageUrls', () => {
    it('prefers the slideshow urls array', () => {
        const el = { urls: ['a.png', 'b.png'], url: 'legacy.png' } as unknown as ImageElement
        expect(imageUrls(el)).toEqual(['a.png', 'b.png'])
    })

    it('reads the deprecated single url when urls is empty or absent', () => {
        expect(imageUrls({ urls: [], url: 'legacy.png' } as unknown as ImageElement)).toEqual([
            'legacy.png',
        ])
        expect(imageUrls({ url: 'legacy.png' } as unknown as ImageElement)).toEqual(['legacy.png'])
    })

    it('returns an empty array when there is no image at all', () => {
        expect(imageUrls({ urls: [] } as unknown as ImageElement)).toEqual([])
    })
})

describe('element factories', () => {
    it('creates an empty design on a dark background', () => {
        expect(emptyDesign()).toEqual({
            background: { type: 'color', value: '#18181b' },
            elements: [],
        })
    })

    it('gives every new element a unique id and a kind', () => {
        const elements = [
            newTextElement(),
            newRectElement(),
            newImageElement(['a.png']),
            newTableElement(),
        ]
        const ids = elements.map((el) => el.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(elements.map((el) => el.kind)).toEqual(['text', 'rect', 'image', 'table'])
    })

    it('positions new elements inside the reference canvas', () => {
        for (const el of [newTextElement(), newRectElement(), newImageElement([]), newTableElement()]) {
            expect(el.x).toBeGreaterThanOrEqual(0)
            expect(el.y).toBeGreaterThanOrEqual(0)
            expect(el.x + el.width).toBeLessThanOrEqual(CANVAS_WIDTH)
            expect(el.y + el.height).toBeLessThanOrEqual(CANVAS_HEIGHT)
            expect(el.rotation).toBe(0)
        }
    })

    it('carries the given urls and default interval onto a new image element', () => {
        const el = newImageElement(['one.png', 'two.png'])
        expect(el.urls).toEqual(['one.png', 'two.png'])
        expect(el.intervalSeconds).toBe(DEFAULT_IMAGE_INTERVAL_SECONDS)
    })

    it('creates a table with one badge slot per column and no merges', () => {
        const el = newTableElement()
        expect(el.columnBadges).toHaveLength(el.rows[0].length)
        expect(el.merges).toEqual([])
        expect(el.headerRow).toBe(true)
    })
})

describe('newPhotoWithCaptionSet', () => {
    const [image, scrim, caption] = newPhotoWithCaptionSet()

    it('returns an image, a scrim rect, and a caption text element', () => {
        expect([image.kind, scrim.kind, caption.kind]).toEqual(['image', 'rect', 'text'])
    })

    it('anchors the scrim to the bottom of the photo', () => {
        expect(scrim.x).toBe(image.x)
        expect(scrim.y + scrim.height).toBe(image.y + image.height)
        expect(scrim.width).toBe(image.width)
    })

    it('insets the caption inside the scrim', () => {
        expect(caption.x).toBeGreaterThan(scrim.x)
        expect(caption.x + caption.width).toBeLessThan(scrim.x + scrim.width)
        expect(caption.y).toBeGreaterThanOrEqual(scrim.y)
        expect(caption.y + caption.height).toBeLessThanOrEqual(scrim.y + scrim.height)
    })

    it('starts the photo region as an empty slideshow', () => {
        expect(image).toMatchObject({ urls: [], intervalSeconds: DEFAULT_IMAGE_INTERVAL_SECONDS })
    })
})

describe('rotatedResizeDelta', () => {
    it('passes the drag through unchanged at 0 degrees', () => {
        expect(rotatedResizeDelta(10, -4, 0)).toEqual({ dw: 10, dh: -4 })
    })

    it('swaps the axes at 90 and 270 degrees', () => {
        expect(rotatedResizeDelta(10, 6, 90)).toEqual({ dw: 6, dh: -10 })
        expect(rotatedResizeDelta(10, 6, 270)).toEqual({ dw: -6, dh: 10 })
    })

    it('inverts both axes at 180 degrees', () => {
        expect(rotatedResizeDelta(10, 6, 180)).toEqual({ dw: -10, dh: -6 })
    })

    it('preserves the drag magnitude for every rotation', () => {
        const rotations: Rotation[] = [0, 90, 180, 270]
        for (const rotation of rotations) {
            const { dw, dh } = rotatedResizeDelta(3, 4, rotation)
            expect(Math.hypot(dw, dh)).toBeCloseTo(5)
        }
    })
})

describe('cellFontSize', () => {
    it('falls back to the table font size when there is no override', () => {
        expect(cellFontSize(table({ fontSize: 40 }), 0, 0)).toBe(40)
        expect(cellFontSize(table({ fontSize: 40, cellFontSizes: [[null]] }), 0, 0)).toBe(40)
    })

    it('uses a per-cell override when present', () => {
        const el = table({ fontSize: 40, cellFontSizes: [[null, 72]] })
        expect(cellFontSize(el, 0, 1)).toBe(72)
        expect(cellFontSize(el, 5, 5)).toBe(40)
    })
})

describe('table merges', () => {
    const el = table({ merges: [{ row: 1, col: 0, colspan: 3 }] })

    it('finds the merge anchored at a cell', () => {
        expect(findMergeAt(el, 1, 0)).toEqual({ row: 1, col: 0, colspan: 3 })
        expect(findMergeAt(el, 1, 1)).toBeUndefined()
        expect(findMergeAt(table({ merges: undefined }), 1, 0)).toBeUndefined()
    })

    it('marks only the cells covered after the anchor as merged away', () => {
        expect(isMergedAway(el, 1, 0)).toBe(false)
        expect(isMergedAway(el, 1, 1)).toBe(true)
        expect(isMergedAway(el, 1, 2)).toBe(true)
        expect(isMergedAway(el, 1, 3)).toBe(false)
        expect(isMergedAway(el, 0, 1)).toBe(false)
    })

    it('treats a missing merges list as no merges', () => {
        expect(isMergedAway(table({ merges: undefined }), 1, 1)).toBe(false)
    })
})

describe('columnBadgeColor', () => {
    const el = table({ columnBadges: [null, '#ff0000'] })

    it('returns null for columns without a badge color', () => {
        expect(columnBadgeColor(el, 0, 'Latte')).toBeNull()
        expect(columnBadgeColor(el, 9, 'Latte')).toBeNull()
        expect(columnBadgeColor(table({ columnBadges: undefined }), 1, 'Latte')).toBeNull()
    })

    it('returns the badge color for non-empty cells in a badged column', () => {
        expect(columnBadgeColor(el, 1, '$4.50')).toBe('#ff0000')
    })

    it('skips placeholder cells', () => {
        for (const cell of ['', '   ', '-', '—']) {
            expect(columnBadgeColor(el, 1, cell)).toBeNull()
        }
    })
})

describe('cloneDesignWithFreshIds', () => {
    it('regenerates every element id while keeping the rest of the design', () => {
        const design = { background: { type: 'color' as const, value: '#000' }, elements: [newTextElement(), newRectElement()] }
        const clone = cloneDesignWithFreshIds(design)

        expect(clone.background).toBe(design.background)
        expect(clone.elements.map((el) => el.id)).not.toEqual(design.elements.map((el) => el.id))
        expect(new Set(clone.elements.map((el) => el.id)).size).toBe(2)
        const idAgnostic = (el: DesignElement) => ({ ...el, id: '' })
        expect(clone.elements.map(idAgnostic)).toEqual(design.elements.map(idAgnostic))
    })

    it('does not mutate the source design', () => {
        const design = { background: { type: 'color' as const, value: '#000' }, elements: [newTextElement()] }
        const originalId = design.elements[0].id
        cloneDesignWithFreshIds(design)
        expect(design.elements[0].id).toBe(originalId)
    })
})

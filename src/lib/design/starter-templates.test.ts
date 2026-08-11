import { describe, expect, it } from 'vitest'
import { CANVAS_HEIGHT, CANVAS_WIDTH, type DesignElement } from './index'
import { STARTER_TEMPLATES } from './starter-templates'

const allElements: DesignElement[] = STARTER_TEMPLATES.flatMap((t) => t.design.elements)

describe('STARTER_TEMPLATES', () => {
    it('ships a non-empty library with unique ids and names', () => {
        expect(STARTER_TEMPLATES.length).toBeGreaterThan(0)
        expect(new Set(STARTER_TEMPLATES.map((t) => t.id)).size).toBe(STARTER_TEMPLATES.length)
        expect(new Set(STARTER_TEMPLATES.map((t) => t.name)).size).toBe(STARTER_TEMPLATES.length)
    })

    it('gives every template a background and at least one element', () => {
        for (const template of STARTER_TEMPLATES) {
            expect(template.design.elements.length).toBeGreaterThan(0)
            const background = template.design.background
            if (background.type === 'color') expect(background.value).toMatch(/^#[0-9a-fA-F]{3,8}$/)
            else expect(background.url.length).toBeGreaterThan(0)
        }
    })

    it('gives every element a unique id within its template', () => {
        for (const template of STARTER_TEMPLATES) {
            const ids = template.design.elements.map((el) => el.id)
            expect(new Set(ids).size).toBe(ids.length)
        }
    })

    it('keeps every element inside the reference canvas', () => {
        for (const template of STARTER_TEMPLATES) {
            for (const el of template.design.elements) {
                expect(el.width).toBeGreaterThan(0)
                expect(el.height).toBeGreaterThan(0)
                expect(el.x).toBeGreaterThanOrEqual(0)
                expect(el.y).toBeGreaterThanOrEqual(0)
                expect(el.x + el.width).toBeLessThanOrEqual(CANVAS_WIDTH)
                expect(el.y + el.height).toBeLessThanOrEqual(CANVAS_HEIGHT)
            }
        }
    })

    it('ships photo regions as empty slideshows with a positive interval', () => {
        for (const el of allElements) {
            if (el.kind !== 'image') continue
            expect(el.urls).toEqual([])
            expect(el.intervalSeconds).toBeGreaterThan(0)
        }
    })

    it('keeps table rows rectangular and badge slots aligned to columns', () => {
        for (const el of allElements) {
            if (el.kind !== 'table') continue
            expect(el.rows.length).toBeGreaterThan(0)
            const columns = el.rows[0].length
            for (const row of el.rows) expect(row).toHaveLength(columns)
            if (el.columnBadges) expect(el.columnBadges.length).toBeLessThanOrEqual(columns)
            for (const merge of el.merges ?? []) {
                expect(merge.colspan).toBeGreaterThan(1)
                expect(el.rows[merge.row]).toBeDefined()
                expect(merge.col + merge.colspan).toBeLessThanOrEqual(columns)
            }
            for (const row of el.cellFontSizes ?? []) {
                expect(row.length).toBeLessThanOrEqual(columns)
            }
        }
    })

    it('uses positive font sizes and 90-degree rotations only', () => {
        for (const el of allElements) {
            if (el.kind === 'text' || el.kind === 'table') expect(el.fontSize).toBeGreaterThan(0)
            if (el.rotation !== undefined) expect([0, 90, 180, 270]).toContain(el.rotation)
        }
    })
})

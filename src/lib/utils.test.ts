import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
    it('joins class names and drops falsy values', () => {
        expect(cn('px-2', undefined, null, false && 'hidden', 'py-1')).toBe('px-2 py-1')
    })

    it('supports arrays and conditional objects', () => {
        expect(cn(['flex', 'items-center'], { 'gap-2': true, 'gap-4': false })).toBe(
            'flex items-center gap-2'
        )
    })

    it('lets a later tailwind class win over an earlier conflicting one', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4')
        expect(cn('text-sm text-red-500', 'text-blue-500')).toBe('text-sm text-blue-500')
    })

    it('returns an empty string with no usable input', () => {
        expect(cn()).toBe('')
        expect(cn(undefined, '')).toBe('')
    })
})

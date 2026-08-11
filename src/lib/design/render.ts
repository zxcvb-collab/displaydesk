import type { CSSProperties } from 'react'
import {
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    cellFontSize,
    fontFamilyCssVar,
    type DesignBackground,
    type DesignElement,
    type TableElement,
    type TextElement,
} from '.'

/**
 * Style math shared by every surface that draws a design: the TV player,
 * the editor canvas, and the template thumbnails. All of them scale the
 * fixed 1920x1080 reference canvas to their own box, so positions are
 * percentages and font sizes are container-query units (`cqh`) relative to
 * the canvas height — identical math everywhere is what makes the editor a
 * true preview of the player.
 */

/** Canvas-unit font size as a container-query height unit. */
export function canvasFontSize(px: number): string {
    return `${(px / CANVAS_HEIGHT) * 100}cqh`
}

export function designBackgroundStyle(background: DesignBackground, colorFallback?: string): CSSProperties {
    return {
        background: background.type === 'color' ? background.value : colorFallback,
        backgroundImage: background.type === 'image' ? `url(${background.url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        containerType: 'size',
    } as CSSProperties
}

export function elementBoxStyle(el: DesignElement, extra?: CSSProperties): CSSProperties {
    return {
        position: 'absolute',
        left: `${(el.x / CANVAS_WIDTH) * 100}%`,
        top: `${(el.y / CANVAS_HEIGHT) * 100}%`,
        width: `${(el.width / CANVAS_WIDTH) * 100}%`,
        height: `${(el.height / CANVAS_HEIGHT) * 100}%`,
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        ...extra,
    }
}

export function textElementStyle(el: TextElement): CSSProperties {
    return {
        fontSize: canvasFontSize(el.fontSize),
        fontFamily: fontFamilyCssVar(el.fontFamily),
        color: el.color,
        fontWeight: el.bold ? 700 : 400,
        textAlign: el.align,
    }
}

export function tableElementStyle(el: TableElement): CSSProperties {
    return {
        borderCollapse: 'collapse',
        fontSize: canvasFontSize(el.fontSize),
        fontFamily: fontFamilyCssVar(el.fontFamily),
        color: el.color,
    }
}

export function tableCellStyle(
    el: TableElement,
    row: number,
    col: number,
    options?: { padding?: string; whiteSpace?: CSSProperties['whiteSpace'] }
): CSSProperties {
    return {
        border: `1px solid ${el.borderColor}`,
        padding: options?.padding,
        fontSize: canvasFontSize(cellFontSize(el, row, col)),
        fontWeight: row === 0 && el.headerRow ? 700 : 400,
        whiteSpace: options?.whiteSpace ?? 'pre-wrap',
    }
}

export function cellBadgeStyle(color: string): CSSProperties {
    return {
        display: 'inline-block',
        border: `2px solid ${color}`,
        borderRadius: 999,
        padding: '2px 12px',
    }
}

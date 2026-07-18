import { CANVAS_WIDTH, CANVAS_HEIGHT, type DesignData } from './index'

export type StarterTemplate = {
    id: string
    name: string
    design: DesignData
}

// A small curated library of ready-made layouts, shown alongside a user's
// own saved templates when starting a new design slide. These are plain
// data, not stored in the database — editing this file ships new starter
// options to every org.
export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'simple-menu',
        name: 'Simple menu board',
        design: {
            background: { type: 'color', value: '#18181b' },
            elements: [
                {
                    id: 'st-simple-menu-title',
                    kind: 'text',
                    x: 160,
                    y: 100,
                    width: CANVAS_WIDTH - 320,
                    height: 140,
                    text: "Today's Menu",
                    fontSize: 96,
                    color: '#ffffff',
                    bold: true,
                    align: 'center',
                },
                {
                    id: 'st-simple-menu-table',
                    kind: 'table',
                    x: 360,
                    y: 300,
                    width: CANVAS_WIDTH - 720,
                    height: 640,
                    rows: [
                        ['Item', 'Price'],
                        ['Espresso', '$3.00'],
                        ['Cappuccino', '$4.75'],
                        ['Latte', '$4.50'],
                        ['Croissant', '$3.50'],
                    ],
                    fontSize: 48,
                    color: '#ffffff',
                    borderColor: '#52525b',
                    headerRow: true,
                },
            ],
        },
    },
    {
        id: 'coffee-specials',
        name: 'Coffee shop specials',
        design: {
            background: { type: 'color', value: '#3f2a1d' },
            elements: [
                {
                    id: 'st-coffee-title',
                    kind: 'text',
                    x: 160,
                    y: 120,
                    width: CANVAS_WIDTH - 320,
                    height: 160,
                    text: "Today's Specials",
                    fontSize: 104,
                    color: '#f5deb3',
                    bold: true,
                    align: 'center',
                },
                {
                    id: 'st-coffee-body',
                    kind: 'text',
                    x: 260,
                    y: 380,
                    width: CANVAS_WIDTH - 520,
                    height: 560,
                    text: 'Pumpkin Spice Latte — $5.25\nCaramel Macchiato — $5.50\nOat Milk Flat White — $4.95',
                    fontSize: 56,
                    color: '#ffffff',
                    bold: false,
                    align: 'center',
                },
            ],
        },
    },
    {
        id: 'bold-announcement',
        name: 'Bold announcement',
        design: {
            background: { type: 'color', value: '#b91c1c' },
            elements: [
                {
                    id: 'st-bold-title',
                    kind: 'text',
                    x: 160,
                    y: 400,
                    width: CANVAS_WIDTH - 320,
                    height: 280,
                    text: 'Happy Hour\n3–5 PM Daily',
                    fontSize: 120,
                    color: '#ffffff',
                    bold: true,
                    align: 'center',
                },
            ],
        },
    },
    {
        id: 'photo-highlight',
        name: 'Photo highlight',
        design: {
            background: { type: 'color', value: '#0f172a' },
            elements: [
                {
                    id: 'st-photo-image',
                    kind: 'image',
                    x: 0,
                    y: 0,
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    urls: [],
                    intervalSeconds: 5,
                },
                {
                    id: 'st-photo-caption',
                    kind: 'text',
                    x: 120,
                    y: CANVAS_HEIGHT - 220,
                    width: CANVAS_WIDTH - 240,
                    height: 160,
                    text: 'Add your photo(s) and caption',
                    fontSize: 56,
                    color: '#ffffff',
                    bold: true,
                    align: 'center',
                },
            ],
        },
    },
]

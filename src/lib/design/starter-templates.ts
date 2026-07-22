import { CANVAS_WIDTH, CANVAS_HEIGHT, type DesignData, type DesignElement } from './index'

export type StarterTemplate = {
    id: string
    name: string
    design: DesignData
}

function text(partial: Omit<Extract<DesignElement, { kind: 'text' }>, 'id' | 'kind'>) {
    return { id: crypto.randomUUID(), kind: 'text' as const, ...partial }
}

function table(partial: Omit<Extract<DesignElement, { kind: 'table' }>, 'id' | 'kind'>) {
    return { id: crypto.randomUUID(), kind: 'table' as const, ...partial }
}

function rect(partial: Omit<Extract<DesignElement, { kind: 'rect' }>, 'id' | 'kind'>) {
    return { id: crypto.randomUUID(), kind: 'rect' as const, ...partial }
}

// A curated library modeled on common restaurant/cafe menu board styles —
// shown alongside a user's own saved templates when starting a new design
// slide. Plain data, not stored in the database, so shipping new starter
// options is just an edit to this file.
export const STARTER_TEMPLATES: StarterTemplate[] = [
    {
        id: 'fine-dining',
        name: 'Fine Dining',
        design: {
            background: { type: 'color', value: '#0c0c0c' },
            elements: [
                text({
                    x: 1120, y: 140, width: 640, height: 90,
                    text: 'Dinner Menu', fontSize: 56, color: '#f5f0e6', bold: true, align: 'left',
                }),
                table({
                    x: 1120, y: 260, width: 640, height: 640,
                    rows: [
                        ['Roasted Duck Breast, cherry jus', '$34'],
                        ['Seared Scallops, brown butter', '$29'],
                        ['Wild Mushroom Risotto', '$24'],
                        ['Dry-Aged Ribeye, red wine reduction', '$48'],
                        ['Heirloom Tomato Salad', '$16'],
                        ['Chocolate Fondant, vanilla bean', '$14'],
                    ],
                    fontSize: 26, color: '#e8e2d4', borderColor: '#2c2c2c', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'fast-food',
        name: 'Fast Food / Quick Serve',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                rect({ x: 0, y: 0, width: CANVAS_WIDTH, height: 160, color: '#e6392f' }),
                text({
                    x: 80, y: 30, width: 1200, height: 100,
                    text: 'BLACK BURGER CO.', fontSize: 64, color: '#ffffff', bold: true, align: 'left',
                }),
                table({
                    x: 80, y: 220, width: CANVAS_WIDTH - 160, height: 620,
                    rows: [
                        ['Item', 'Price'],
                        ['Classic Smash Burger', '$8.99'],
                        ['Double Bacon Cheeseburger', '$11.49'],
                        ['Crispy Chicken Sandwich', '$9.49'],
                        ['Loaded Fries', '$5.99'],
                        ['Onion Rings', '$4.99'],
                        ['Milkshake', '$5.49'],
                    ],
                    fontSize: 34, color: '#1a1a1a', borderColor: '#e5e5e5', headerRow: true,
                }),
                rect({ x: 0, y: CANVAS_HEIGHT - 90, width: CANVAS_WIDTH, height: 90, color: '#1a1a1a' }),
                text({
                    x: 0, y: CANVAS_HEIGHT - 78, width: CANVAS_WIDTH, height: 60,
                    text: 'ORDER AT THE COUNTER', fontSize: 32, color: '#ffffff', bold: true, align: 'center',
                }),
            ],
        },
    },
    {
        id: 'coffee-shop',
        name: 'Coffee Shop / Bakery',
        design: {
            background: { type: 'color', value: '#3f2a1d' },
            elements: [
                text({
                    x: 100, y: 80, width: 900, height: 90,
                    text: 'FERNBEE COFFEE', fontSize: 52, color: '#f5deb3', bold: true, align: 'left',
                }),
                table({
                    x: 100, y: 220, width: CANVAS_WIDTH - 200, height: 720,
                    rows: [
                        ['Espresso', '$3.00'],
                        ['Americano', '$3.50'],
                        ['Cappuccino', '$4.25'],
                        ['Flat White', '$4.50'],
                        ['Caramel Latte', '$4.95'],
                        ['Cold Brew', '$4.75'],
                        ['Croissant', '$3.50'],
                        ['Banana Bread', '$3.75'],
                    ],
                    fontSize: 30, color: '#f5deb3', borderColor: '#5a4028', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'bar-nightclub',
        name: 'Bar / Nightclub',
        design: {
            background: { type: 'color', value: '#0b1120' },
            elements: [
                text({
                    x: 640, y: 100, width: 640, height: 100,
                    text: 'NOCTURNE', fontSize: 68, color: '#9fb8ff', bold: true, align: 'center',
                }),
                table({
                    x: 460, y: 300, width: 1000, height: 620,
                    rows: [
                        ['Smoked Old Fashioned', '$16'],
                        ['Espresso Martini', '$15'],
                        ['Nocturne Sour', '$14'],
                        ['Gin & Elderflower', '$13'],
                        ['Bourbon Neat', '$12'],
                        ['House Red / White', '$11'],
                    ],
                    fontSize: 30, color: '#dbe4ff', borderColor: '#1e2a4a', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'bakery-dessert',
        name: 'Bakery / Dessert',
        design: {
            background: { type: 'color', value: '#fdf1ee' },
            elements: [
                text({
                    x: 560, y: 90, width: 800, height: 90,
                    text: 'Wild Rose Bakery', fontSize: 52, color: '#c98a92', bold: true, align: 'center',
                }),
                table({
                    x: 460, y: 260, width: 1000, height: 660,
                    rows: [
                        ['Classic Croissant', '$3.75'],
                        ['Blueberry Muffin', '$3.50'],
                        ['Red Velvet Cupcake', '$4.25'],
                        ['Almond Danish', '$4.00'],
                        ['Lemon Tart', '$4.75'],
                    ],
                    fontSize: 30, color: '#5c3a3f', borderColor: '#e9c9c9', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'wine-bar',
        name: 'Wine Bar',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                rect({ x: 0, y: 0, width: CANVAS_WIDTH, height: 140, color: '#1f5c3f' }),
                text({
                    x: 80, y: 30, width: 1200, height: 90,
                    text: "TODD'S WINE HOUSE", fontSize: 52, color: '#ffffff', bold: true, align: 'left',
                }),
                table({
                    x: 80, y: 200, width: CANVAS_WIDTH - 160, height: 680,
                    rows: [
                        ['Wine', 'Glass', 'Bottle'],
                        ['Sauvignon Blanc', '$11', '$42'],
                        ['Pinot Grigio', '$10', '$38'],
                        ['Cabernet Sauvignon', '$13', '$48'],
                        ['Pinot Noir', '$12', '$45'],
                        ['Prosecco', '$10', '$36'],
                    ],
                    fontSize: 30, color: '#1a1a1a', borderColor: '#dcdcdc', headerRow: true,
                }),
            ],
        },
    },
    {
        id: 'sushi-asian',
        name: 'Sushi / Asian',
        design: {
            background: { type: 'color', value: '#141414' },
            elements: [
                text({
                    x: 130, y: 90, width: 900, height: 90,
                    text: 'FIG & GINGER', fontSize: 56, color: '#f2c94c', bold: true, align: 'left',
                }),
                table({
                    x: 130, y: 240, width: CANVAS_WIDTH - 260, height: 700,
                    rows: [
                        ['California Roll', '$8'],
                        ['Spicy Tuna Roll', '$10'],
                        ['Salmon Nigiri (2pc)', '$7'],
                        ['Dragon Roll', '$13'],
                        ['Miso Soup', '$4'],
                        ['Edamame', '$5'],
                    ],
                    fontSize: 30, color: '#ececec', borderColor: '#2b2b2b', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'farm-to-table',
        name: 'Farm-to-Table / Bistro',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                rect({ x: 0, y: 0, width: CANVAS_WIDTH, height: 140, color: '#3d6b3d' }),
                text({
                    x: 80, y: 30, width: 1200, height: 90,
                    text: 'Rustic Farmhouse Dining Hall', fontSize: 44, color: '#ffffff', bold: true, align: 'left',
                }),
                table({
                    x: 80, y: 220, width: CANVAS_WIDTH - 160, height: 680,
                    rows: [
                        ['Starters', 'Mains', 'Desserts'],
                        ['Garden Salad — $9', 'Roast Chicken — $22', 'Apple Crumble — $8'],
                        ['Soup of the Day — $7', 'Grilled Salmon — $26', 'Panna Cotta — $7'],
                        ['Bruschetta — $8', 'Vegetable Risotto — $19', 'Cheese Board — $12'],
                    ],
                    fontSize: 26, color: '#1f2b1f', borderColor: '#dbe5db', headerRow: true,
                }),
            ],
        },
    },
    {
        id: 'bistro-cream',
        name: 'Bistro',
        design: {
            background: { type: 'color', value: '#fbf3ea' },
            elements: [
                text({
                    x: 120, y: 90, width: 900, height: 90,
                    text: 'The Maple Table', fontSize: 56, color: '#c9772f', bold: true, align: 'left',
                }),
                table({
                    x: 120, y: 260, width: CANVAS_WIDTH - 240, height: 640,
                    rows: [
                        ['Rotisserie Chicken', 'Herb-roasted, seasonal veg', '$18'],
                        ['Classic Fish Bowl', 'Grilled cod, citrus rice', '$19'],
                        ['Combo Veggie Burger', 'House patty, sweet potato fries', '$15'],
                    ],
                    fontSize: 26, color: '#4a3626', borderColor: '#e8d6c0', headerRow: false,
                }),
            ],
        },
    },
    {
        id: 'dessert-smoothie',
        name: 'Dessert / Smoothie Bar',
        design: {
            background: { type: 'color', value: '#3a2a20' },
            elements: [
                text({
                    x: 130, y: 90, width: 900, height: 90,
                    text: 'Dessert Smoothie Bar', fontSize: 46, color: '#f2c14e', bold: true, align: 'left',
                }),
                table({
                    x: 130, y: 240, width: CANVAS_WIDTH - 260, height: 700,
                    rows: [
                        ['Tropical Blend', '$6.50'],
                        ['Mango', '$6.00'],
                        ['Berry Mix', '$6.50'],
                        ['Peanut Butter Banana', '$6.75'],
                        ['Veggie Boost', '$6.25'],
                    ],
                    fontSize: 30, color: '#f5ead9', borderColor: '#5a4636', headerRow: false,
                }),
            ],
        },
    },
]

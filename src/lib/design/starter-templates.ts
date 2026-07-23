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

// Featured-photo regions ship as an empty slideshow (urls: []) with a
// sensible default interval — the user drops in one or more photos and it
// behaves as a multi-image slideshow immediately, no extra setup.
function image(partial: Omit<Extract<DesignElement, { kind: 'image' }>, 'id' | 'kind' | 'urls' | 'intervalSeconds'> & { intervalSeconds?: number }) {
    return { id: crypto.randomUUID(), kind: 'image' as const, urls: [], intervalSeconds: 5, ...partial }
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
    {
        id: 'coffee-tea-full-menu',
        name: 'Coffee & Tea Full Menu',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                text({
                    x: 40, y: 30, width: 900, height: 60,
                    text: 'COFFEE', fontSize: 34, color: '#1a1a1a', bold: true, align: 'left',
                }),
                table({
                    x: 40, y: 90, width: 900, height: 300,
                    rows: [
                        ['Item', 'Reg', 'Lrg'],
                        ['Drip Coffee', '2.79', '3.59'],
                        ['Espresso', '3.00', '3.79'],
                        ['Americano', '3.99', '4.99'],
                        ['Cafe Latte', '4.79', '5.79'],
                        ['Flat White', '4.99', '5.99'],
                        ['Cappuccino', '4.99', '5.99'],
                        ['Caramel Macchiato', '5.79', '6.99'],
                        ['Mocha', '5.99', '6.99'],
                    ],
                    fontSize: 20, color: '#1a1a1a', borderColor: '#e0e0e0', headerRow: true,
                }),
                text({
                    x: 40, y: 410, width: 900, height: 50,
                    text: 'TEA', fontSize: 30, color: '#1a1a1a', bold: true, align: 'left',
                }),
                table({
                    x: 40, y: 460, width: 900, height: 220,
                    rows: [
                        ['Item', 'Reg', 'Lrg'],
                        ['Regular Tea', '2.49', '2.79'],
                        ['Speciality Tea', '3.59', '3.99'],
                        ['Chai Latte', '5.29', '5.99'],
                        ['Matcha Tea Latte', '5.99', '6.99'],
                        ['Kashmiri Pink Chai', '5.99', '6.99'],
                    ],
                    fontSize: 20, color: '#1a1a1a', borderColor: '#e0e0e0', headerRow: true,
                }),
                text({
                    x: 40, y: 700, width: 900, height: 50,
                    text: 'OTHER', fontSize: 26, color: '#1a1a1a', bold: true, align: 'left',
                }),
                table({
                    x: 40, y: 750, width: 900, height: 120,
                    rows: [
                        ['Apple Cider', '2.79', '3.59'],
                        ['Hot Chocolate', '4.29', '5.29'],
                    ],
                    fontSize: 20, color: '#1a1a1a', borderColor: '#e0e0e0', headerRow: false,
                }),
                text({
                    x: 1000, y: 30, width: 880, height: 60,
                    text: 'ICED', fontSize: 34, color: '#1a1a1a', bold: true, align: 'left',
                }),
                table({
                    x: 1000, y: 90, width: 880, height: 900,
                    rows: [
                        ['Item', 'Reg', 'Lrg'],
                        ['Peach Iced Tea', '4.99', '5.99'],
                        ['Huckleberry Special Iced Coffee', '4.99', '5.99'],
                        ['Strawberry Lemonade', '4.99', '5.99'],
                        ['Iced Americano', '4.99', '5.59'],
                        ['Cold Brew', '4.99', '5.59'],
                        ['Iced Chocolate', '5.29', '6.29'],
                        ['Iced Latte w/Sweet Foam', '5.79', '6.29'],
                        ['Iced Chai Latte', '5.79', '6.29'],
                        ['Matcha Lemonade', '6.29', '7.79'],
                        ['Iced Matcha Latte', '6.29', '7.29'],
                        ['Dragonfruit & Lime Refresher', '6.49', '7.99'],
                        ['Iced Kashmiri Pink Chai', '6.99', '8.49'],
                        ['Shaken Brown Sugar Latte', '6.99', '7.99'],
                        ['Mango/Strawberry Matcha', '7.59', '8.59'],
                        ['Coconut Coffee/Matcha Cream', '7.99', '8.99'],
                    ],
                    fontSize: 18, color: '#1a1a1a', borderColor: '#e0e0e0', headerRow: true,
                }),
                text({
                    x: 0, y: CANVAS_HEIGHT - 50, width: CANVAS_WIDTH, height: 40,
                    text: 'Large size available +$1.00', fontSize: 22, color: '#1a1a1a', bold: true, align: 'center',
                }),
            ],
        },
    },
    {
        id: 'specials-board',
        name: 'Specials Board (with photo)',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                rect({ x: 0, y: 0, width: 1280, height: 130, color: '#d4d4d4' }),
                text({
                    x: 40, y: 25, width: 700, height: 80,
                    text: 'JULY SPECIALS', fontSize: 46, color: '#1a1a2e', bold: true, align: 'left',
                }),
                text({
                    x: 780, y: 45, width: 200, height: 40,
                    text: 'HOT', fontSize: 22, color: '#1a1a2e', bold: true, align: 'center',
                }),
                text({
                    x: 1000, y: 45, width: 200, height: 40,
                    text: 'ICED', fontSize: 22, color: '#1a1a2e', bold: true, align: 'center',
                }),
                table({
                    x: 40, y: 160, width: 1200, height: 880,
                    rows: [
                        ['Lavender Lemonade\nFloral lavender meets tart lemonade over ice', '', '$5.99'],
                        ['Strawberry White Mocha\nEspresso, white chocolate, sweet strawberry', '$5.99', '$6.99'],
                        ['Watermelon Cucumber Mint Refresher\nJuicy watermelon, crisp cucumber, cool mint', '', '$6.99'],
                        ['Vanilla Chai Latte\nSpiced chai and sweet vanilla, hot or iced', '$6.29', '$6.99'],
                        ['Chocolate Matcha Cloud\nRich chocolate topped with a matcha foam', '', '$7.99'],
                    ],
                    fontSize: 20, color: '#1a1a2e', borderColor: '#dcdcdc', headerRow: false,
                    columnBadges: [null, '#c9772f', '#2f6fc9'],
                }),
                text({
                    x: 40, y: CANVAS_HEIGHT - 60, width: 1200, height: 40,
                    text: 'Large size available +$1.00', fontSize: 22, color: '#1a1a1a', bold: true, align: 'center',
                }),
                // Featured photo — drop in one or more images and it cycles
                // automatically as a slideshow.
                image({ x: 1280, y: 0, width: CANVAS_WIDTH - 1280, height: CANVAS_HEIGHT }),
                rect({ x: 1280, y: CANVAS_HEIGHT - 140, width: CANVAS_WIDTH - 1280, height: 140, color: '#000000aa' }),
                text({
                    x: 1310, y: CANVAS_HEIGHT - 100, width: 580, height: 80,
                    text: 'LAVENDER LEMONADE', fontSize: 30, color: '#ffffff', bold: true, align: 'left',
                }),
            ],
        },
    },
    {
        id: 'sandwiches-soup',
        name: 'Sandwiches & Soup (with photo)',
        design: {
            background: { type: 'color', value: '#ffffff' },
            elements: [
                table({
                    x: 40, y: 40, width: 1180, height: 1000,
                    rows: [
                        ['Soup of the Day\nWith Garlic Bread', '$9.99'],
                        ['Breakfast Sandwich\nEgg patty, Provolone, Tomato, Guacamole, Creamy spread', '$6.99'],
                        ['Dill Infused Egg Salad\nSignature Egg Salad, Greens', '$10.99'],
                        ['Pesto Turkey\nGreens, Tomato, Sun-dried tomato aioli, Boursin, Basil pesto', '$11.49'],
                        ['Ham & Swiss\nCreamy Mustard, Microgreens, Tomatoes, Crispy Onion', '$11.49'],
                        ['Vegan Goddess\nBean fluff, Greens, Vegan sun-dried tomato aioli', '$11.99'],
                        ['Roast Beef\nGreens, Fried onions, Horseradish mayo, Provolone, Mustard', '$12.99'],
                    ],
                    fontSize: 20, color: '#1a1a2e', borderColor: '#dcdcdc', headerRow: false,
                }),
                text({
                    x: 40, y: CANVAS_HEIGHT - 60, width: 1180, height: 40,
                    text: 'Gluten free bread available', fontSize: 20, color: '#1a1a1a', bold: false, align: 'center',
                }),
                // Featured photo — drop in one or more images and it cycles
                // automatically as a slideshow.
                image({ x: 1220, y: 0, width: CANVAS_WIDTH - 1220, height: CANVAS_HEIGHT }),
                rect({ x: 1220, y: CANVAS_HEIGHT - 140, width: CANVAS_WIDTH - 1220, height: 140, color: '#000000aa' }),
                text({
                    x: 1250, y: CANVAS_HEIGHT - 100, width: 620, height: 80,
                    text: 'SALTED MAPLE CINNAMON BUN', fontSize: 26, color: '#ffffff', bold: true, align: 'left',
                }),
            ],
        },
    },
]

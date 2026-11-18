// After `npm run export:food-model`: compares the model's real labels (labels.json) with src/data/foodLabels.ts.
// Unknown labels still work in the app (they fall back to a name search), so this only warns.
import { readFileSync } from 'node:fs'

const labels = JSON.parse(readFileSync('public/models/dima806/indian_food_image_detection/labels.json', 'utf8'))
const key = (l) => l.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const mapped = new Set([...readFileSync('src/data/foodLabels.ts', 'utf8').matchAll(/^  ([a-z0-9_]+): L\(/gm)].map((m) => m[1]))
const model = new Set(labels.map(key))
const missing = [...model].filter((l) => !mapped.has(l))
const unused = [...mapped].filter((l) => !model.has(l))
console.log(`Food model: ${model.size} labels; foodLabels.ts: ${mapped.size} entries.`)
const warn = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `Warning: ${msg}`)
if (missing.length) warn(`Model labels with no entry in src/data/foodLabels.ts: ${missing.join(', ')}`)
if (unused.length) warn(`Entries in src/data/foodLabels.ts the model doesn't have: ${unused.join(', ')}`)
if (!missing.length && !unused.length) console.log('All labels match.')

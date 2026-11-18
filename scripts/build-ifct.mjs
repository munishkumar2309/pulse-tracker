// Converts IFCT 2017 (NIN, via MIT-licensed @ifct2017/compositions) into src/data/ifct.json.
// Run: npm run build:foods   (output is committed; re-run only if the source package updates)
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import Papa from 'papaparse'

const require = createRequire(import.meta.url)
const csvPath = require.resolve('@ifct2017/compositions/index.csv')
const { data } = Papa.parse(readFileSync(csvPath, 'utf8'), { header: true, skipEmptyLines: true })
const col = (row, key) => row[Object.keys(row).find((k) => k.endsWith('; ' + key))]
const num = (v) => (v === '' || v == null ? 0 : Math.round(parseFloat(v) * 10) / 10)

const foods = data.map((r) => {
  const lang = col(r, 'lang') || ''
  const hindi = lang.match(/\bH\.\s*([^;]+)/)?.[1]?.trim()
  return {
    id: 'ifct:' + col(r, 'code'),
    name: col(r, 'name'),
    group: col(r, 'grup'),
    hi: hindi && hindi !== '-' ? hindi : undefined,
    kcal: Math.round(parseFloat(col(r, 'enerc')) / 4.184), // IFCT energy is kJ
    p: num(col(r, 'protcnt')),
    c: num(col(r, 'choavldf')),
    f: num(col(r, 'fatce')),
    fib: num(col(r, 'fibtg')),
  }
}).filter((f) => f.name && Number.isFinite(f.kcal))

writeFileSync(new URL('../src/data/ifct.json', import.meta.url), JSON.stringify(foods))
console.log(`wrote ${foods.length} IFCT foods`)

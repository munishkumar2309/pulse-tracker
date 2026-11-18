// Read a statement file into rows (string[][]). Heavy libraries are loaded only when needed.
// PDF: text items are grouped into lines, then assigned to the header's columns by x position.

export class PdfPasswordError extends Error {
  constructor(public wrong: boolean) {
    super(wrong ? 'That password did not open the PDF.' : 'This PDF is password-protected.')
  }
}

export async function readStatementFile(file: File, password?: string): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || file.type === 'text/csv') return readCsv(await file.text())
  if (/\.(xlsx|xls)$/.test(name)) return readXlsx(await file.arrayBuffer())
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(await file.arrayBuffer(), password)
  throw new Error('Use a CSV, Excel (.xlsx/.xls) or PDF statement.')
}

async function readCsv(text: string): Promise<string[][]> {
  const Papa = (await import('papaparse')).default
  return Papa.parse<string[]>(text, { skipEmptyLines: true }).data
}

async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'array', cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' })
}

interface Item { x: number; w: number; str: string }
interface Line { page: number; y: number; items: Item[] }

async function readPdf(buf: ArrayBuffer, password?: string): Promise<string[][]> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  let doc
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf), password }).promise
  } catch (e) {
    const err = e as { name?: string; code?: number }
    if (err.name === 'PasswordException') throw new PdfPasswordError(err.code === 2)
    throw e
  }

  // 1. Text items → lines (same y within 3pt), sorted left to right.
  const lines: Line[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    const pageLines: Line[] = []
    for (const it of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!it.str?.trim()) continue
      const y = it.transform[5]
      const line = pageLines.find((l) => Math.abs(l.y - y) < 3) ?? (pageLines.push({ page: p, y, items: [] }), pageLines[pageLines.length - 1])
      line.items.push({ x: it.transform[4], w: it.width, str: it.str.trim() })
    }
    pageLines.sort((a, b) => b.y - a.y) // PDF y grows upwards
    for (const l of pageLines) l.items.sort((a, b) => a.x - b.x)
    lines.push(...pageLines)
  }

  // 2. Find the header line (needs a date word and a description word).
  const headerIdx = lines.findIndex((l) => {
    const t = l.items.map((i) => i.str).join(' ').toLowerCase()
    return /date/.test(t) && /(narration|description|particulars|remarks|details)/.test(t)
  })
  if (headerIdx < 0) return lines.map((l) => mergeItems(l.items).map((c) => c.str))
  const header = mergeItems(lines[headerIdx].items)
  const centers = header.map((h) => h.x + h.w / 2)
  const colOf = (it: Item) => {
    const c = it.x + it.w / 2
    let best = 0
    for (let i = 1; i < centers.length; i++) if (Math.abs(centers[i] - c) < Math.abs(centers[best] - c)) best = i
    return best
  }

  // 3. Assign each item to the nearest header column; lines without a date continue the previous narration.
  const rows: string[][] = [header.map((h) => h.str)]
  const dateCol = header.findIndex((h) => /date/i.test(h.str))
  const narrCol = header.findIndex((h) => /(narration|description|particulars|remarks|details)/i.test(h.str))
  for (const l of lines.slice(headerIdx + 1)) {
    const row = header.map(() => '')
    for (const it of l.items) {
      const c = colOf(it)
      row[c] = row[c] ? `${row[c]} ${it.str}` : it.str
    }
    const text = row.join(' ')
    if (/date/i.test(row[dateCol]) && /(narration|description|particulars)/i.test(text)) continue // repeated header on new page
    if (!/\d/.test(row[dateCol]) && row[narrCol] && rows.length > 1) {
      rows[rows.length - 1][narrCol] += ' ' + row[narrCol]
      continue
    }
    rows.push(row)
  }
  return rows
}

/** Join items that sit close together (gap < 4pt) into one cell. */
function mergeItems(items: Item[]): Item[] {
  const cells: Item[] = []
  for (const it of items) {
    const last = cells[cells.length - 1]
    if (last && it.x - (last.x + last.w) < 4) {
      last.str += ' ' + it.str
      last.w = it.x + it.w - last.x
    } else cells.push({ ...it })
  }
  return cells
}

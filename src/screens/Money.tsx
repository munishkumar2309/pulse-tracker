// Money: month total → category bar → habit callouts → budgets → recurring → transactions.
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Field, PrimaryButton, Sheet } from '../components/Sheet'
import { CATEGORIES, CATEGORY_BY_NAME } from '../data/categories'
import { db, type Channel, type Transaction } from '../db/schema'
import { dayKey, formatINR, formatINRShort } from '../lib/format'
import { addManualTxn, ingestSms, ingestStatement, setCategory, splitPasted, type IngestResult } from '../money/ingest'
import { PdfPasswordError, readStatementFile } from '../money/statementFiles'
import { detectColumns, rowsToTxns, type StatementTxn } from '../money/statementImport'
import { budgetStatus, byCategory, categoryShifts, habits, inMonth, monthSummary, prevMonth, recurring, topMerchants } from '../money/insights'

const catColor = (name: string) => `var(--cat-${CATEGORY_BY_NAME[name]?.color ?? 'c19'})`
const monthName = (m: string) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

export function Money() {
  const [month, setMonth] = useState(dayKey().slice(0, 7))
  const [filter, setFilter] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'sms' | 'manual' | 'statement' | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const all = useLiveQuery(() => db.transactions.where('date').aboveOrEqual(prevMonth(month, 3) + '-01').toArray(), [month])
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])

  const view = useMemo(() => {
    if (!all) return null
    const cur = inMonth(all, month)
    const cats = byCategory(cur)
    const now = new Date()
    const isThisMonth = month === dayKey().slice(0, 7)
    const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
    return {
      cur, cats,
      summary: monthSummary(all, month),
      // Only compare once there is at least one earlier month of data.
      shifts: all.some((t) => t.date < month + '-01') ? categoryShifts(all, month).slice(0, 3) : [],
      habit: habits(cur),
      rec: recurring(all),
      top: topMerchants(cur, 5),
      budget: budgets?.length ? budgetStatus(cats, budgets, isThisMonth ? now.getDate() : dim, dim) : [],
    }
  }, [all, month, budgets])

  if (!view) return null
  const { summary, cats, cur } = view
  const list = cur.filter((t) => !filter || t.category === filter).sort((a, b) => b.at.localeCompare(a.at))
  const isFuture = month >= dayKey().slice(0, 7)

  return (
    <div className="px-4 pt-5">
      <header className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(prevMonth(month))} className="p-2 -ml-2 text-muted"><ChevronLeft size={22} /></button>
        <h1 className="text-[17px] font-semibold">{monthName(month)}</h1>
        <button type="button" aria-label="Next month" disabled={isFuture} onClick={() => setMonth(prevMonth(month, -1))} className="p-2 -mr-2 text-muted disabled:opacity-25"><ChevronRight size={22} /></button>
      </header>

      <section className="mt-4">
        <p className="text-[13px] text-muted">Spent</p>
        <p className="num text-[46px] font-bold leading-none text-money">{formatINR(summary.spend)}</p>
        <p className="mt-2 text-[14px] text-muted">
          {summary.changePct === null ? 'No spending recorded last month to compare with.' : (
            <><span className={summary.changePct > 0 ? 'text-bad' : 'text-ok'}>{summary.changePct > 0 ? '+' : ''}{summary.changePct}%</span> compared with {formatINR(summary.prevSpend)} last month</>
          )}
        </p>
        {summary.income > 0 && <p className="text-[14px] text-muted">Money in: <span className="text-ink num-tight">{formatINR(summary.income)}</span></p>}
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <PrimaryButton type="button" onClick={() => setSheet('sms')}>Add bank SMS</PrimaryButton>
        <button type="button" onClick={() => setSheet('manual')} className="rounded-[12px] border border-line py-3 text-[16px] font-semibold">Add expense</button>
      </div>
      <button type="button" onClick={() => setSheet('statement')} className="mt-3 text-[14px] text-money font-medium py-1">Import a bank statement (PDF, Excel or CSV)</button>

      {cats.length > 0 ? (
        <section className="mt-7" aria-label="Where it went">
          <h2 className="text-[15px] font-semibold">Where it went</h2>
          <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label="Spending split by category">
            {cats.map((c) => (
              <div key={c.category} style={{ width: `${(c.paise / summary.spend) * 100}%`, background: catColor(c.category) }} className="h-full first:rounded-l-full last:rounded-r-full border-r-2 border-bg last:border-r-0" />
            ))}
          </div>
          <ul className="mt-3">
            {cats.map((c) => (
              <li key={c.category}>
                <button type="button" onClick={() => setFilter(filter === c.category ? null : c.category)}
                  className={`flex w-full items-center gap-3 py-2.5 text-left ${filter && filter !== c.category ? 'opacity-40' : ''}`} aria-pressed={filter === c.category}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: catColor(c.category) }} />
                  <span className="flex-1 text-[15px]">{c.category}<span className="text-muted text-[13px]"> ({c.count})</span></span>
                  <span className="num-tight text-[15px] font-semibold">{formatINR(c.paise)}</span>
                  <span className="w-10 text-right text-[13px] text-muted">{Math.round((c.paise / summary.spend) * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-8 text-[15px] text-muted">No spending recorded for {monthName(month)}. Paste your bank SMS with "Add bank SMS" to fill this in.</p>
      )}

      <HabitNotes view={view} />

      {view.budget.length > 0 && (
        <section className="mt-7" aria-label="Budgets">
          <h2 className="text-[15px] font-semibold">Budgets</h2>
          <ul className="mt-2 space-y-3">
            {view.budget.map((b) => (
              <li key={b.category}>
                <div className="flex justify-between text-[14px]"><span>{b.category}</span><span className="num-tight">{formatINRShort(b.spent)} <span className="text-muted">of {formatINRShort(b.monthlyPaise)}</span></span></div>
                <div className="mt-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.pct)}%`, background: b.status === 'over' ? 'var(--bad)' : b.status === 'ahead' ? 'var(--body)' : 'var(--money)' }} />
                </div>
                {b.status !== 'ok' && <p className="mt-1 text-[12.5px] text-muted">{b.status === 'over' ? 'Over budget' : 'Spending faster than the month is passing'}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.top.length > 0 && (
        <section className="mt-7" aria-label="Top places">
          <h2 className="text-[15px] font-semibold">Where you spend most</h2>
          <ol className="mt-2">
            {view.top.map((m) => (
              <li key={m.merchant} className="flex justify-between py-2 text-[15px] border-b border-line last:border-0">
                <span>{m.merchant} <span className="text-muted text-[13px]">{m.count}×</span></span>
                <span className="num-tight font-semibold">{formatINR(m.paise)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.rec.length > 0 && (
        <section className="mt-7" aria-label="Repeating payments">
          <h2 className="text-[15px] font-semibold">Repeating payments</h2>
          <ul className="mt-2">
            {view.rec.map((r) => (
              <li key={r.merchant} className="flex justify-between py-2 text-[15px] border-b border-line last:border-0">
                <span>{r.merchant}<span className="block text-[12.5px] text-muted">Next around {new Date(r.nextExpected + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                <span className="num-tight font-semibold">{formatINR(r.avgPaise)}<span className="text-muted text-[12px] font-normal">/mo</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length > 0 && (
        <section className="mt-7" aria-label="Transactions">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">{filter ?? 'All transactions'}</h2>
            {filter && <button type="button" onClick={() => setFilter(null)} className="text-[14px] text-money">Show all</button>}
          </div>
          <ul className="mt-2">
            {list.slice(0, 100).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-3 py-2.5 text-left border-b border-line">
                  <span className="text-[18px] w-6 text-center" aria-hidden>{CATEGORY_BY_NAME[t.category]?.icon ?? '•'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[15px]">{t.merchant}</span>
                    <span className="block text-[12.5px] text-muted">{new Date(t.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {t.category}{t.excluded ? ' (not counted)' : ''}</span>
                  </span>
                  <span className={`num-tight text-[15px] font-semibold ${t.type === 'credit' ? 'text-ok' : ''}`}>{t.type === 'credit' ? '+' : ''}{formatINR(t.amountPaise)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={sheet === 'sms'} onClose={() => setSheet(null)} title="Add bank SMS"><SmsPaste /></Sheet>
      <Sheet open={sheet === 'manual'} onClose={() => setSheet(null)} title="Add expense"><ManualForm onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={sheet === 'statement'} onClose={() => setSheet(null)} title="Import bank statement"><StatementImport onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Change category">{editing && <CategoryEditor t={editing} onDone={() => setEditing(null)} />}</Sheet>
    </div>
  )
}

function HabitNotes({ view }: { view: { shifts: ReturnType<typeof categoryShifts>; habit: ReturnType<typeof habits>; summary: { spend: number } } }) {
  const notes: string[] = []
  for (const s of view.shifts) {
    if (s.pct === null) notes.push(`New this month: ${formatINR(s.now)} on ${s.category}.`)
    else notes.push(`${s.category} is ${s.pct > 0 ? 'up' : 'down'} ${Math.abs(s.pct)}% on your 3-month average (${formatINR(s.now)} against ${formatINR(s.avg)}).`)
  }
  const h = view.habit
  if (h.weekendAvgPerDay && h.weekdayAvgPerDay && h.weekendAvgPerDay > h.weekdayAvgPerDay * 1.5)
    notes.push(`You spend about ${formatINR(h.weekendAvgPerDay)} a day at weekends, against ${formatINR(h.weekdayAvgPerDay)} on weekdays.`)
  if (h.lateNight.count >= 3) notes.push(`${h.lateNight.count} payments after 10 pm this month, adding up to ${formatINR(h.lateNight.paise)}.`)
  if (h.foodDelivery.count >= 8) notes.push(`${h.foodDelivery.count} food deliveries this month, ${formatINR(h.foodDelivery.paise)} in total.`)
  if (!notes.length) return null
  return (
    <section className="mt-7" aria-label="Spending habits">
      <h2 className="text-[15px] font-semibold">Worth knowing</h2>
      <ul className="mt-2 space-y-2.5">
        {notes.map((n) => <li key={n} className="border-l-2 border-money pl-3 text-[14.5px] leading-snug">{n}</li>)}
      </ul>
    </section>
  )
}

function SmsPaste() {
  const [text, setText] = useState('')
  const [res, setRes] = useState<IngestResult | null>(null)
  const parts = splitPasted(text)
  if (res) {
    return (
      <div className="text-[15px] space-y-3">
        <p><b className="num-tight">{res.added.length}</b> {plural(res.added.length, 'transaction')} added{res.duplicates ? `, ${res.duplicates} already saved` : ''}{res.skipped.length ? `, ${res.skipped.length} ${plural(res.skipped.length, 'message')} skipped` : ''}.</p>
        {res.added.length > 0 && (
          <ul className="text-[14px]">
            {res.added.slice(0, 8).map((t) => <li key={t.id} className="flex justify-between py-1 border-b border-line"><span>{t.merchant} <span className="text-muted">({t.category})</span></span><span className="num-tight">{formatINR(t.amountPaise)}</span></li>)}
          </ul>
        )}
        {res.skipped.length > 0 && (
          <details className="text-[13px] text-muted">
            <summary>Why messages were skipped</summary>
            <ul className="mt-2 space-y-2">{res.skipped.map((s, i) => <li key={i}><b>{REASON[s.reason]}</b>: {s.body.slice(0, 90)}…</li>)}</ul>
          </details>
        )}
        <PrimaryButton type="button" onClick={() => { setRes(null); setText('') }}>Add more</PrimaryButton>
      </div>
    )
  }
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setRes(await ingestSms(parts.map((body) => ({ body })))) }}>
      <Field label="Paste bank or card SMS" hint="Leave a blank line between messages. OTPs, reminders and offers are ignored. On Android this happens automatically.">
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Sent Rs.500.00 From HDFC Bank A/C *1234 To SWIGGY On 18/11/26 Ref 4321…'} />
      </Field>
      <PrimaryButton disabled={!parts.length}>{parts.length > 1 ? `Read ${parts.length} messages` : 'Read message'}</PrimaryButton>
    </form>
  )
}

function StatementImport({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [needPw, setNeedPw] = useState<string | null>(null)
  const [rows, setRows] = useState<StatementTxn[] | null>(null)
  const [account, setAccount] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ added: number; duplicates: number } | null>(null)

  async function read(f: File, pw?: string) {
    setBusy(true)
    setError('')
    try {
      const raw = await readStatementFile(f, pw)
      const map = detectColumns(raw)
      if (!map) throw new Error("Couldn't find the date, description and amount columns in this file. Try the Excel or CSV download from your bank's net banking.")
      const txns = rowsToTxns(raw, map)
      if (!txns.length) throw new Error('Found the columns but no transactions under them.')
      setRows(txns)
      setNeedPw(null)
    } catch (e) {
      if (e instanceof PdfPasswordError) setNeedPw(e.message)
      else setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="text-[15px] space-y-4">
        <p><b className="num-tight">{done.added}</b> {plural(done.added, 'transaction')} imported{done.duplicates ? `. ${done.duplicates} were already saved from your SMS and were skipped` : ''}.</p>
        <PrimaryButton type="button" onClick={onDone}>Done</PrimaryButton>
      </div>
    )
  }

  if (rows) {
    const debits = rows.filter((r) => r.type === 'debit')
    const from = rows.map((r) => r.date).sort()[0]
    const to = rows.map((r) => r.date).sort().at(-1)!
    const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    return (
      <div>
        <p className="text-[15px]">Found <b>{rows.length}</b> transactions from {fmt(from)} to {fmt(to)}: {debits.length} payments out, {rows.length - debits.length} money in.</p>
        <ul className="mt-3 text-[14px]">
          {rows.slice(0, 6).map((r, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5 border-b border-line">
              <span className="truncate">{r.merchant}<span className="text-muted"> {new Date(r.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
              <span className={`num-tight shrink-0 ${r.type === 'credit' ? 'text-ok' : ''}`}>{r.type === 'credit' ? '+' : ''}{formatINR(r.amountPaise)}</span>
            </li>
          ))}
        </ul>
        {rows.length > 6 && <p className="mt-1 text-[13px] text-muted">and {rows.length - 6} more</p>}
        <Field label="Account last 4 digits (optional)" hint="Helps tell accounts apart if you import more than one.">
          <input inputMode="numeric" maxLength={4} value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <PrimaryButton type="button" disabled={busy} onClick={async () => { setBusy(true); setDone(await ingestStatement(rows, account || undefined)) }}>Import {rows.length} transactions</PrimaryButton>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (file) read(file, password || undefined) }}>
      <p className="mb-4 text-[14px] text-muted leading-relaxed">Download a statement from your bank's app or net banking and choose it here. The file is read on this phone and never uploaded. Payments already captured from SMS are skipped.</p>
      <Field label="Statement file">
        <input type="file" accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setNeedPw(null); setError(''); if (f) read(f) }} />
      </Field>
      {needPw && (
        <Field label="PDF password" hint={`${needPw} Banks usually use a mix of your name, date of birth or customer ID; check the email it came with.`}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
      )}
      {error && <p className="mb-3 text-[14px] text-bad" role="alert">{error}</p>}
      {busy && <p className="mb-3 text-[14px] text-muted" role="status">Reading the statement…</p>}
      {needPw && <PrimaryButton disabled={!password || busy}>Open PDF</PrimaryButton>}
    </form>
  )
}

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`)
const REASON = { otp: 'OTP', not_transaction: 'Not a transaction', future_or_reminder: 'Reminder or request', failed: 'Failed payment', no_amount: 'No amount found' } as const

function ManualForm({ onDone }: { onDone: () => void }) {
  const [rupees, setRupees] = useState(0)
  const [merchant, setMerchant] = useState('')
  const [category, setCat] = useState('')
  const [date, setDate] = useState(dayKey())
  const [channel, setChannel] = useState<Channel>('upi')
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await addManualTxn({ date, at: new Date(date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(), amountPaise: Math.round(rupees * 100), type: 'debit', merchant: merchant.trim(), channel, category: category || undefined })
      onDone()
    }}>
      <Field label="Amount (₹)"><input type="number" inputMode="decimal" step="0.01" value={rupees || ''} onChange={(e) => setRupees(+e.target.value)} autoFocus /></Field>
      <Field label="Paid to"><input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Chai stall, auto, Swiggy…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select value={category} onChange={(e) => setCat(e.target.value)}>
            <option value="">Work it out for me</option>
            {CATEGORIES.filter((c) => !c.income).map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Paid by">
          <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            <option value="upi">UPI</option><option value="card">Card</option><option value="other">Cash</option><option value="netbanking">Net banking</option>
          </select>
        </Field>
      </div>
      <Field label="Date"><input type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value)} /></Field>
      <PrimaryButton disabled={!(rupees > 0 && merchant.trim())}>Add expense</PrimaryButton>
    </form>
  )
}

function CategoryEditor({ t, onDone }: { t: Transaction; onDone: () => void }) {
  const [always, setAlways] = useState(true)
  return (
    <div>
      <p className="text-[15px]"><b>{t.merchant}</b>, <span className="num-tight">{formatINR(t.amountPaise)}</span></p>
      {t.raw && <p className="mt-1 text-[12.5px] text-muted leading-snug">{t.raw}</p>}
      <label className="mt-4 flex items-center gap-3 text-[15px]">
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--money)]" />
        Use this for every payment to {t.merchant}
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.name} type="button" onClick={async () => { await setCategory(t.id, c.name, always); onDone() }}
            className={`flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[14px] ${t.category === c.name ? 'bg-money text-[#0E1822] font-semibold' : 'bg-surface-2'}`}>
            <span aria-hidden>{c.icon}</span>{c.name}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Transfers aren't counted as spending (card bill payments, moving money between your own accounts).</p>
    </div>
  )
}

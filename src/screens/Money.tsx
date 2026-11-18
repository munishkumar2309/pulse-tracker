// Money: month summary → interactive donut by category → spend bars (day/week/month) → budgets → habits →
// top places → repeating payments; Transactions tab with recategorise. Sheets: SMS paste, expense, statement.
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, FileUp, MessageSquareText, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { AnimatedNumber, Page } from '../components/motion'
import { Field, PrimaryButton, Sheet } from '../components/Sheet'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '../components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group'
import { CATEGORIES, CATEGORY_BY_NAME } from '../data/categories'
import { db, type Channel, type Transaction } from '../db/schema'
import { dayKey, formatINR, formatINRShort } from '../lib/format'
import { addManualTxn, ingestSms, ingestStatement, setCategory, splitPasted, type IngestResult } from '../money/ingest'
import { PdfPasswordError, readStatementFile } from '../money/statementFiles'
import { detectColumns, rowsToTxns, type StatementTxn } from '../money/statementImport'
import { budgetStatus, byCategory, categoryShifts, dailySpend, habits, inMonth, isSpend, monthSummary, prevMonth, recurring, topMerchants } from '../money/insights'
import { tap } from '../native/haptics'

const catColor = (name: string) => `var(--cat-${CATEGORY_BY_NAME[name]?.color ?? 'c19'})`
const monthName = (m: string) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const shortMonth = (m: string) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'short' })
const spendChart = { rupees: { label: 'Spent', color: 'var(--primary)' } } satisfies ChartConfig
type Range = 'day' | 'week' | 'month'

export function Money() {
  const [month, setMonth] = useState(dayKey().slice(0, 7))
  const [filter, setFilter] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('day')
  const [tab, setTab] = useState('overview')
  const [sheet, setSheet] = useState<'sms' | 'manual' | 'statement' | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const all = useLiveQuery(() => db.transactions.where('date').aboveOrEqual(prevMonth(month, 5) + '-01').toArray(), [month])
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])

  const view = useMemo(() => {
    if (!all) return null
    const cur = inMonth(all, month)
    const cats = byCategory(cur)
    const isThisMonth = month === dayKey().slice(0, 7)
    const dim = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate()
    const lastDay = isThisMonth ? new Date().getDate() : dim
    // Bars for the chosen range.
    let bars: { label: string; rupees: number }[] = []
    if (range === 'day') {
      bars = dailySpend(cur, `${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`).map((d) => ({ label: String(+d.date.slice(8)), rupees: Math.round(d.paise / 100) }))
    } else if (range === 'week') {
      const end = isThisMonth ? new Date() : new Date(+month.slice(0, 4), +month.slice(5, 7), 0)
      const monday = new Date(end); monday.setDate(end.getDate() - ((end.getDay() + 6) % 7))
      bars = [...Array(8)].map((_, i) => {
        const s = new Date(monday); s.setDate(monday.getDate() - (7 - i) * 7 + 7)
        const e = new Date(s); e.setDate(s.getDate() + 6)
        const paise = all.filter((t) => isSpend(t) && t.date >= dayKey(s) && t.date <= dayKey(e)).reduce((a, t) => a + t.amountPaise, 0)
        return { label: s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), rupees: Math.round(paise / 100) }
      })
    } else {
      bars = [...Array(6)].map((_, i) => {
        const m = prevMonth(month, 5 - i)
        return { label: shortMonth(m), rupees: Math.round(monthSummary(all, m).spend / 100) }
      })
    }
    return {
      cur, cats, bars,
      summary: monthSummary(all, month),
      shifts: all.some((t) => t.date < month + '-01') ? categoryShifts(all, month).slice(0, 3) : [],
      habit: habits(cur),
      rec: recurring(all),
      top: topMerchants(cur, 5),
      budget: budgets?.length ? budgetStatus(cats, budgets, lastDay, dim) : [],
    }
  }, [all, month, budgets, range])

  if (!view) return null
  const { summary, cats, cur } = view
  const list = cur.filter((t) => !filter || t.category === filter).sort((a, b) => b.at.localeCompare(a.at))
  const isFuture = month >= dayKey().slice(0, 7)
  const selected = filter ? cats.find((c) => c.category === filter) : null
  const pick = (c: string | null) => { tap(); setFilter(c === filter ? null : c) }

  return (
    <Page>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-tight">Money</h1>
        <div className="flex items-center rounded-full bg-card shadow-[var(--shadow-card)]">
          <button type="button" aria-label="Previous month" onClick={() => { tap(); setMonth(prevMonth(month)); setFilter(null) }} className="p-2 text-muted-foreground"><ChevronLeft size={20} /></button>
          <span className="min-w-[96px] text-center text-[14px] font-semibold">{monthName(month)}</span>
          <button type="button" aria-label="Next month" disabled={isFuture} onClick={() => { tap(); setMonth(prevMonth(month, -1)); setFilter(null) }} className="p-2 text-muted-foreground disabled:opacity-25"><ChevronRight size={20} /></button>
        </div>
      </header>

      <div className="card p-5">
        <p className="text-[13px] text-muted-foreground">Spent this month</p>
        <AnimatedNumber value={summary.spend / 100} format={(n) => formatINR(Math.round(n) * 100)} className="block text-[40px] leading-tight text-primary" />
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13.5px] text-muted-foreground">
          {summary.changePct === null ? <span>No spending last month to compare.</span> : (
            <span className="rounded-full px-2 py-0.5 text-[12.5px] font-semibold" style={{ background: `color-mix(in srgb, ${summary.changePct > 0 ? 'var(--bad)' : 'var(--ok)'} 14%, transparent)`, color: summary.changePct > 0 ? 'var(--bad)' : 'var(--ok)' }}>
              {summary.changePct > 0 ? '▲' : '▼'} {Math.abs(summary.changePct)}% vs last month
            </span>
          )}
          {summary.income > 0 && <span>Money in <b className="num-tight text-foreground">{formatINR(summary.income)}</b></span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Action icon={<MessageSquareText size={18} />} label="Bank SMS" onClick={() => setSheet('sms')} primary />
          <Action icon={<Plus size={18} />} label="Expense" onClick={() => setSheet('manual')} />
          <Action icon={<FileUp size={18} />} label="Statement" onClick={() => setSheet('statement')} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { tap(); setTab(v) }} className="mt-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="txns">Transactions ({cur.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-3">
          {cats.length === 0 ? (
            <div className="card p-5 text-[15px] text-muted-foreground">No spending recorded for {monthName(month)}. New bank SMS are read automatically; you can also add an expense or import a statement.</div>
          ) : (
            <section className="card p-4" aria-label="Where it went">
              <h2 className="text-[16px] font-semibold">Where it went</h2>
              <p className="text-[12.5px] text-muted-foreground">Tap a slice or a category to see its payments.</p>
              <div className="relative mx-auto mt-2 h-[220px] w-[220px]">
                <PieChart width={220} height={220}>
                  <Pie data={cats} dataKey="paise" nameKey="category" innerRadius={68} outerRadius={104} paddingAngle={2} cornerRadius={6} stroke="none"
                    animationDuration={900} onClick={(_, i) => pick(cats[i].category)}>
                    {cats.map((c) => <Cell key={c.category} fill={catColor(c.category)} opacity={!filter || filter === c.category ? 1 : 0.25} style={{ cursor: 'pointer', outline: 'none' }} />)}
                  </Pie>
                </PieChart>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="max-w-[120px] truncate text-[12.5px] text-muted-foreground">{selected ? selected.category : 'Total spent'}</span>
                  <span className="num text-[22px]">{formatINRShort(selected ? selected.paise : summary.spend)}</span>
                  <span className="text-[12px] text-muted-foreground">{selected ? `${Math.round((selected.paise / summary.spend) * 100)}% · ${selected.count} payments` : `${cats.length} categories`}</span>
                </div>
              </div>
              <ul className="mt-2">
                {cats.map((c, i) => (
                  <motion.li key={c.category} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <button type="button" onClick={() => pick(c.category)} aria-pressed={filter === c.category}
                      className={`flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors ${filter === c.category ? 'bg-muted' : ''} ${filter && filter !== c.category ? 'opacity-45' : ''}`}>
                      <span className="text-[18px] w-6 text-center" aria-hidden>{CATEGORY_BY_NAME[c.category]?.icon ?? '•'}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14.5px]">{c.category}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                          <motion.span className="block h-full rounded-full" style={{ background: catColor(c.category) }} initial={{ width: 0 }} animate={{ width: `${(c.paise / cats[0].paise) * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.03 }} />
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block num-tight text-[14.5px] font-semibold">{formatINR(c.paise)}</span>
                        <span className="block text-[12px] text-muted-foreground">{Math.round((c.paise / summary.spend) * 100)}%</span>
                      </span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              {filter && <button type="button" onClick={() => setTab('txns')} className="mt-2 w-full rounded-[12px] bg-accent py-2.5 text-[14px] font-semibold text-accent-foreground">See {filter} payments</button>}
            </section>
          )}

          <section className="card p-4" aria-label="Spending over time">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold">Spending over time</h2>
              <ToggleGroup type="single" value={range} onValueChange={(v) => { if (v) { tap(); setRange(v as Range) } }} variant="outline" size="sm">
                <ToggleGroupItem value="day">Day</ToggleGroupItem>
                <ToggleGroupItem value="week">Week</ToggleGroupItem>
                <ToggleGroupItem value="month">Month</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ChartContainer config={spendChart} className="mt-3 h-[190px] w-full">
              <BarChart data={view.bars} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} minTickGap={range === 'day' ? 10 : 4} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatINRShort(v * 100)} />
                <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent formatter={(v) => formatINR(Number(v) * 100)} />} />
                <Bar dataKey="rupees" fill="var(--color-rupees)" radius={[6, 6, 2, 2]} animationDuration={800} />
              </BarChart>
            </ChartContainer>
          </section>

          {view.budget.length > 0 && (
            <section className="card p-4" aria-label="Budgets">
              <h2 className="mb-2 text-[16px] font-semibold">Budgets</h2>
              <ul className="space-y-3">
                {view.budget.map((b) => (
                  <li key={b.category}>
                    <div className="flex justify-between text-[14px]"><span>{b.category}</span><span className="num-tight">{formatINRShort(b.spent)} <span className="text-muted-foreground">of {formatINRShort(b.monthlyPaise)}</span></span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, b.pct)}%` }} transition={{ duration: 0.8 }}
                        style={{ background: b.status === 'over' ? 'var(--bad)' : b.status === 'ahead' ? 'var(--warn)' : 'var(--primary)' }} />
                    </div>
                    {b.status !== 'ok' && <p className="mt-1 text-[12.5px] text-muted-foreground">{b.status === 'over' ? 'Over budget' : 'Spending faster than the month is passing'}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <HabitNotes view={view} />

          {view.top.length > 0 && (
            <section className="card p-4" aria-label="Top places">
              <h2 className="text-[16px] font-semibold">Where you spend most</h2>
              <ol className="mt-1">
                {view.top.map((m) => (
                  <li key={m.merchant} className="flex justify-between border-b border-border py-2.5 text-[14.5px] last:border-0">
                    <span>{m.merchant} <span className="text-[12.5px] text-muted-foreground">{m.count}×</span></span>
                    <span className="num-tight font-semibold">{formatINR(m.paise)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {view.rec.length > 0 && (
            <section className="card p-4" aria-label="Repeating payments">
              <h2 className="text-[16px] font-semibold">Repeating payments</h2>
              <ul className="mt-1">
                {view.rec.map((r) => (
                  <li key={r.merchant} className="flex justify-between border-b border-border py-2.5 text-[14.5px] last:border-0">
                    <span>{r.merchant}<span className="block text-[12.5px] text-muted-foreground">Next around {new Date(r.nextExpected + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                    <span className="num-tight font-semibold">{formatINR(r.avgPaise)}<span className="text-[12px] font-normal text-muted-foreground">/mo</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        <TabsContent value="txns">
          <div className="card p-2">
            {filter && (
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <span className="text-[14px] font-semibold">{filter}</span>
                <button type="button" onClick={() => setFilter(null)} className="text-[13.5px] font-semibold text-primary">Show all</button>
              </div>
            )}
            {list.length === 0 && <p className="p-3 text-[14px] text-muted-foreground">No transactions{filter ? ` in ${filter}` : ''} for {monthName(month)}.</p>}
            <ul>
              {list.slice(0, 150).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => { tap(); setEditing(t) }} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left active:bg-muted">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]" style={{ background: `color-mix(in srgb, ${catColor(t.category)} 16%, transparent)` }} aria-hidden>{CATEGORY_BY_NAME[t.category]?.icon ?? '•'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[14.5px]">{t.merchant}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{new Date(t.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {t.category}{t.excluded ? ' (not counted)' : ''}</span>
                    </span>
                    <span className={`num-tight text-[14.5px] font-semibold ${t.type === 'credit' ? 'text-ok' : ''}`}>{t.type === 'credit' ? '+' : ''}{formatINR(t.amountPaise)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={sheet === 'sms'} onClose={() => setSheet(null)} title="Add bank SMS"><SmsPaste /></Sheet>
      <Sheet open={sheet === 'manual'} onClose={() => setSheet(null)} title="Add expense"><ManualForm onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={sheet === 'statement'} onClose={() => setSheet(null)} title="Import bank statement"><StatementImport onDone={() => setSheet(null)} /></Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Change category">{editing && <CategoryEditor t={editing} onDone={() => setEditing(null)} />}</Sheet>
    </Page>
  )
}

function Action({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => { tap(); onClick() }}
      className={`flex flex-col items-center gap-1 rounded-[14px] py-2.5 text-[13px] font-semibold ${primary ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
      {icon}{label}
    </motion.button>
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
            {res.added.slice(0, 8).map((t) => <li key={t.id} className="flex justify-between py-1 border-b border-border"><span>{t.merchant} <span className="text-muted-foreground">({t.category})</span></span><span className="num-tight">{formatINR(t.amountPaise)}</span></li>)}
          </ul>
        )}
        {res.skipped.length > 0 && (
          <details className="text-[13px] text-muted-foreground">
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
            <li key={i} className="flex justify-between gap-3 py-1.5 border-b border-border">
              <span className="truncate">{r.merchant}<span className="text-muted-foreground"> {new Date(r.date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
              <span className={`num-tight shrink-0 ${r.type === 'credit' ? 'text-ok' : ''}`}>{r.type === 'credit' ? '+' : ''}{formatINR(r.amountPaise)}</span>
            </li>
          ))}
        </ul>
        {rows.length > 6 && <p className="mt-1 text-[13px] text-muted-foreground">and {rows.length - 6} more</p>}
        <Field label="Account last 4 digits (optional)" hint="Helps tell accounts apart if you import more than one.">
          <input inputMode="numeric" maxLength={4} value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <PrimaryButton type="button" disabled={busy} onClick={async () => { setBusy(true); setDone(await ingestStatement(rows, account || undefined)) }}>Import {rows.length} transactions</PrimaryButton>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (file) read(file, password || undefined) }}>
      <p className="mb-4 text-[14px] text-muted-foreground leading-relaxed">Download a statement from your bank's app or net banking and choose it here. The file is read on this phone and never uploaded. Payments already captured from SMS are skipped.</p>
      <Field label="Statement file">
        <input type="file" accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); setNeedPw(null); setError(''); if (f) read(f) }} />
      </Field>
      {needPw && (
        <Field label="PDF password" hint={`${needPw} Banks usually use a mix of your name, date of birth or customer ID; check the email it came with.`}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
      )}
      {error && <p className="mb-3 text-[14px] text-bad" role="alert">{error}</p>}
      {busy && <p className="mb-3 text-[14px] text-muted-foreground" role="status">Reading the statement…</p>}
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
      {t.raw && <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">{t.raw}</p>}
      <label className="mt-4 flex items-center gap-3 text-[15px]">
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--money)]" />
        Use this for every payment to {t.merchant}
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.name} type="button" onClick={async () => { await setCategory(t.id, c.name, always); onDone() }}
            className={`flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[14px] ${t.category === c.name ? 'bg-money text-primary-foreground font-semibold' : 'bg-muted'}`}>
            <span aria-hidden>{c.icon}</span>{c.name}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted-foreground">Transfers aren't counted as spending (card bill payments, moving money between your own accounts).</p>
    </div>
  )
}

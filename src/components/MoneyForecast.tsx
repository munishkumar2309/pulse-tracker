// Money → Forecast tab: this month's projection, where you're spending extra, next 3 months of spend and
// income, and how the forecasts are made. All estimates (labelled). Logic: src/money/forecast.ts.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from './ui/chart'
import { CATEGORY_BY_NAME } from '../data/categories'
import { db } from '../db/schema'
import { dayKey, formatINR, formatINRShort } from '../lib/format'
import { forecastIncome, forecastSpend, projectTotal, spendingExtra } from '../money/forecast'
import { prevMonth } from '../money/insights'

const monthLong = (m: string) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'long' })
const monthShort = (m: string) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', { month: 'short' })
const chartConfig = {
  spent: { label: 'Spent', color: 'var(--primary)' },
  forecast: { label: 'Forecast', color: 'color-mix(in srgb, var(--primary) 35%, transparent)' },
} satisfies ChartConfig

export function MoneyForecast() {
  const today = dayKey()
  const current = today.slice(0, 7)
  const day = +today.slice(8, 10)
  const all = useLiveQuery(() => db.transactions.where('date').aboveOrEqual(prevMonth(current, 13) + '-01').toArray(), [current])

  const f = useMemo(() => {
    if (!all) return null
    const spend = forecastSpend(all, current)
    const income = forecastIncome(all, current)
    const pace = projectTotal(all, current, day)
    const dim = new Date(+current.slice(0, 4), +current.slice(5, 7), 0).getDate()
    const expected = spend.months[0]?.value ?? 0
    return { spend, income, soFar: pace.soFar, expected, dim, pace, extra: spendingExtra(all, current, day) }
  }, [all, current, day])

  if (!f) return null
  const n = f.spend.history.length
  if (n === 0) {
    return (
      <div className="card p-5 text-[15px] leading-relaxed text-muted-foreground">
        Forecasts need at least one full month of transactions. Pulse reads the last 90 days of bank SMS on the first run, so this fills in soon. Importing a bank statement adds more history straight away.
      </div>
    )
  }

  const bars = [
    // One series per kind (stacked, so each month has one bar): solid = spent, light = forecast.
    ...f.spend.history.slice(-6).map((h) => ({ label: monthShort(h.month), spent: Math.round(h.value / 100) })),
    ...f.spend.months.map((m) => ({ label: monthShort(m.month), forecast: Math.round(m.value / 100) })),
  ]
  const over = f.pace.value - f.expected

  return (
    <div className="space-y-3">
      <section className="card p-4" aria-label="This month">
        <h2 className="text-[16px] font-semibold">{monthLong(current)} so far</h2>
        <p className="mt-1 text-[14.5px] leading-snug">
          Spent <b className="num-tight">{formatINR(f.soFar)}</b> in {day} {day === 1 ? 'day' : 'days'}. At this pace you'll reach about{' '}
          <b className="num-tight" style={{ color: over > f.expected * 0.1 ? 'var(--bad)' : undefined }}>{formatINR(f.pace.value)}</b> by {f.dim} {monthShort(current)}
          <span className="text-muted-foreground"> ({formatINRShort(f.pace.low)}–{formatINRShort(f.pace.high)})</span>.
        </p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Forecast for a normal {monthLong(current)}: {formatINR(f.expected)}.{' '}
          {Math.abs(over) < f.expected * 0.05 ? "You're right on track." : over > 0 ? `That's ${formatINR(over)} more than expected.` : `That's ${formatINR(-over)} less than expected.`}
        </p>
      </section>

      <section className="card p-4" aria-label="Where you're spending extra">
        <h2 className="text-[16px] font-semibold">Where you're spending extra</h2>
        {f.extra.length === 0 ? (
          <p className="mt-1 text-[14.5px] text-muted-foreground">Nothing unusual so far. Every category is within its normal range for you.</p>
        ) : (
          <ul className="mt-1">
            {f.extra.map((e) => (
              <li key={e.category} className="border-b border-border py-2.5 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]"><span aria-hidden>{CATEGORY_BY_NAME[e.category]?.icon ?? '•'} </span>{e.category}</span>
                  <span className="num-tight shrink-0 text-[14.5px] font-semibold" style={{ color: 'var(--bad)' }}>+{formatINR(e.extra)}</span>
                </div>
                <p className="text-[13px] leading-snug text-muted-foreground">
                  {e.isNew ? `New this month, heading for ${formatINR(e.projected)}.` : `Heading for ${formatINR(e.projected)} against your usual ${formatINR(e.usual)}.`}
                  {e.drivers.length > 0 && ` Mostly ${e.drivers.map((d) => `${d.merchant} (${formatINRShort(d.paise)}${d.usual ? `, usually ${formatINRShort(d.usual)}` : ', new'})`).join(' and ')}.`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4" aria-label="Next 3 months">
        <h2 className="text-[16px] font-semibold">Next 3 months</h2>
        <p className="text-[12.5px] text-muted-foreground">Solid: what you spent. Light: forecast.</p>
        <ChartContainer config={chartConfig} className="mt-2 h-[170px] w-full">
          <BarChart data={bars} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => formatINRShort(v * 100)} />
            <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent formatter={(v) => formatINR(Number(v) * 100)} />} />
            <Bar dataKey="spent" stackId="m" fill="var(--color-spent)" radius={[6, 6, 2, 2]} isAnimationActive={false} />
            <Bar dataKey="forecast" stackId="m" fill="var(--color-forecast)" radius={[6, 6, 2, 2]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
        <table className="mt-2 w-full text-[13.5px]">
          <thead className="text-left text-[12px] text-muted-foreground">
            <tr><th className="py-1 font-normal">Month</th><th className="font-normal text-right">Spend</th><th className="font-normal text-right">Income</th><th className="font-normal text-right">Left over</th></tr>
          </thead>
          <tbody>
            {f.spend.months.map((m, i) => {
              const inc = f.income.months[i]?.value ?? 0
              const left = inc - m.value
              return (
                <tr key={m.month} className="border-t border-border">
                  <td className="py-2">{monthShort(m.month)}</td>
                  <td className="num-tight text-right">{formatINRShort(m.value)}<span className="block text-[11.5px] text-muted-foreground">{formatINRShort(m.low)}–{formatINRShort(m.high)}</span></td>
                  <td className="num-tight text-right">{inc ? formatINRShort(inc) : '—'}</td>
                  <td className="num-tight text-right font-semibold" style={{ color: inc ? (left >= 0 ? 'var(--ok)' : 'var(--bad)') : undefined }}>{inc ? formatINRShort(left) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-4" aria-label="Expected income">
        <h2 className="text-[16px] font-semibold">Expected income</h2>
        {f.income.regular.length === 0 && f.income.otherTypical === 0 ? (
          <p className="mt-1 text-[14.5px] text-muted-foreground">No regular income found yet. Salary is picked up from bank SMS once it arrives in two of the last three months.</p>
        ) : (
          <>
            <ul className="mt-1">
              {f.income.regular.map((r) => (
                <li key={r.merchant} className="flex justify-between gap-3 border-b border-border py-2.5 text-[14.5px] last:border-0">
                  <span>{r.merchant}<span className="block text-[12.5px] text-muted-foreground">Regular · next around {new Date(r.nextDate + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                  <span className="num-tight font-semibold">{formatINR(r.monthly)}<span className="text-[12px] font-normal text-muted-foreground">/mo</span></span>
                </li>
              ))}
            </ul>
            {f.income.otherTypical > 0 && <p className="mt-1 text-[13.5px] text-muted-foreground">Plus about {formatINR(f.income.otherTypical)} a month from other credits (refunds, interest, transfers in), which varies.</p>}
            <p className="mt-2 text-[14.5px]">Expected next month: <b className="num-tight">{formatINR(f.income.months[0]?.value ?? 0)}</b></p>
          </>
        )}
      </section>

      <details className="card p-4 text-[13.5px] leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer text-[14.5px] font-semibold text-foreground">How these forecasts work</summary>
        <p className="mt-2">All figures are <b>estimates</b> from your own transactions on this phone ({n} full {n === 1 ? 'month' : 'months'} so far). Nothing is uploaded.</p>
        <p className="mt-2"><b>Monthly spend:</b> {f.spend.fit.method === 'holt-damped'
          ? `damped-trend exponential smoothing (Holt). Recent months count more, and any trend is assumed to level off rather than run away. Fitted to your data: α ${f.spend.fit.alpha}, β ${f.spend.fit.beta}, φ ${f.spend.fit.phi}.`
          : 'the average of your full months. The trend model starts once there are 3 full months.'} The range is an 80% band from how far past forecasts would have been off.</p>
        <p className="mt-2"><b>This month:</b> worked out per category. One-off payments like rent or an EMI count once (or are expected if not paid yet); everyday spending runs the remaining days at a blend of this month's pace and your usual pace, and later in the month this month's pace counts more.</p>
        <p className="mt-2"><b>Income:</b> credits from the same payer in most recent months at a similar amount (like salary) are counted at their median; other credits at their typical monthly amount. Raises and bonuses can't be predicted.</p>
        <p className="mt-2"><b>Spending extra:</b> a category is flagged when it's heading at least ₹500 and 20% above its usual month, and further above it than your normal month-to-month swings.</p>
        <p className="mt-2">Not counted: investments, transfers and card bill payments. Festival months (such as Diwali) can't be predicted until there's a year of history.</p>
      </details>
    </div>
  )
}

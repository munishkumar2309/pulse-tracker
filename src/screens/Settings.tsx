// Settings: profile, monthly budgets, appearance, backup/restore, delete data.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Field, PrimaryButton, Sheet } from '../components/Sheet'
import { CATEGORIES } from '../data/categories'
import { useLatestWeight, useProfile } from '../db/hooks'
import { db } from '../db/schema'
import { dayKey, formatINR } from '../lib/format'
import { ProfileForm } from './ProfileForm'
import { syncHealth } from '../native/health'
import { smsSupported, syncSmsInbox } from '../native/sms'

const TABLES = ['profile', 'weights', 'water', 'steps', 'sleep', 'transactions', 'rules', 'budgets', 'foods', 'foodLogs', 'meta'] as const

export function Settings() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const [sheet, setSheet] = useState<'profile' | 'budgets' | null>(null)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') ?? 'system' } catch { return 'system' } })
  const [msg, setMsg] = useState('')

  const applyTheme = (t: string) => {
    setTheme(t)
    try { localStorage.setItem('theme', t) } catch { /* private mode */ }
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }

  async function exportData() {
    const out: Record<string, unknown[]> = {}
    for (const t of TABLES) out[t] = await db.table(t).toArray()
    const blob = new Blob([JSON.stringify({ app: 'pulse', version: 1, exportedAt: new Date().toISOString(), data: out })], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pulse-backup-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup downloaded.')
  }

  async function importData(file: File) {
    try {
      const json = JSON.parse(await file.text())
      if (json.app !== 'pulse' || !json.data) throw new Error('This file is not a Pulse backup.')
      await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
        for (const t of TABLES) if (Array.isArray(json.data[t])) await db.table(t).bulkPut(json.data[t])
      })
      setMsg('Backup restored. Existing entries with the same ID were replaced.')
    } catch (e) {
      setMsg(`Restore failed: ${(e as Error).message}`)
    }
  }

  async function wipe() {
    if (!confirm('Delete all your Pulse data from this phone? This cannot be undone. Download a backup first if you want to keep it.')) return
    await db.delete()
    location.reload()
  }

  const totalBudget = (budgets ?? []).reduce((a, b) => a + b.monthlyPaise, 0)

  return (
    <div className="px-4 pt-5">
      <h1 className="text-[22px] font-semibold">Settings</h1>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        <Row title="Profile and goals" detail={profile ? `${profile.heightCm} cm, goal ${profile.goalWeightKg} kg` : ''} onClick={() => setSheet('profile')} />
        <Row title="Monthly budgets" detail={totalBudget ? `${formatINR(totalBudget)} a month across ${budgets!.length} categories` : 'Not set'} onClick={() => setSheet('budgets')} />
      </ul>

      <PhoneSync />

      <section className="mt-7">
        <h2 className="text-[15px] font-semibold">Appearance</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[['system', 'Match phone'], ['dark', 'Dark'], ['light', 'Light']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => applyTheme(v)} aria-pressed={theme === v}
              className={`rounded-[10px] py-2.5 text-[14px] ${theme === v ? 'bg-ink text-bg font-semibold' : 'bg-surface-2'}`}>{l}</button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[15px] font-semibold">Your data</h2>
        <p className="mt-1 text-[13.5px] text-muted">Everything is stored only on this phone. Download a backup now and then, and before changing phones.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={exportData} className="rounded-[10px] bg-surface-2 py-2.5 text-[14px]">Download backup</button>
          <label className="rounded-[10px] bg-surface-2 py-2.5 text-[14px] text-center cursor-pointer">
            Restore backup
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="mt-2 text-[13.5px]" role="status">{msg}</p>}
        <button type="button" onClick={wipe} className="mt-6 text-[14px] text-bad">Delete all data on this phone</button>
      </section>

      <p className="mt-10 mb-4 text-[12px] text-muted leading-relaxed">
        Health numbers here are estimates to guide you, not medical advice. Food data: IFCT 2017 (National Institute of Nutrition, ICMR) and Open Food Facts (ODbL).
      </p>

      <Sheet open={sheet === 'profile'} onClose={() => setSheet(null)} title="Profile and goals">
        {profile && <ProfileForm initial={profile} initialWeight={weight?.kg} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'budgets'} onClose={() => setSheet(null)} title="Monthly budgets"><BudgetForm onDone={() => setSheet(null)} /></Sheet>
    </div>
  )
}

function PhoneSync() {
  const meta = useLiveQuery(async () => ({
    sms: (await db.meta.get('smsLastResult'))?.value as { at: number; added: number; read: number } | undefined,
    health: (await db.meta.get('healthLastSync'))?.value as number | undefined,
  }), [])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const when = (t?: number) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never')

  if (!smsSupported()) {
    return (
      <section className="mt-7">
        <h2 className="text-[15px] font-semibold">Phone sync</h2>
        <p className="mt-1 text-[13.5px] text-muted">In the Android app, bank SMS and Health Connect (steps, sleep, weight) sync automatically. In a browser, paste SMS on the Money screen and log health by hand.</p>
      </section>
    )
  }
  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold">Phone sync</h2>
      <p className="mt-1 text-[13.5px] text-muted">
        Bank SMS: last read {when(meta?.sms?.at)}{meta?.sms ? `, ${meta.sms.added} new` : ''}. Health Connect: last synced {when(meta?.health)}.
      </p>
      <button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setNote('')
        try {
          const [, h] = await Promise.all([syncSmsInbox(), syncHealth(true)])
          setNote(h && !h.ok ? h.message : 'Up to date.')
        } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
      }} className="mt-3 w-full rounded-[10px] bg-surface-2 py-2.5 text-[14px]">
        {busy ? 'Syncing…' : 'Allow access and sync now'}
      </button>
      {note && <p className="mt-2 text-[13.5px]" role="status">{note}</p>}
    </section>
  )
}

function Row({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between py-3.5 text-left">
        <span className="text-[15.5px]">{title}<span className="block text-[13px] text-muted">{detail}</span></span>
        <span className="text-muted" aria-hidden>›</span>
      </button>
    </li>
  )
}

function BudgetForm({ onDone }: { onDone: () => void }) {
  const existing = useLiveQuery(() => db.budgets.toArray(), [])
  const [vals, setVals] = useState<Record<string, number> | null>(null)
  if (!existing) return null
  const v = vals ?? Object.fromEntries(existing.map((b) => [b.category, b.monthlyPaise / 100]))
  const cats = CATEGORIES.filter((c) => !c.income && !c.excluded && c.name !== 'Other')
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await db.transaction('rw', db.budgets, async () => {
        await db.budgets.clear()
        await db.budgets.bulkPut(Object.entries(v).filter(([, r]) => r > 0).map(([category, r]) => ({ category, monthlyPaise: Math.round(r * 100) })))
      })
      onDone()
    }}>
      <p className="mb-3 text-[13.5px] text-muted">Leave a category blank for no budget. Today's allowance on the Today screen is the total divided by the days in the month.</p>
      {cats.map((c) => (
        <Field key={c.name} label={`${c.icon} ${c.name} (₹ a month)`}>
          <input type="number" inputMode="numeric" step="100" value={v[c.name] || ''} onChange={(e) => setVals({ ...v, [c.name]: +e.target.value })} />
        </Field>
      ))}
      <PrimaryButton>Save budgets</PrimaryButton>
    </form>
  )
}

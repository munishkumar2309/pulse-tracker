// You (Settings): profile, budgets, app lock, phone sync, food photos, appearance, backup/restore, delete data.
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronRight, Fingerprint, Palette, RefreshCw, Save, Target, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconDot, Page } from '../components/motion'
import { Field, PrimaryButton, Sheet } from '../components/Sheet'
import { Switch } from '../components/ui/switch'
import { CATEGORIES } from '../data/categories'
import { useLatestWeight, useProfile } from '../db/hooks'
import { db } from '../db/schema'
import { dayKey, formatINR } from '../lib/format'
import { getThemeMode, setThemeMode, type ThemeMode } from '../lib/theme'
import { CLOUD_MODEL, getVisionSettings, setVisionSettings } from '../health/foodRecognizers'
import { success, tap } from '../native/haptics'
import { getLockSettings, lockAvailability, lockSupported, setLockSettings, unlock, type LockSettings } from '../native/lock'
import { smsSupported, syncSmsInbox } from '../native/sms'
import { syncHealthThenPhone } from '../native/sync'
import { ProfileForm } from './ProfileForm'

const TABLES = ['profile', 'weights', 'water', 'steps', 'sleep', 'transactions', 'rules', 'budgets', 'foods', 'foodLogs', 'walks', 'meta'] as const

export function Settings() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const [sheet, setSheet] = useState<'profile' | 'budgets' | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode)
  const [msg, setMsg] = useState('')

  async function exportData() {
    const out: Record<string, unknown[]> = {}
    for (const t of TABLES) out[t] = await db.table(t).toArray()
    out.meta = (out.meta as { key: string }[]).filter((m) => !m.key.startsWith('secret:')) // never export API keys
    const blob = new Blob([JSON.stringify({ app: 'pulse', version: 2, exportedAt: new Date().toISOString(), data: out })], { type: 'application/json' })
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
    <Page>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-[22px] font-semibold text-primary-foreground">{(profile?.name?.trim()[0] ?? 'P').toUpperCase()}</span>
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{profile?.name || 'You'}</h1>
          <p className="text-[13px] text-muted-foreground">{profile ? `${profile.heightCm} cm · goal ${profile.goalWeightKg} kg` : ''}</p>
        </div>
      </div>

      <div className="card divide-y divide-border">
        <Row icon={<Target size={16} />} color="var(--weight)" title="Profile and goals" detail={profile ? `${profile.heightCm} cm, goal ${profile.goalWeightKg} kg, ${profile.stepGoal.toLocaleString('en-IN')} steps` : ''} onClick={() => setSheet('profile')} />
        <Row icon={<Wallet size={16} />} color="var(--primary)" title="Monthly budgets" detail={totalBudget ? `${formatINR(totalBudget)} a month across ${budgets!.length} categories` : 'Not set'} onClick={() => setSheet('budgets')} />
      </div>

      <AppLock />
      <PhoneSync />
      <FoodPhotos />

      <section className="card mt-3 p-4">
        <div className="flex items-center gap-2"><IconDot color="var(--sleep)"><Palette size={16} /></IconDot><h2 className="text-[15px] font-semibold">Appearance</h2></div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']] as [ThemeMode, string][]).map(([v, l]) => (
            <button key={v} type="button" onClick={() => { tap(); setTheme(v); setThemeMode(v) }} aria-pressed={theme === v}
              className={`rounded-[12px] py-2.5 text-[14px] ${theme === v ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted'}`}>{l}</button>
          ))}
        </div>
      </section>

      <section className="card mt-3 p-4">
        <div className="flex items-center gap-2"><IconDot color="var(--steps)"><Save size={16} /></IconDot><h2 className="text-[15px] font-semibold">Your data</h2></div>
        <p className="mt-2 text-[13.5px] text-muted-foreground">Everything is stored only on this phone. Download a backup now and then, and before changing phones.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={exportData} className="rounded-[12px] bg-muted py-2.5 text-[14px] font-medium">Download backup</button>
          <label className="cursor-pointer rounded-[12px] bg-muted py-2.5 text-center text-[14px] font-medium">
            Restore backup
            <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="mt-2 text-[13.5px]" role="status">{msg}</p>}
        <button type="button" onClick={wipe} className="mt-4 text-[14px] font-medium text-destructive">Delete all data on this phone</button>
      </section>

      <p className="mt-6 mb-2 text-[12px] leading-relaxed text-muted-foreground">
        Health numbers here are estimates to guide you, not medical advice. Food data: IFCT 2017 (National Institute of Nutrition, ICMR) and Open Food Facts (ODbL). Maps © OpenStreetMap contributors.
      </p>

      <Sheet open={sheet === 'profile'} onClose={() => setSheet(null)} title="Profile and goals">
        {profile && <ProfileForm initial={profile} initialWeight={weight?.kg} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === 'budgets'} onClose={() => setSheet(null)} title="Monthly budgets"><BudgetForm onDone={() => setSheet(null)} /></Sheet>
    </Page>
  )
}

function AppLock() {
  const [s, setS] = useState<LockSettings | null>(null)
  const [avail, setAvail] = useState<{ ok: boolean; label: string; reason?: string } | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => { getLockSettings().then(setS); lockAvailability().then(setAvail).catch((e) => setAvail({ ok: false, label: '', reason: (e as Error).message })) }, [])
  if (!s) return null

  async function toggle(on: boolean) {
    setNote('')
    if (on) {
      // Prove the prompt works before turning the lock on, so nobody is locked out.
      try {
        if (!(await unlock('Confirm to turn on app lock'))) return
      } catch (e) { setNote((e as Error).message); return }
      success()
    }
    const next = { ...s!, enabled: on }
    await setLockSettings(next)
    setS(next)
  }

  return (
    <section className="card mt-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><IconDot color="var(--primary)"><Fingerprint size={16} /></IconDot>
          <div>
            <h2 className="text-[15px] font-semibold">App lock</h2>
            <p className="text-[12.5px] text-muted-foreground">{lockSupported() ? (avail?.ok ? avail.label : avail?.reason ?? 'Checking…') : 'Available in the Android app.'}</p>
          </div>
        </div>
        <Switch checked={s.enabled} disabled={!lockSupported() || !avail?.ok} onCheckedChange={toggle} aria-label="App lock" />
      </div>
      {s.enabled && (
        <Field label="Lock again after leaving the app for">
          <select className="mt-1" value={s.relockAfterSec} onChange={async (e) => { const next = { ...s, relockAfterSec: +e.target.value }; await setLockSettings(next); setS(next) }}>
            <option value={0}>Immediately</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
          </select>
        </Field>
      )}
      {note && <p className="mt-2 text-[13.5px] text-destructive" role="alert">{note}</p>}
    </section>
  )
}

function PhoneSync() {
  const meta = useLiveQuery(async () => ({
    sms: (await db.meta.get('smsLastResult'))?.value as { at: number; added: number; read: number } | undefined,
    health: (await db.meta.get('healthLastSync'))?.value as number | undefined,
    phone: (await db.meta.get('phoneLastSync'))?.value as { at: number; steps: boolean; sleep: boolean; message?: string } | undefined,
  }), [])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const when = (t?: number) => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'never')

  return (
    <section className="card mt-3 p-4">
      <div className="flex items-center gap-2"><IconDot color="var(--water)"><RefreshCw size={16} /></IconDot><h2 className="text-[15px] font-semibold">Phone sync</h2></div>
      {!smsSupported() ? (
        <p className="mt-2 text-[13.5px] text-muted-foreground">In the Android app, bank SMS, the phone's own step and sleep tracking, and Health Connect (steps, sleep, weight) sync automatically. In a browser, paste SMS on the Money screen and log health by hand.</p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] text-muted-foreground">Bank SMS: last read {when(meta?.sms?.at)}{meta?.sms ? `, ${meta.sms.added} new` : ''}. Health Connect: last synced {when(meta?.health)}.</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Phone tracking: steps {meta?.phone?.steps ? 'on' : 'off'}, sleep {meta?.phone?.sleep ? 'on' : 'off'}. The phone counts steps and detects sleep from its motion and light sensors, even when Pulse is closed. Sleep found this way is an estimate; keep the phone near your bed.</p>
          <button type="button" disabled={busy} onClick={async () => {
            tap(); setBusy(true); setNote('')
            try {
              const [, { health, phone }] = await Promise.all([syncSmsInbox(), syncHealthThenPhone(true)])
              const problems = [health && !health.ok ? health.message : '', phone?.message ?? ''].filter(Boolean)
              setNote(problems.length ? problems.join(' ') : 'Up to date.')
              if (!problems.length) success()
            } catch (e) { setNote((e as Error).message) } finally { setBusy(false) }
          }} className="mt-3 w-full rounded-[12px] bg-primary py-3 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? 'Syncing…' : 'Allow access and sync now'}
          </button>
          {note && <p className="mt-2 text-[13.5px]" role="status">{note}</p>}
        </>
      )}
    </section>
  )
}

function Row({ icon, color, title, detail, onClick }: { icon: React.ReactNode; color: string; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { tap(); onClick() }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
      <IconDot color={color}>{icon}</IconDot>
      <span className="flex-1 min-w-0"><span className="block text-[15px] font-medium">{title}</span><span className="block truncate text-[12.5px] text-muted-foreground">{detail}</span></span>
      <ChevronRight size={18} className="text-muted-foreground" aria-hidden />
    </button>
  )
}

function BudgetForm({ onDone }: { onDone: () => void }) {
  const existing = useLiveQuery(() => db.budgets.toArray(), [])
  const [vals, setVals] = useState<Record<string, number> | null>(null)
  if (!existing) return null
  const v = vals ?? Object.fromEntries(existing.map((b) => [b.category, b.monthlyPaise / 100]))
  const cats = CATEGORIES.filter((c) => !c.income && !c.excluded && c.name !== 'Other' && c.name !== 'Investments') // investments aren't spending
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await db.transaction('rw', db.budgets, async () => {
        await db.budgets.clear()
        await db.budgets.bulkPut(Object.entries(v).filter(([, r]) => r > 0).map(([category, r]) => ({ category, monthlyPaise: Math.round(r * 100) })))
      })
      onDone()
    }}>
      <p className="mb-3 text-[13.5px] text-muted-foreground">Leave a category blank for no budget. Today's allowance on the Today screen is the total divided by the days in the month.</p>
      {cats.map((c) => (
        <Field key={c.name} label={`${c.icon} ${c.name} (₹ a month)`}>
          <input type="number" inputMode="numeric" step="100" value={v[c.name] || ''} onChange={(e) => setVals({ ...v, [c.name]: +e.target.value })} />
        </Field>
      ))}
      <PrimaryButton>Save budgets</PrimaryButton>
    </form>
  )
}

function FoodPhotos() {
  const saved = useLiveQuery(getVisionSettings, [])
  const [key, setKey] = useState<string | null>(null)
  if (!saved) return null
  const apiKey = key ?? saved.apiKey
  const save = (cloud: boolean, k = apiKey) => setVisionSettings({ cloud, apiKey: k })
  return (
    <section className="card mt-3 p-4">
      <div className="flex items-center gap-2"><IconDot color="var(--food)"><Camera size={16} /></IconDot><h2 className="text-[15px] font-semibold">Food photos</h2></div>
      <p className="mt-2 text-[13.5px] text-muted-foreground">Photos are recognised on this phone by default (80 Indian dishes; the model downloads once, about 90 MB). The photo isn't uploaded.</p>
      <label className="mt-3 flex items-center justify-between gap-3 text-[15px]">
        <span>Cloud recognition<span className="block text-[12.5px] text-muted-foreground">Better with thalis and mixed plates, and guesses portions. Sends the photo to Anthropic (Claude) with your own API key. Billed to your Anthropic account per photo.</span></span>
        <Switch checked={saved.cloud} onCheckedChange={(on) => { tap(); save(on) }} aria-label="Cloud recognition" />
      </label>
      {saved.cloud && (
        <form className="mt-3" onSubmit={(e) => { e.preventDefault(); save(true, apiKey); success(); setKey(null) }}>
          <Field label="Anthropic API key" hint={`Stored only on this phone and left out of backups. Model: ${CLOUD_MODEL}. Get a key at console.anthropic.com.`}>
            <input type="password" autoComplete="off" value={apiKey} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
          </Field>
          <PrimaryButton disabled={key === null || key === saved.apiKey}>{saved.apiKey ? 'Update key' : 'Save key'}</PrimaryButton>
        </form>
      )}
    </section>
  )
}

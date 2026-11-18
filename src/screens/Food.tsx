// Food: kcal left → macros → meals. Add: search (dishes + IFCT + saved), recent, barcode, online search, manual.
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo, useState } from 'react'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { Field, PrimaryButton, Sheet } from '../components/Sheet'
import { targetsFor, useLatestWeight, useProfile } from '../db/hooks'
import { db, type FoodLog, type Meal } from '../db/schema'
import { LOCAL_FOODS, nutritionFor, searchFoods, servingsFor, type FoodItem } from '../health/foodSearch'
import { offBarcode, offSearch } from '../health/openFoodFacts'
import { dayKey } from '../lib/format'

const MEALS: [Meal, string][] = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['snacks', 'Snacks'], ['dinner', 'Dinner']]
const mealName = (m: Meal) => MEALS.find(([k]) => k === m)![1]

/** Suggest the meal from the time of day. */
const mealNow = (): Meal => {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 19 ? 'snacks' : 'dinner'
}

export function Food() {
  const profile = useProfile()
  const weight = useLatestWeight()
  const logs = useLiveQuery(() => db.foodLogs.where('date').equals(dayKey()).toArray(), [])
  const [adding, setAdding] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<FoodLog | null>(null)
  if (!profile || !logs) return null
  const tg = targetsFor(profile, weight?.kg ?? profile.goalWeightKg)
  const total = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => Math.round(logs.reduce((a, l) => a + l[k], 0))
  const left = tg.calories.kcal - total('kcal')

  return (
    <div className="px-4 pt-5">
      <h1 className="text-[22px] font-semibold">Food</h1>
      <section className="mt-4">
        <p className="text-[13px] text-muted">{left >= 0 ? 'Left to eat today' : 'Over today’s target'}</p>
        <p className="num text-[46px] font-bold leading-none" style={{ color: left >= 0 ? 'var(--ring-food)' : 'var(--bad)' }}>
          {Math.abs(left).toLocaleString('en-IN')}<span className="text-[16px] font-normal text-muted"> kcal</span>
        </p>
        <p className="mt-2 text-[14px] text-muted">{total('kcal').toLocaleString('en-IN')} eaten of {tg.calories.kcal.toLocaleString('en-IN')}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Macro label="Protein" value={total('protein')} target={tg.protein} />
          <Macro label="Carbs" value={total('carbs')} />
          <Macro label="Fat" value={total('fat')} />
        </div>
      </section>

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {MEALS.map(([m, label]) => {
          const items = logs.filter((l) => l.meal === m)
          return (
            <li key={m} className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-[15.5px] font-medium">{label}<span className="text-muted text-[13px] font-normal"> {Math.round(items.reduce((a, l) => a + l.kcal, 0))} kcal</span></span>
                <button type="button" onClick={() => setAdding(m)} className="text-[14px] font-medium py-1 px-1" style={{ color: 'var(--ring-food)' }}>Add food</button>
              </div>
              {items.map((i) => (
                <button key={i.id} type="button" onClick={() => setEditing(i)} className="flex w-full justify-between py-1 text-left text-[14px]">
                  <span className="text-muted truncate pr-3">{i.name}{i.grams ? `, ${Math.round(i.grams)} g` : ''}</span>
                  <span className="num-tight shrink-0">{Math.round(i.kcal)}</span>
                </button>
              ))}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => setAdding(mealNow())} className="mt-5 w-full rounded-[12px] py-3 text-[16px] font-semibold text-[#0E1822]" style={{ background: 'var(--ring-food)' }}>
        Add food to {mealName(mealNow()).toLowerCase()}
      </button>
      <p className="mt-6 mb-2 text-[12px] text-muted leading-relaxed">
        Ingredients: IFCT 2017, National Institute of Nutrition (ICMR). Dishes marked "Estimate" use typical recipes, and home cooking varies. Packaged foods: Open Food Facts.
      </p>

      <Sheet open={!!adding} onClose={() => setAdding(null)} title={adding ? `Add to ${mealName(adding).toLowerCase()}` : ''}>
        {adding && <AddFood meal={adding} onDone={() => setAdding(null)} />}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Logged food">
        {editing && (
          <div className="text-[15px]">
            <p><b>{editing.name}</b></p>
            <p className="mt-1 text-muted">{Math.round(editing.kcal)} kcal, protein {editing.protein} g, carbs {editing.carbs} g, fat {editing.fat} g{editing.grams ? `, ${Math.round(editing.grams)} g` : ''}</p>
            <button type="button" onClick={async () => { await db.foodLogs.delete(editing.id!); setEditing(null) }} className="mt-5 w-full rounded-[12px] border border-line py-3 text-[16px] font-semibold text-bad">Remove from {mealName(editing.meal).toLowerCase()}</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Macro({ label, value, target }: { label: string; value: number; target?: number }) {
  return (
    <div>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="num-tight text-[19px] font-semibold">{value}<span className="text-[12px] font-normal text-muted"> {target ? `/ ${target} g` : 'g'}</span></p>
      {target && <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / target) * 100)}%`, background: 'var(--ring-food)' }} /></div>}
    </div>
  )
}

type Stage = { kind: 'search' } | { kind: 'portion'; food: FoodItem } | { kind: 'scan' } | { kind: 'manual' }

function AddFood({ meal, onDone }: { meal: Meal; onDone: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'search' })
  const [q, setQ] = useState('')
  const [online, setOnline] = useState<FoodItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const saved = useLiveQuery(() => db.foods.toArray(), [])
  const recent = useLiveQuery(async () => {
    const since = new Date()
    since.setDate(since.getDate() - 30)
    const logs = await db.foodLogs.where('date').aboveOrEqual(dayKey(since)).reverse().sortBy('id')
    return [...new Set(logs.map((l) => l.foodId).filter((id) => id !== 'quick'))].slice(0, 12)
  }, [])

  const results = useMemo(() => searchFoods(q, saved ?? []), [q, saved])
  const recentFoods = useMemo(() => {
    const all = [...(saved ?? []), ...LOCAL_FOODS]
    return (recent ?? []).map((id) => all.find((f) => f.id === id)).filter((f): f is FoodItem => !!f)
  }, [recent, saved])

  const pick = (food: FoodItem) => setStage({ kind: 'portion', food })

  const onCode = useCallback(async (code: string) => {
    setBusy(true)
    setMsg('')
    try {
      const local = await db.foods.where('barcode').equals(code).first()
      const food = local ?? (await offBarcode(code))
      if (food) setStage({ kind: 'portion', food })
      else { setMsg(`No product found for ${code}. Search by name or enter calories manually.`); setStage({ kind: 'search' }) }
    } catch (e) {
      setMsg((e as Error).message)
      setStage({ kind: 'search' })
    } finally {
      setBusy(false)
    }
  }, [])

  if (stage.kind === 'portion') return <Portion food={stage.food} meal={meal} onBack={() => setStage({ kind: 'search' })} onDone={onDone} />
  if (stage.kind === 'scan') return (<><BarcodeScanner onCode={onCode} />{busy && <p className="mt-3 text-[14px] text-muted" role="status">Looking up the product…</p>}</>)
  if (stage.kind === 'manual') return <QuickAdd meal={meal} onDone={onDone} />

  const list = q.trim() ? [...(online ?? []), ...results] : recentFoods
  return (
    <div>
      <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOnline(null) }} placeholder="Search dal, roti, paneer, banana…" autoFocus aria-label="Search foods" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setStage({ kind: 'scan' })} className="rounded-[10px] bg-surface-2 py-2.5 text-[14px]">Scan a barcode</button>
        <button type="button" onClick={() => setStage({ kind: 'manual' })} className="rounded-[10px] bg-surface-2 py-2.5 text-[14px]">Enter calories</button>
      </div>
      {msg && <p className="mt-3 text-[14px] text-bad" role="alert">{msg}</p>}
      {!q.trim() && recentFoods.length > 0 && <h3 className="mt-5 text-[13px] text-muted">Recent</h3>}
      {!q.trim() && recentFoods.length === 0 && <p className="mt-5 text-[14px] text-muted">Type to search over 600 Indian dishes and ingredients.</p>}
      <ul className="mt-2">
        {list.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => pick(f)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left border-b border-line">
              <span className="min-w-0">
                <span className="block truncate text-[15px]">{f.name}</span>
                <span className="block text-[12.5px] text-muted">
                  {f.brand ? `${f.brand}, ` : ''}{f.unit && f.unitGrams ? `${Math.round((f.kcal * f.unitGrams) / 100)} kcal per ${f.unit}` : `${f.kcal} kcal per 100 g`}
                  {f.estimate ? ', estimate' : f.source === 'ifct' ? ', IFCT' : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {q.trim().length >= 3 && online === null && (
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setMsg('')
          try { setOnline(await offSearch(q.trim())) } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
        }} className="mt-3 w-full rounded-[10px] border border-line py-2.5 text-[14px]">
          {busy ? 'Searching…' : `Search packaged foods online for "${q.trim()}"`}
        </button>
      )}
      {online !== null && online.length === 0 && <p className="mt-3 text-[14px] text-muted">No packaged foods found online.</p>}
    </div>
  )
}

function Portion({ food, meal, onBack, onDone }: { food: FoodItem; meal: Meal; onBack: () => void; onDone: () => void }) {
  const options = servingsFor(food)
  const [opt, setOpt] = useState(0)
  const [qty, setQty] = useState(options[0].grams === 1 ? 100 : 1)
  const grams = options[opt].grams * qty
  const n = nutritionFor(food, grams)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      if (food.source === 'off' || food.source === 'custom') await db.foods.put(food) // remember for recent/offline
      await db.foodLogs.add({ date: dayKey(), meal, foodId: food.id, name: food.name, grams, kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat })
      onDone()
    }}>
      <button type="button" onClick={onBack} className="mb-2 text-[14px] text-muted">Back to search</button>
      <p className="text-[17px] font-semibold">{food.name}</p>
      <p className="text-[13px] text-muted">{food.brand ? `${food.brand}. ` : ''}{food.estimate ? 'Estimate for a typical recipe.' : food.source === 'ifct' ? 'IFCT 2017 value, per raw/edible portion.' : food.source === 'off' ? 'From Open Food Facts, entered by volunteers. Check it against the packet.' : ''}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="How much">
          <input type="number" inputMode="decimal" step={options[opt].grams === 1 ? 10 : 0.5} min={0} value={qty || ''} onChange={(e) => setQty(+e.target.value)} autoFocus />
        </Field>
        <Field label="Unit">
          <select value={opt} onChange={(e) => { const i = +e.target.value; setOpt(i); setQty(options[i].grams === 1 ? 100 : 1) }}>
            {options.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mb-4 flex items-baseline justify-between rounded-[12px] bg-surface-2 px-4 py-3">
        <span className="num text-[28px] font-bold" style={{ color: 'var(--ring-food)' }}>{n.kcal}<span className="text-[13px] font-normal text-muted"> kcal</span></span>
        <span className="text-[13px] text-muted text-right">P {n.protein} g, C {n.carbs} g, F {n.fat} g<br />{Math.round(grams)} g</span>
      </div>
      <PrimaryButton disabled={!(grams > 0)} className="!bg-[var(--ring-food)]">Add to {mealName(meal).toLowerCase()}</PrimaryButton>
    </form>
  )
}

function QuickAdd({ meal, onDone }: { meal: Meal; onDone: () => void }) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState(0)
  const [protein, setProtein] = useState(0)
  return (
    <form onSubmit={async (e) => {
      e.preventDefault()
      await db.foodLogs.add({ date: dayKey(), meal, foodId: 'quick', name: name.trim() || 'Quick add', grams: 0, kcal, protein, carbs: 0, fat: 0 })
      onDone()
    }}>
      <Field label="What did you eat?"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office canteen thali" autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories (kcal)"><input type="number" inputMode="numeric" value={kcal || ''} onChange={(e) => setKcal(+e.target.value)} /></Field>
        <Field label="Protein (g, optional)"><input type="number" inputMode="numeric" value={protein || ''} onChange={(e) => setProtein(+e.target.value)} /></Field>
      </div>
      <PrimaryButton disabled={!(kcal > 0)} className="!bg-[var(--ring-food)]">Add to {mealName(meal).toLowerCase()}</PrimaryButton>
    </form>
  )
}

// Food photo → dish guesses → pick a Pulse food (then the normal portion picker).
// On-phone recognition first; cloud recognition (opt-in) for mixed plates or when the phone isn't sure.
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ImageUp, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db/schema'
import { classifyOnPhone, getVisionSettings, prepareImage, recognizeInCloud } from '../health/foodRecognizers'
import { CONFIDENT, fromCloud, fromGuesses, needsHelp, type Recognised } from '../health/foodVision'
import type { FoodItem } from '../health/foodSearch'

type State =
  | { kind: 'pick' }
  | { kind: 'working'; what: 'phone' | 'cloud'; pct: number | null }
  | { kind: 'done'; by: 'phone' | 'cloud'; items: Recognised[] }
  | { kind: 'error'; message: string }

export function FoodPhoto({ onPick, onSearch, onAiEstimate }: {
  onPick: (food: FoodItem, grams?: number) => void
  onSearch: (name: string) => void
  onAiEstimate: (name: string, kcal: number) => void
}) {
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [state, setState] = useState<State>({ kind: 'pick' })
  const settings = useLiveQuery(getVisionSettings, [])
  const saved = useLiveQuery(() => db.foods.toArray(), [])
  const run = useRef(0) // late progress events from a finished run must not overwrite its result
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const cloudReady = !!settings?.cloud && !!settings.apiKey

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function onFile(f: File | undefined) {
    if (!f) return
    try {
      const small = await prepareImage(f)
      setPhoto(small)
      setPreview(URL.createObjectURL(small))
      await runPhone(small)
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message || "Couldn't open that photo." })
    }
  }

  async function runPhone(p: Blob) {
    const id = ++run.current
    setState({ kind: 'working', what: 'phone', pct: null })
    try {
      const guesses = await classifyOnPhone(p, (pct) => { if (run.current === id) setState({ kind: 'working', what: 'phone', pct }) })
      run.current++
      setState({ kind: 'done', by: 'phone', items: fromGuesses(guesses) })
    } catch {
      run.current++
      setState({ kind: 'error', message: cloudReady ? "The on-phone model couldn't load. Try cloud recognition instead." : "The on-phone model couldn't load. It downloads once (about 90 MB) and needs internet that first time." })
    }
  }

  async function runCloud() {
    if (!photo || !settings) return
    run.current++
    setState({ kind: 'working', what: 'cloud', pct: null })
    try {
      setState({ kind: 'done', by: 'cloud', items: fromCloud(await recognizeInCloud(photo, settings.apiKey), saved ?? []) })
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message })
    }
  }

  const inputs = (
    <>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )

  if (state.kind === 'pick') {
    return (
      <div>
        {inputs}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => camera.current?.click()} className="flex flex-col items-center gap-1.5 rounded-[14px] bg-[var(--food)] py-5 text-[14px] font-semibold text-white"><Camera size={24} />Take a photo</button>
          <button type="button" onClick={() => gallery.current?.click()} className="flex flex-col items-center gap-1.5 rounded-[14px] bg-muted py-5 text-[14px] font-semibold"><ImageUp size={24} />From gallery</button>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
          Recognised on this phone; the photo isn't uploaded. Works best with one dish in view, from above.
          {cloudReady ? ' For a full thali, use cloud recognition after the first result.' : ' For full thalis, turn on cloud recognition in You → Food photos.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      {inputs}
      {preview && <img src={preview} alt="Your food photo" className="mb-3 max-h-[220px] w-full rounded-[14px] object-cover" />}

      {state.kind === 'working' && (
        <p className="text-[14.5px]" role="status">
          {state.what === 'cloud' ? 'Asking the cloud model…' : state.pct !== null ? `Getting the food model ready (one-time download): ${state.pct}%` : 'Recognising…'}
        </p>
      )}

      {state.kind === 'error' && <p className="text-[14.5px] text-bad" role="alert">{state.message}</p>}

      {state.kind === 'done' && (
        <>
          {state.items.length === 0 && <p className="text-[14.5px]">{state.by === 'cloud' ? 'No food found in this photo.' : "Couldn't tell what this is."}</p>}
          <ul className="space-y-3">
            {state.items.map((r, i) => (
              <li key={r.name + i} className="rounded-[14px] border border-border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15.5px] font-semibold">{r.name}</span>
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">{sure(r.confidence, state.by)}</span>
                </div>
                {r.grams && <p className="text-[12.5px] text-muted-foreground">About {r.grams} g in the photo{r.aiKcal ? `, roughly ${r.aiKcal} kcal (AI estimate)` : ''}</p>}
                {r.approx && r.foods.length > 0 && <p className="text-[12.5px] text-muted-foreground">Pulse has no data for this dish yet; closest match:</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.foods.map((f) => (
                    <button key={f.id} type="button" onClick={() => onPick(f, r.grams)} className="rounded-full bg-muted px-3 py-1.5 text-[13.5px]">
                      {f.name}{f.unit && f.unitGrams ? ` · ${Math.round((f.kcal * f.unitGrams) / 100)} kcal/${f.unit}` : ''}
                    </button>
                  ))}
                  <button type="button" onClick={() => onSearch(r.name)} className="rounded-full border border-border px-3 py-1.5 text-[13.5px]">Search…</button>
                  {r.foods.length === 0 && r.aiKcal && <button type="button" onClick={() => onAiEstimate(r.name, r.aiKcal!)} className="rounded-full border border-border px-3 py-1.5 text-[13.5px]">Log AI estimate ({r.aiKcal} kcal)</button>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted-foreground">Calories are estimates for a typical recipe; oil, ghee and portion change them. Check the portion on the next screen.</p>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {state.kind !== 'working' && <button type="button" onClick={() => setState({ kind: 'pick' })} className="flex items-center gap-1.5 rounded-[10px] bg-muted px-3 py-2.5 text-[14px]"><RotateCcw size={16} />Another photo</button>}
        {cloudReady && photo && state.kind !== 'working' && !(state.kind === 'done' && state.by === 'cloud') && (
          <button type="button" onClick={runCloud} className="flex-1 rounded-[10px] bg-[var(--food)] px-3 py-2.5 text-[14px] font-semibold text-white">
            {state.kind === 'done' && !needsHelp(state.items) ? 'Several items? Try cloud' : 'Try cloud recognition'}
          </button>
        )}
      </div>
      {cloudReady && state.kind === 'done' && state.by === 'phone' && <p className="mt-2 text-[12px] text-muted-foreground">Cloud recognition sends this photo to Anthropic.</p>}
    </div>
  )
}

function sure(c: number, by: 'phone' | 'cloud') {
  if (by === 'cloud') return c >= 0.9 ? 'sure' : c >= 0.6 ? 'fairly sure' : 'not sure'
  return c >= 0.8 ? `sure (${Math.round(c * 100)}%)` : c >= CONFIDENT ? `fairly sure (${Math.round(c * 100)}%)` : `not sure (${Math.round(c * 100)}%)`
}

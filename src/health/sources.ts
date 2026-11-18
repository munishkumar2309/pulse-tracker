// Which source wins when steps or sleep for the same day arrive from more than one place.
// Sources: manual (typed in Pulse), health_connect (Samsung Health, a watch…), phone (Pulse's own sensor tracking).
import type { SleepEntry, StepsDay } from '../db/schema'

/**
 * The steps row to save for a day, or null to keep what's there.
 * Manual always wins. Otherwise keep the higher count: the phone and a watch count the same walking,
 * so adding them would double count, and each misses steps the other caught (phone left on a desk, watch charging).
 */
export function pickSteps(existing: StepsDay | undefined, incoming: StepsDay): StepsDay | null {
  if (existing?.source === 'manual') return null
  if (existing && existing.count >= incoming.count) return null
  return incoming
}

type Span = Pick<SleepEntry, 'start' | 'end'>
const ms = (iso: string) => new Date(iso).getTime()

/** True when two sleep spans share any time. Compared as instants, so UTC and local ISO strings mix safely. */
export const overlaps = (a: Span, b: Span) => ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end)

/** Phone-detected sleep shorter than this is ignored (dozing on the sofa, phone left still on a table). */
export const MIN_PHONE_SLEEP_MIN = 60

/**
 * Phone-detected sleep is the fallback: a manual entry for that morning, or any entry overlapping it
 * (Health Connect has stages, so it's better), wins.
 */
export function acceptPhoneSleep(entry: SleepEntry, nearby: SleepEntry[]): boolean {
  if (entry.minutes < MIN_PHONE_SLEEP_MIN) return false
  if (nearby.some((s) => s.date === entry.date && s.source === 'manual')) return false
  return !nearby.some((s) => overlaps(s, entry))
}

/** Phone rows to delete when a Health Connect session covering the same time arrives. */
export const phoneRowsReplacedBy = (incoming: Span, nearby: SleepEntry[]) =>
  nearby.filter((s) => s.source === 'phone' && overlaps(s, incoming))

// The one bold element on Today: a 240° arc with the readiness number set wide.
import type { Readiness } from '../health/recovery'

// Pulse's own bands (70 / 40). Each band has a name, not just a colour.
export const BAND = {
  ready: { color: 'var(--ok)', name: 'Ready', text: 'Ready for a hard day' },
  steady: { color: 'var(--body)', name: 'Steady', text: 'Steady, keep it moderate' },
  easy: { color: 'var(--bad)', name: 'Go easy', text: 'Go easy and rest today' },
}

export function ReadinessArc({ r, onExplain }: { r: Readiness | null; onExplain: () => void }) {
  const size = 248
  const stroke = 14
  const radius = (size - stroke) / 2
  const sweep = 240
  const arcLen = (2 * Math.PI * radius * sweep) / 360
  const filled = r ? (r.score / 100) * arcLen : 0
  const band = r ? BAND[r.band] : null
  // Start the arc at 150° (bottom-left) and sweep clockwise to 30° (bottom-right).
  const polar = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180
    return [size / 2 + radius * Math.cos(a), size / 2 + radius * Math.sin(a)]
  }
  const [x0, y0] = polar(-120)
  const [x1, y1] = polar(120)
  const d = `M ${x0} ${y0} A ${radius} ${radius} 0 1 1 ${x1} ${y1}`

  return (
    <section className="relative mx-auto" style={{ width: size, height: size * 0.86 }} aria-label="Readiness">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <path d={d} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} strokeLinecap="round" />
        {r && (
          <path d={d} fill="none" stroke={band!.color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${filled} ${arcLen}`} style={{ transition: 'stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        {r ? (
          <>
            <span className="text-[13px] text-muted-foreground">Readiness</span>
            <span className="num text-[76px] font-bold leading-none" style={{ color: band!.color }}>{r.score}</span>
            <span className="mt-2 text-[15px] font-medium">{band!.text}</span>
          </>
        ) : (
          <>
            <span className="num text-[56px] font-bold leading-none text-muted-foreground">--</span>
            <span className="mt-2 text-[14px] text-muted-foreground text-center max-w-[180px]">Log last night's sleep to see today's readiness</span>
          </>
        )}
        <button type="button" onClick={onExplain} className="mt-2 text-[12px] text-muted-foreground underline underline-offset-4">How this is worked out</button>
      </div>
    </section>
  )
}

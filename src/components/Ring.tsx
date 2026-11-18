// Progress ring (Today row). Goes past 100% as a second lap so beating a goal is visible.
interface Props {
  value: number
  goal: number
  color: string // CSS var, e.g. 'var(--ring-steps)'
  size?: number
  stroke?: number
  label: string
  display: string
  unit?: string
  onClick?: () => void
}

export function Ring({ value, goal, color, size = 72, stroke = 7, label, display, unit, onClick }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = goal > 0 ? value / goal : 0
  const first = Math.min(pct, 1)
  const lap = Math.max(0, Math.min(pct - 1, 1))
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 min-w-0" aria-label={`${label}: ${display}${unit ?? ''} of goal`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${first * c} ${c}`} style={{ transition: 'stroke-dasharray .6s ease' }} />
        {lap > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${lap * c} ${c}`} style={{ filter: 'brightness(1.35)' }} />
        )}
      </svg>
      <span className="num-tight text-[15px] font-semibold leading-none">
        {display}<span className="text-muted text-[11px] font-normal">{unit}</span>
      </span>
      <span className="text-muted text-[12px] leading-none">{label}</span>
    </button>
  )
}

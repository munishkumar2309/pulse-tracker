// Progress ring with an animated fill. Past 100% it draws a brighter second lap so beating a goal is visible.
import { motion } from 'motion/react'
import type { ReactNode } from 'react'

interface Props {
  value: number
  goal: number
  color: string // CSS colour, e.g. 'var(--steps)'
  size?: number
  stroke?: number
  children?: ReactNode // centre content
  label?: string // accessible label
}

export function Ring({ value, goal, color, size = 72, stroke = 7, children, label }: Props) {
  const r = (size - stroke) / 2
  const pct = goal > 0 ? value / goal : 0
  const first = Math.min(pct, 1)
  const lap = Math.max(0, Math.min(pct - 1, 1))
  const circle = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: stroke, strokeLinecap: 'round' as const }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle {...circle} stroke="var(--muted)" />
        <motion.circle {...circle} stroke={color} initial={{ pathLength: 0 }} animate={{ pathLength: first || 0.0001 }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }} style={{ opacity: first ? 1 : 0 }} />
        {lap > 0 && (
          <motion.circle {...circle} stroke={color} initial={{ pathLength: 0 }} animate={{ pathLength: lap }}
            transition={{ duration: 0.9, delay: 1, ease: 'easeOut' }} style={{ filter: 'brightness(1.3) saturate(1.2)' }} />
        )}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

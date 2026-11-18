// Shared animated pieces: count-up numbers, pressable cards, page transitions.
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { tap } from '../native/haptics'

/** Counts from the previous value to `value` (from 0 on first show). Tabular figures keep width steady. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), className, duration = 0.9 }: {
  value: number
  format?: (n: number) => string
  className?: string
  duration?: number
}) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, format)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView) return
    const c = animate(mv, value, { duration, ease: [0.2, 0.8, 0.2, 1] })
    return () => c.stop()
  }, [value, inView, mv, duration])
  return <motion.span ref={ref} className={`num ${className ?? ''}`}>{text}</motion.span>
}

/** A white rounded card that gives a small squeeze + vibration when tapped (if it has onClick). */
export function Tile({ children, onClick, className = '', label }: { children: ReactNode; onClick?: () => void; className?: string; label?: string }) {
  if (!onClick) return <div className={`card p-4 ${className}`}>{children}</div>
  return (
    <motion.button type="button" aria-label={label} onClick={() => { tap(); onClick() }} whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={`card p-4 text-left w-full ${className}`}>
      {children}
    </motion.button>
  )
}

/** Fade + slight rise for a whole screen when it opens. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
      className="px-4 pt-4 pb-6">
      {children}
    </motion.div>
  )
}

/** Small round icon badge used on tiles. */
export function IconDot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      {children}
    </span>
  )
}

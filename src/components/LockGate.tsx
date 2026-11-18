// Covers the app until the user unlocks, on launch and when returning after `relockAfterSec` in the background.
import { App as CapApp } from '@capacitor/app'
import { Fingerprint } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { success } from '../native/haptics'
import { getLockSettings, lockSupported, unlock } from '../native/lock'

export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(lockSupported() ? null : false)
  const [error, setError] = useState('')
  const hiddenAt = useRef<number | null>(null)
  const prompting = useRef(false)

  const tryUnlock = useCallback(async () => {
    if (prompting.current) return
    prompting.current = true
    setError('')
    try {
      if (await unlock()) { success(); setLocked(false) }
    } catch (e) {
      setError((e as Error).message || 'Could not unlock. Try again.')
    } finally {
      prompting.current = false
    }
  }, [])

  // Launch: lock if enabled.
  useEffect(() => {
    if (!lockSupported()) return
    getLockSettings().then((s) => {
      setLocked(s.enabled)
      if (s.enabled) tryUnlock()
    })
  }, [tryUnlock])

  // Background → foreground: relock after the grace period.
  useEffect(() => {
    if (!lockSupported()) return
    const sub = CapApp.addListener('appStateChange', async ({ isActive }) => {
      const s = await getLockSettings()
      if (!s.enabled) return
      if (!isActive) { hiddenAt.current = Date.now(); return }
      if (hiddenAt.current && Date.now() - hiddenAt.current > s.relockAfterSec * 1000) {
        setLocked(true)
        tryUnlock()
      }
      hiddenAt.current = null
    })
    return () => { sub.then((h) => h.remove()) }
  }, [tryUnlock])

  if (locked === null) return <div className="min-h-dvh bg-background" />
  return (
    <>
      {/* Content is not rendered while locked, so nothing shows in the app switcher either. */}
      {!locked && children}
      <AnimatePresence>
        {locked && (
          <motion.div key="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-8 text-center">
            <motion.button type="button" onClick={tryUnlock} whileTap={{ scale: 0.92 }} aria-label="Unlock with fingerprint or screen lock"
              className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-primary">
              <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.2 }}><Fingerprint size={48} strokeWidth={1.6} /></motion.span>
            </motion.button>
            <div>
              <h1 className="text-[22px] font-semibold">Pulse is locked</h1>
              <p className="mt-1 text-[15px] text-muted-foreground">Tap to unlock with your fingerprint, face or screen lock.</p>
              {error && <p className="mt-3 text-[14px] text-destructive" role="alert">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// App shell: lock gate → first-run setup → animated routes + bottom tab bar.
import { Activity as ActivityIcon, Home, IndianRupee, UserRound, Utensils } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { NavLink, Route, Routes, useLocation } from 'react-router'
import { LockGate } from './components/LockGate'
import { useProfile } from './db/hooks'
import { tap } from './native/haptics'
import { Activity } from './screens/Activity'
import { Food } from './screens/Food'
import { Money } from './screens/Money'
import { ProfileForm } from './screens/ProfileForm'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { Trends } from './screens/Trends'

const TABS = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/activity', label: 'Activity', icon: ActivityIcon },
  { to: '/food', label: 'Food', icon: Utensils },
  { to: '/money', label: 'Money', icon: IndianRupee },
  { to: '/settings', label: 'You', icon: UserRound },
]

export function App() {
  return (
    // reducedMotion="user": animations switch off when the phone's "Remove animations" setting is on.
    <MotionConfig reducedMotion="user">
      <LockGate>
        <Shell />
      </LockGate>
    </MotionConfig>
  )
}

function Shell() {
  const profile = useProfile()
  const location = useLocation()
  if (profile === undefined) return null // still loading
  if (profile === null) return <FirstRun />

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] pb-24">
      {/* Keeps content below the Android status bar / notch inside the app. */}
      <main style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Today />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/food" element={<Food />} />
            <Route path="/money" element={<Money />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur pb-safe" aria-label="Main">
        <ul className="mx-auto grid max-w-[480px] grid-cols-5 px-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} onClick={tap} className="relative flex flex-col items-center gap-0.5 py-2 text-[11.5px]">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="tab-pill" className="absolute top-1 h-8 w-14 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden className={`relative ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`relative ${isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function FirstRun() {
  return (
    <div className="mx-auto max-w-[480px] px-5 pt-10 pb-10">
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-[34px] font-bold tracking-tight">Pulse</motion.h1>
      <p className="mt-2 text-[16px] leading-relaxed">Your money and your health, side by side. A few details first so your targets fit you.</p>
      <p className="mt-1 mb-6 text-[13.5px] text-muted-foreground">Everything stays on this phone.</p>
      <div className="card p-4"><ProfileForm /></div>
    </div>
  )
}

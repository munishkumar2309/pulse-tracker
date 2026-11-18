// App shell: first-run setup gate + bottom tab navigation.
import { Activity, Home, IndianRupee, Settings as Cog, Utensils } from 'lucide-react'
import { NavLink, Route, Routes } from 'react-router'
import { useProfile } from './db/hooks'
import { Food } from './screens/Food'
import { Money } from './screens/Money'
import { ProfileForm } from './screens/ProfileForm'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { Trends } from './screens/Trends'

const TABS = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/money', label: 'Money', icon: IndianRupee },
  { to: '/food', label: 'Food', icon: Utensils },
  { to: '/trends', label: 'Trends', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Cog },
]

export function App() {
  const profile = useProfile()
  if (profile === undefined) return null // still loading
  if (profile === null) return <FirstRun />

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] pb-24">
      {/* Keeps content below the Android status bar / notch inside the app. */}
      <main style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/money" element={<Money />} />
          <Route path="/food" element={<Food />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur pb-safe" aria-label="Main">
        <ul className="mx-auto grid max-w-[480px] grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11.5px] ${isActive ? 'text-ink font-semibold' : 'text-muted'}`}>
                {({ isActive }) => (<><Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />{label}</>)}
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
      <h1 className="num text-[34px] font-bold leading-none">Pulse</h1>
      <p className="mt-3 text-[16px] leading-relaxed">Your money and your health, side by side. A few details first so your targets fit you.</p>
      <p className="mt-1 mb-6 text-[13.5px] text-muted">Everything stays on this phone.</p>
      <ProfileForm />
    </div>
  )
}

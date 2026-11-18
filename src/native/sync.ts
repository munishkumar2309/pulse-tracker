// Runs on app start and whenever the app comes back to the foreground (Android only).
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { syncHealth } from './health'
import { syncPhone } from './phone'
import { listenForSms, syncSmsInbox } from './sms'
import { startWidgetUpdates } from './widgets'

let running = false

/** Health Connect first, then the phone's own tracking, so the merge rules in health/sources.ts see both. */
export async function syncHealthThenPhone(askPermission = false) {
  const health = await syncHealth(askPermission).catch((e: Error) => ({ ok: false, message: e.message }))
  const phone = await syncPhone(askPermission).catch((e: Error) => ({ steps: false, sleep: false, message: e.message }))
  return { health, phone }
}

export async function syncAll(askPermission = false) {
  if (running) return
  running = true
  try {
    // Each source is independent: a denied permission in one must not stop the other.
    await Promise.allSettled([
      syncSmsInbox().then(() => listenForSms()),
      syncHealthThenPhone(askPermission),
    ])
  } finally {
    running = false
  }
}

export function startNativeSync() {
  if (Capacitor.getPlatform() !== 'android') return
  syncAll()
  startWidgetUpdates()
  CapApp.addListener('resume', () => syncAll())
}

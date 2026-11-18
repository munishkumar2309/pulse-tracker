// Runs on app start and whenever the app comes back to the foreground (Android only).
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { syncHealth } from './health'
import { listenForSms, syncSmsInbox } from './sms'

let running = false

export async function syncAll(askPermission = false) {
  if (running) return
  running = true
  try {
    // Each source is independent: a denied permission in one must not stop the other.
    await Promise.allSettled([
      syncSmsInbox().then(() => listenForSms()),
      syncHealth(askPermission),
    ])
  } finally {
    running = false
  }
}

export function startNativeSync() {
  if (Capacitor.getPlatform() !== 'android') return
  syncAll()
  CapApp.addListener('resume', () => syncAll())
}

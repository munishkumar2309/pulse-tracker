// App lock: fingerprint / face, with the phone's PIN, pattern or password as fallback (Android BiometricPrompt).
// There is no server, so this is the "login": it protects the on-device data if someone has your unlocked phone.
// Setting lives in db.meta 'appLock' = { enabled, relockAfterSec }.
import { AndroidBiometryStrength, BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth'
import { Capacitor } from '@capacitor/core'
import { db } from '../db/schema'

export interface LockSettings { enabled: boolean; relockAfterSec: number }
export const DEFAULT_LOCK: LockSettings = { enabled: false, relockAfterSec: 30 }

export const lockSupported = () => Capacitor.getPlatform() === 'android'

export async function getLockSettings(): Promise<LockSettings> {
  return { ...DEFAULT_LOCK, ...((await db.meta.get('appLock'))?.value as Partial<LockSettings> | undefined) }
}

export async function setLockSettings(s: LockSettings) {
  await db.meta.put({ key: 'appLock', value: s })
}

/** What this phone offers: e.g. "Fingerprint", or only the screen lock, or nothing. */
export async function lockAvailability(): Promise<{ ok: boolean; label: string; reason?: string }> {
  if (!lockSupported()) return { ok: false, label: '', reason: 'App lock works in the Android app.' }
  const info = await BiometricAuth.checkBiometry()
  if (info.isAvailable) return { ok: true, label: 'Fingerprint or face, or your screen lock' }
  if (info.deviceIsSecure) return { ok: true, label: 'Your screen lock (PIN, pattern or password)' }
  return { ok: false, label: '', reason: 'Set a screen lock on your phone first (Settings → Security → Screen lock).' }
}

/** Show the system prompt. Resolves true when unlocked, false when cancelled; throws on other errors. */
export async function unlock(reason = 'Unlock Pulse'): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Unlock Pulse',
      androidSubtitle: 'Use your fingerprint, face or screen lock',
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    })
    return true
  } catch (e) {
    if (e instanceof BiometryError && (e.code === BiometryErrorType.userCancel || e.code === BiometryErrorType.appCancel || e.code === BiometryErrorType.systemCancel)) return false
    throw e
  }
}

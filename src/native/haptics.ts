// Phone vibration for taps and goal moments. Android: Capacitor Haptics; browser: navigator.vibrate (or nothing).
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const native = () => Capacitor.getPlatform() === 'android'

/** Light tick for button presses and selections. */
export function tap() {
  if (native()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
  else navigator.vibrate?.(8)
}

/** Stronger buzz when something important happens (goal reached, unlock). */
export function success() {
  if (native()) Haptics.notification({ type: NotificationType.Success }).catch(() => {})
  else navigator.vibrate?.([12, 60, 18])
}

export function warning() {
  if (native()) Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
  else navigator.vibrate?.(30)
}

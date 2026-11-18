// GPS walk/run tracking. Android: @capacitor-community/background-geolocation (foreground service with a
// notification, so tracking continues with the screen off). Browser: navigator.geolocation (screen on only).
import { Capacitor, registerPlugin } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'
import type { Fix } from '../health/geo'

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
const android = () => Capacitor.getPlatform() === 'android'

export interface Tracker { stop: () => Promise<void> }

/** Start delivering GPS fixes. `onError` gets a user-facing message (permission denied, GPS off…). */
export async function startTracking(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<Tracker> {
  if (android()) {
    // Android 13+: the "tracking your walk" notification needs this permission.
    await LocalNotifications.requestPermissions().catch(() => undefined)
    const id = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'Pulse is tracking your walk',
        backgroundMessage: 'Tap to return to Pulse. Finish the walk to stop tracking.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 3,
      },
      (loc, err) => {
        if (err) {
          onError(err.code === 'NOT_AUTHORIZED' ? 'Location permission is off. Allow "While using the app" for Pulse in Settings → Apps → Pulse → Permissions.' : err.message)
          return
        }
        if (loc) onFix({ lat: loc.latitude, lng: loc.longitude, t: loc.time ?? Date.now(), accuracy: loc.accuracy })
      },
    )
    return { stop: () => BackgroundGeolocation.removeWatcher({ id }) }
  }
  if (!navigator.geolocation) {
    onError('This browser has no GPS access.')
    return { stop: async () => {} }
  }
  const wid = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, t: p.timestamp, accuracy: p.coords.accuracy }),
    (e) => onError(e.code === e.PERMISSION_DENIED ? 'Location permission was denied.' : e.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  )
  return { stop: async () => navigator.geolocation.clearWatch(wid) }
}

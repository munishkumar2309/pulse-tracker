# Android

Capacitor 8 wraps the built web app (`dist/`) in a native Android app. App id `app.pulse.tracker`, minSdk 26, target/compile 36.

## Files
| Path | Purpose |
|---|---|
| `capacitor.config.ts` | app id/name, `webDir: dist` |
| `android/app/src/main/java/app/pulse/tracker/SmsReaderPlugin.java` | **Our own** SMS plugin: `readInbox({since, limit})`, `startListening()` → `smsReceived` events. Permissions READ_SMS + RECEIVE_SMS. |
| `.../MainActivity.java` | registers `SmsReaderPlugin` before `super.onCreate` |
| `android/app/src/main/AndroidManifest.xml` | SMS, CAMERA permissions; `allowBackup=false` + `data_extraction_rules.xml` (no Google Drive backup, so data stays on the phone); removes the Health Connect WRITE permissions the plugin declares (we only read) |
| `android/variables.gradle` | minSdk 26 (Health Connect plugin requirement) |
| `android/app/build.gradle` | `signingConfigs.pulse` (fixed key) + versionCode = `GITHUB_RUN_NUMBER` |
| `android/app/pulse-release.p12` | signing key, made once by `scripts/make-keystore.mjs` (node-forge). **Never regenerate it**: a new key means updates won't install without uninstalling, and uninstalling deletes all data. |
| `public/privacypolicy.html` | shown by Health Connect's "Privacy policy" link (required) |
| `src/native/sms.ts` | `syncSmsInbox()` (first run reads 90 days, then since `meta.smsLastSync`), `listenForSms()`, `isBankSender()` (only `XX-ABCDEF[-S]` commercial IDs; personal numbers are never parsed) |
| `src/native/health.ts` | `syncHealth(askPermission)`: 14 days of steps (daily sums), sleep sessions (minus awake stages, stage minutes kept), weight, resting HR → `meta.restingHr`. **Manual entries win**; Health Connect never overwrites a `source: 'manual'` row. Uses `@capgo/capacitor-health` 8.13 (MPL-2.0). |
| `src/native/sync.ts` | `startNativeSync()` (called in main.tsx): sync on launch and every app resume, and starts the widget feed. SMS and health are independent (`allSettled`); within health, Health Connect runs before the phone's own tracking so the merge rules see both. |
| `src/native/phone.ts` | `syncPhone(askPermission)`: the phone's own steps (10 days of daily totals) and detected sleep → DB with `source: 'phone'`, merged by `src/health/sources.ts`. Status in `meta.phoneLastSync`. |
| `src/native/widgets.ts` | `liveQuery` over today's data → `PhoneSensors.setWidgetData()` whenever it changes |
| `.../PhoneTracking.java` | **Our own** sensor tracking. Steps: Google **Recording API** (`play-services-fitness` 21.2.0), where Play services counts steps in the background, low power, on-device, no Google account, kept 10 days. Subscribed once and again after a reboot (Google keeps data "since the latest subscription", so it is not renewed on every launch). Sleep: Google **Sleep API** (`play-services-location` 21.3.0, segment events only, accelerometer + light sensor); successful nights are kept (last 30) in SharedPreferences until the app reads them. |
| `.../PhoneSensorsPlugin.java` | JS bridge `PhoneSensors`: `start({askPermission})` (asks for "Physical activity", subscribes) → `{steps, sleep, message?}`, `readSteps({days})`, `readSleep()`, `setWidgetData()` |
| `.../SleepReceiver.java` | gets detected nights from the Sleep API, even when Pulse is closed; skips MISSING_DATA/NOT_DETECTED segments |
| `.../BootReceiver.java` | after a reboot or app update, registers sleep detection again (and step recording after a reboot) |
| `.../PulseWidget.java`, `TodayWidget.java`, `StepsWidget.java` | home-screen widgets: **Pulse · Today** (4×2: steps, last night's sleep, water, spent) and **Pulse · Steps** (2×2: steps + goal bar). Tapping opens Pulse. |
| `res/layout/widget_*.xml`, `res/xml/widget_*_info.xml`, `res/values/widget.xml`, `res/drawable/widget_bg.xml` | widget layouts, sizes, colours (the app's dark theme) and strings |
| Settings → Phone sync | shows last sync times; "Allow access and sync now" asks for permissions |

## Plugins added in v2 (UI redesign)
| Plugin | Use | Permissions |
|---|---|---|
| @aparajita/capacitor-biometric-auth 10 (MIT) | App lock: BiometricPrompt with fingerprint/face + device PIN/pattern fallback (`src/native/lock.ts`, `LockGate`) | USE_BIOMETRIC (from androidx.biometric) |
| @capacitor-community/background-geolocation 1.3.1 (MIT) | GPS walk tracking; a foreground-service notification keeps it running with the screen off (`src/native/gps.ts`) | fine/coarse location, FOREGROUND_SERVICE_LOCATION, POST_NOTIFICATIONS (plugin manifest) |
| @capacitor/local-notifications 8 | Asks for POST_NOTIFICATIONS on Android 13+ before tracking | POST_NOTIFICATIONS |
| @capacitor/haptics 8 | Tap/success vibrations (`src/native/haptics.ts`) | VIBRATE |

App lock is off by default. Turning it on (You → App lock) requires one successful unlock first, so it can't lock you out. It relocks after 0/30/60/300 s in the background, and content isn't rendered while locked.

## Build
- **CI (the normal path):** `.github/workflows/android.yml` runs on every push to `main` (or by hand: Actions → Android APK → Run workflow → pick a branch): `npm ci` → `npm test` → export the food photo model (Python, cached; non-fatal) → `npm run build` → `npx cap sync android` → JDK 21 → `./gradlew assembleRelease`. Get the APK from GitHub → Actions → latest "Android APK" run → Artifacts → `pulse-apk` (zip containing `pulse-<run>.apk`).
- **Local:** needs JDK 21 + Android SDK (not installed on this laptop): `npm run build && npx cap sync android && cd android && ./gradlew assembleRelease`.
- After changing anything in `src/`, CI handles the sync. When adding a Capacitor plugin, run `npx cap sync android` locally and commit the `android/` changes.

## Installing on the phone: USB (ADB) only
**Opening the APK on the phone does not work in India.** Play Protect's *enhanced fraud protection* (Oct 2024) blocks apps that request READ_SMS/RECEIVE_SMS when installed from a browser, messaging app or file manager, and there is no "install anyway" option. Installing over USB with ADB works (verified 2026-11-18 on a Galaxy S23 FE, Android 16), and the SMS permissions are then installer-exempt, so they can be granted normally.

1. Phone: Settings → About phone → tap Build number 7× → Developer options → **USB debugging** on. Connect by USB and tap **Allow**.
2. Laptop: `adb` is at `%LOCALAPPDATA%\Android\platform-tools\adb.exe` (Google platform-tools 37.0.1, signature verified).
3. Download the `pulse-apk` artifact from GitHub Actions, unzip it, then run `adb install -r pulse-<run>.apk` (`-r` keeps the data).
4. In Pulse: Settings → Phone sync → **Allow access and sync now**. Grant SMS, then the Health Connect read permissions.
5. Updates: repeat step 3 with the new APK. The signing key is the same, so data is kept. USB debugging can be turned off between updates.

## Behaviour notes
- New SMS are caught live while Pulse is open. When it is closed, they are picked up on next open (inbox read since last sync). Pulse runs no background service of its own, which saves battery.
- **Phone step and sleep tracking** runs inside Google Play services, not in Pulse, so it keeps going when Pulse is closed. Steps recorded before the first "Allow access" aren't available, and the Recording API keeps only 10 days, so open Pulse at least once every 10 days (each open saves the days to the DB). Sleep detection needs Android 10+ and works best with the phone near the bed; a night usually arrives soon after waking. Permission: "Physical activity" (ACTIVITY_RECOGNITION), asked from Settings → Phone sync.
- **Widgets:** long-press the home screen → Widgets → Pulse. They redraw every 30 min (Android's minimum), whenever the app's data changes, and when a night of sleep arrives. Steps come live from the phone sensor; water and spend come from the app's last update. Values from an earlier day show "—" instead of being passed off as today's. A widget can't read the app's database (IndexedDB), so it relies on the snapshot the app writes.
- **Not verified yet:** the native code was written without a local Android SDK, so the first CI build is its first compile, and the Recording/Sleep API behaviour still needs checking on the phone.
- Android 14+ has Health Connect built in. On older versions, install "Health Connect by Android" from the Play Store.
- The barcode scanner uses the WebView's `BarcodeDetector` with the CAMERA permission. If the WebView lacks it, typed entry still works.
- **Food photos** use `<input type="file" accept="image/*" capture="environment">`, which Capacitor's WebView turns into the camera app (CAMERA permission, already declared). On-phone recognition runs ONNX Runtime in WebAssembly inside the WebView (about 0.5–2 s per photo on a recent phone; not yet measured on a device).
- **Food model size trade-off:** the ONNX Runtime `.wasm` (27 MB) is always in the APK. **CI bundles the model** (about 90 MB, int8): it installs CPU PyTorch and `optimum-onnx` 0.1.0, runs `npm run export:food-model` and caches `public/models` keyed on the script, so the APK is about 130 MB and photos work offline from the first use. Then `scripts/check-food-labels.mjs` warns if the model's labels differ from `src/data/foodLabels.ts`. If the export step fails, the run shows a warning and the APK falls back to downloading the model from Hugging Face on the first photo. **The CI export has not run yet** (PyTorch and Hugging Face were unreachable from the build sandbox), so check the first run's log. Locally: `npm run export:food-model` before `npm run build`. Capacitor returns 404 for missing files under `/models/`, which Transformers.js relies on.

## Signing key trade-off
The key and its default password are committed to the **private** repo so CI can sign without setup. Anyone with repo access could sign an "update". To harden this: add a `PULSE_KEYSTORE_PASSWORD` GitHub secret after re-encrypting the p12 with that password, and remove the default from `build.gradle`.

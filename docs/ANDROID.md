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
| `src/native/sync.ts` | `startNativeSync()` (called in main.tsx): sync on launch and every app resume. Each source is independent (`allSettled`). |
| Settings → Phone sync | shows last sync times; "Allow access and sync now" asks for permissions |

## Build
- **CI (the normal path):** `.github/workflows/android.yml` runs on every push to `main`: `npm ci` → `npm test` → `npm run build` → `npx cap sync android` → JDK 21 → `./gradlew assembleRelease`. Get the APK from GitHub → Actions → latest "Android APK" run → Artifacts → `pulse-apk` (zip containing `pulse-<run>.apk`).
- **Local:** needs JDK 21 + Android SDK (not installed on this laptop): `npm run build && npx cap sync android && cd android && ./gradlew assembleRelease`.
- After changing anything in `src/`, CI handles the sync. When adding a Capacitor plugin, run `npx cap sync android` locally and commit the `android/` changes.

## Installing on the phone
1. Download and unzip the artifact on the phone (or transfer the APK).
2. Open the APK and allow "Install unknown apps" for the browser/Files app when asked.
3. Google Play Protect may warn about an unknown developer. This is expected for a personal sideloaded app.
4. In Pulse: Settings → Phone sync → **Allow access and sync now**. Grant SMS, then the Health Connect read permissions (steps, sleep, weight, resting heart rate).
5. Updates: install the newer APK over the old one. Data is kept because the signing key is the same.

## Behaviour notes
- New SMS are caught live while Pulse is open. When it is closed, they are picked up on next open (inbox read since last sync). No background service runs, which saves battery.
- Android 14+ has Health Connect built in. On older versions, install "Health Connect by Android" from the Play Store.
- The barcode scanner uses the WebView's `BarcodeDetector` with the CAMERA permission. If the WebView lacks it, typed entry still works.

## Signing key trade-off
The key and its default password are committed to the **private** repo so CI can sign without setup. Anyone with repo access could sign an "update". To harden this: add a `PULSE_KEYSTORE_PASSWORD` GitHub secret after re-encrypting the p12 with that password, and remove the default from `build.gradle`.

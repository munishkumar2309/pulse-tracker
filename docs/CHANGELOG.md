# Changelog

Newest first. One line per change: date, area, what changed, which files and docs.

## 2026-11-18
- **CI fix.** First APK build failed at `android/app/build.gradle:11` ("Value is null"): Groovy command-call parsing of `versionCode (x).toInteger()`. Switched versionCode/versionName to `=` assignments.
- **Phase 4, Android.** Capacitor 8 project; our own `SmsReaderPlugin` (inbox since last sync + live listener); Health Connect sync (steps, sleep, weight, resting HR; manual entries win); resting HR now feeds readiness; Settings → Phone sync; Android cloud backup disabled; Health Connect write permissions removed; privacy policy page; fixed signing key + versionCode from the CI run number; GitHub Actions workflow builds the signed APK. 89 tests. (android/*, src/native/*, .github/workflows/android.yml, scripts/make-keystore.mjs; docs/ANDROID.md)
- Repo pushed to the private github.com/munishkumar2309/pulse-tracker. No Claude co-author trailer from now on (CLAUDE.md rule).
- **UI fixes at 360 px.** Input base styles moved into `@layer base` (they were overriding Tailwind, so Settings scrolled sideways); checkboxes are no longer styled as text fields. The Food ring shows "1,289 / kcal eaten" so it no longer crowds the other rings. BMI notes "(Asian range)". Safe-area top padding for the Android status bar. All 5 screens checked for horizontal overflow: none. (index.css, App.tsx, Today.tsx, Money.tsx; docs/UI.md)
- **Phase 3, food, done.** IFCT 2017 (542 foods, generated JSON), ~100 Indian dishes (estimates, macro-consistency test), search with Hindi aliases, portion picker (katori/piece/grams), Recent, Open Food Facts barcode + online search with a bad-data filter, native barcode scanning. `db.foods` type is now `FoodItem`. 87 tests passing. (data/*, health/foodSearch.ts, openFoodFacts.ts, food.test.ts, components/BarcodeScanner.tsx, screens/Food.tsx, scripts/build-ifct.mjs; docs/HEALTH.md, ARCHITECTURE.md, UI.md)
- **Readiness v2 from the REA teardown.** Sleep need now includes 3-night debt, regularity uses bed and wake σ, optional resting HR. Bands changed to Pulse's own 70/40 (Ready/Steady/Go easy); the old 67/34 copied WHOOP. The explanation sheet shows calibration ("needs 3 nights; you have N"). (health/recovery.ts + test, db/hooks.ts, ReadinessArc, Today; docs/HEALTH.md)
- **Fitbit/WHOOP teardown done** with REA `capture-browser-scenario` → `docs/research/fitbit-whoop-teardown.md`. whoop.com/thelocker blocked automated access, so it is covered by search snippets only. Fitbit is now Google Health (app replaced May 2026).
- **Statement import (Phase 2 done).** CSV/XLSX/PDF (password-protected PDFs supported), column auto-detect, narration → merchant, dedupe against SMS. (money/statementImport.ts + test, statementFiles.ts, ingest.ts + DB test, Money.tsx; docs/MONEY.md). 76 tests passing.
- **UI pass after browser check (390×844).** Shortened the pace labels, made "messages skipped" singular when there's one, labelled card bill payments, title-cased merchants (acronyms kept), hid "new this month" notes until there is earlier history, rounded the weight axis. (ProfileForm, Money, smsParser, Trends; docs/MONEY.md)
- **Phase 1 + 2 core built.** App shell, first-run setup, Today (readiness arc, rings, body stats, money today), Money (SMS paste, categories, habits, budgets, recurring, recategorise with rules), Trends, Settings (profile, budgets, theme, backup/restore), Food quick-add placeholder. (src/*; docs/ARCHITECTURE.md, MONEY.md, HEALTH.md, UI.md)
- **Logic + tests.** health/calc, health/recovery, money/smsParser, categorize, insights, lib/format: 59 Vitest tests passing.
- **Phase 0.** REA (`rea-agents` 6.9.0) installed globally and registered for Claude Code; the user's `.claude.json` was backed up by REA. Fitbit/WHOOP teardown running (to `docs/research/fitbit-whoop-teardown.md`).
- Created `CLAUDE.md` (repo guide + doc-maintenance rule) and this changelog.

## Current phase
Phase 4 code done; first CI APK build to verify on GitHub, then install on the phone. Next: Phase 5 polish (journal + insights, water reminders, app lock, lazy-load Trends). Still waiting on the user's real bank SMS samples and statements.

## Known items
- npm audit: picomatch/minimatch/glob advisories are in **build-time** dependencies of vite-plugin-pwa (workbox) only, not shipped in the app. Re-check when the plugin updates.
- Main JS bundle is about 886 KB (Recharts). Lazy-load Trends if startup feels slow on the phone.

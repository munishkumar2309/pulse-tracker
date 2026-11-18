# Pulse — Expense + Health Tracker

Personal Android app (React web app wrapped with Capacitor). Tracks spending from bank/credit card SMS and statements, and health (steps, weight, BMI, water, sleep, food) in a Fitbit/Whoop style. **All data stays on the phone.** There is no server.

## Read this first — how to work in this repo
- **Don't read the whole codebase.** Start here, then open only the doc for the area you're changing:
  - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, folder map, data flow, DB schema
  - [docs/MONEY.md](docs/MONEY.md): SMS parsing, statement import, categories, insights
  - [docs/HEALTH.md](docs/HEALTH.md): formulas (BMI, BMR, TDEE, water, readiness), food data sources
  - [docs/UI.md](docs/UI.md): screens, components, design tokens, Fitbit/Whoop patterns adopted
  - [docs/ANDROID.md](docs/ANDROID.md): Capacitor, SMS + Health Connect plugins, APK build
  - [docs/research/fitbit-whoop-teardown.md](docs/research/fitbit-whoop-teardown.md): REA teardown findings
  - [docs/CHANGELOG.md](docs/CHANGELOG.md): what changed and when
- **Keep the docs true.** Any change that adds or moves a file, changes a formula, the schema, a category, or a screen must update the matching doc **and** add a line to `docs/CHANGELOG.md` in the same change. A doc that disagrees with the code is a bug.
- Each doc lists its files with a one-line purpose, so you can jump straight to the right file.

## Agent team (`.claude/agents/`)
Hand work to the agent that owns the area. Each one knows its files, docs and "done" checks.
| Agent | Owns |
|---|---|
| `ui` | screens, components, shadcn `ui/`, tokens in `index.css`, layout, theme |
| `ux` | flows, copy, empty/error states, accessibility (reviews + copy fixes) |
| `logic` | pure TS + Vitest: `money/*` (not ingest), `health/*`, `lib/*`, `data/*` |
| `backend` | Dexie schema/hooks, `money/ingest.ts`, `native/*`, `android/`, CI APK build |
| `qa` | final gate: tsc, tests, build, browser smoke, docs drift, privacy. Reports per owner; doesn't fix |

## Commands
| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Unit tests | `npm test` |
| Build web | `npm run build` |
| Android sync | `npx cap sync android` (Phase 4) |

## Conventions
- TypeScript strict. Pure logic (parsers, formulas, insights) lives in plain `.ts` modules with Vitest tests next to them; React components stay thin.
- Money: store amounts as **integer paise**. Display with `formatINR()` (Indian grouping: ₹1,25,000).
- Dates are stored as ISO strings in local time; day keys are `YYYY-MM-DD`.
- Health numbers that are estimates or heuristics (dish nutrition, readiness score) must be labelled as such in the UI.
- Native features go through `src/native/*` bridges that have browser fallbacks, so everything runs in a desktop browser.
- Original design only. Never copy Fitbit or Whoop code, assets, logos or names.
- **Commits:** no `Co-Authored-By: Claude` trailer or any Claude attribution in commits or PRs (the owner's explicit rule).
- **Branches:** push directly to `main` (the owner's explicit rule for this project). No feature branches or pull requests unless asked. Every push to `main` builds the APK in GitHub Actions.

## Status
Plan: `C:\Users\munish.kumar_bajajca\.claude\plans\so-i-want-to-playful-cocke.md`. Phases: 0 REA teardown → 1 health core → 2 money → 3 food → 4 Android → 5 polish. The current phase is tracked in `docs/CHANGELOG.md`.

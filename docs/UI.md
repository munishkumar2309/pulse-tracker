# UI

## Design direction
- **Subject:** one person in India checking body and money on an Android phone, in short glances. The job of each screen is to answer "how am I doing today?" in about 3 seconds.
- **One bold element per screen:** the readiness arc (Today), the month total (Money), kcal left (Food). Everything else is quiet and separated by spacing and hairlines, not stacks of identical cards.
- **Two accents:** turmeric `--body` for the health side, peacock `--money` for the money side. Section headings use them, so you always know which half you're in.
- **Type:** Archivo variable only. Readings use `.num` (font-stretch 125%, tabular figures) or `.num-tight` (112%). Body text uses normal width. No all-caps labels and no monospace.
- **Inspired by Fitbit/WHOOP, never copied:** no brand names, dial art or colour schemes taken from either. See `docs/research/fitbit-whoop-teardown.md` for what was studied.

## Tokens (`src/index.css`)
| Token | Dark | Light | Use |
|---|---|---|---|
| --bg | #0E1822 | #F3F5F2 | page |
| --surface / --surface-2 | #16232F / #1E2E3C | #FFF / #E9EDEA | sheets / inputs, ring tracks |
| --line | #2A3B4A | #D5DCD8 | hairlines |
| --ink / --muted | #E8EEF2 / #8B9CAB | #13202B / #5E6E7B | text |
| --body | #F2A93B | #C27C12 | health accent |
| --money | #2FB8A6 | #128A7B | money accent, primary buttons |
| --bad / --ok | #EF6A5B / #7BC67E | | over budget, readiness bands |
| --ring-steps/food/water/sleep | amber / pink / sky / lavender | darker in light | rings + Trends charts |
| --cat-c1…c19 | per category | | category bar; always paired with a text label |

**CSS layering rule:** global element styles (inputs etc.) live in `@layer base`. Unlayered CSS beats Tailwind utilities, which once made a hidden file input 646 px wide and broke the Settings layout at 360 px.

Theme: follows the OS by default. Settings → Appearance sets `data-theme` on `<html>` (saved in localStorage, with try/catch).

## Screens
| Route | File | Shows |
|---|---|---|
| (no profile) | App.tsx `FirstRun` + ProfileForm | setup form |
| `/` | screens/Today.tsx | readiness arc, 4 rings (tap to log), Body stats (weight, BMI, eat today, goal date), Money today vs daily budget |
| `/money` | screens/Money.tsx | month switcher, spent, change vs last month, Add bank SMS / Add expense, category bar + list (tap to filter), "Worth knowing" habit notes, budgets, top places, repeating payments, transactions (tap to recategorise) |
| `/food` | screens/Food.tsx | kcal left, protein/carbs/fat, meals (tap an item to remove), "Add food to <meal by time of day>"; add sheet: search + Recent, Scan a barcode, Enter calories, Search packaged foods online, then the portion picker |
| `/trends` | screens/Trends.tsx | 7/30/90-day weight (goal line, healthy band), sleep, steps, spend by week |
| `/settings` | screens/Settings.tsx | profile, budgets, appearance, backup download/restore, delete all |

## Components
- `Ring`: progress ring; above 100% it draws a brighter second lap.
- `ReadinessArc`: a 240° arc, colour by band, and a "How this is worked out" sheet.
- `Sheet`: bottom sheet on native `<dialog>` (focus trap, Esc, backdrop tap). Also exports `Field` and `PrimaryButton`.
- `LogSheets`: weight, water, sleep and steps forms.
- `BarcodeScanner`: camera + native BarcodeDetector, with typed-number fallback.

## Copy rules
Sentence case. Buttons say what happens ("Save weight", "Read 3 messages"). Empty states say what to do next. Health estimates are labelled as estimates.

## Checking UI changes
Run `npm run dev`, open the app at 390×844 (Playwright MCP or a phone), seed data via `window.db` in the console, and check both themes and that the console has no errors.

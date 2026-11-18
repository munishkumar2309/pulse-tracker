# UI

## Design direction (v2, 2026-11-18)
- **Fitbit-style, original artwork:** light grey page, white rounded cards (`.card`, radius 20 px, soft shadow), one colour per metric, big friendly numbers, a tile grid on Today. Dark mode uses near-black with dark grey cards. No Fitbit/WHOOP logos, icons, artwork or names.
- **Motion** (`motion` library): rings fill (`pathLength`), numbers count up (`AnimatedNumber`), Today tiles stagger in, cards squeeze on tap (`Tile`), the tab highlight slides (`layoutId="tab-pill"`), screens fade/rise (`Page`), lock screen fades. `MotionConfig reducedMotion="user"` turns motion off when the phone's "Remove animations" setting is on.
- **Haptics:** `native/haptics.ts` `tap()` on presses and tab changes; `success()` on goals reached, unlock, walk saved.
- **Font:** Geist Variable (bundled). Numbers use `.num` (tabular, bold) so they don't jump while animating.

## Tokens (`src/index.css`)
shadcn names are the source of truth: `--background --foreground --card --muted --muted-foreground --primary --accent --border --destructive --chart-1..5`. Metric colours: `--steps --food --water --sleep --weight --ok --warn --bad`. Category hues: `--cat-c1..c19` (always paired with a text label). Old names (`--bg --surface --surface-2 --line --ink --body --money --ring-*`) are **aliases** kept for back-compat. Don't use them in new code.

- **Text:** `text-foreground`, grey `text-muted-foreground`. **Note:** `text-muted` / `bg-muted` is a *fill* colour, not text.
- **Theme:** `lib/theme.ts` sets `<html class="dark">` (dark), `data-theme="light"` (force light), or follows the OS. It is called from `main.tsx` (`initTheme`) and Settings.
- **CSS layering rule:** element styles (inputs etc.) live in `@layer base`, so utilities like `sr-only` and `w-5` still win.

## Screens
| Route | File | Shows |
|---|---|---|
| (locked) | components/LockGate.tsx | fingerprint button; the system prompt with fingerprint/face/screen-lock fallback |
| (no profile) | App.tsx `FirstRun` + ProfileForm | setup form |
| `/` | screens/Today.tsx | header (date, Trends + avatar buttons), hero steps ring (count-up) + Eaten/Water/Sleep bars, Readiness card, tile grid: Sleep, Water (+250 ml quick add), Food, Weight, BMI, Spent today, Last walk, Goal date |
| `/activity` | screens/Activity.tsx | steps today + 7-day bar chart (shadcn chart), GPS tracker (start → live map, distance, time, pace, pause/resume, finish), past walks (tap → route map + delete) |
| `/food` | screens/Food.tsx | kcal left, macros, meals, add sheet (search, recent, barcode, online, manual) |
| `/money` | screens/Money.tsx | month pill, spent (count-up) + vs same days of last month (like-for-like) + money in + invested (not counted as spend), actions (Bank SMS, Expense, Statement), Tabs: **Overview** (interactive donut: tap a slice/row to highlight, centre shows the category; category bars; **Compared with <last month>** card (difference, biggest rise, biggest share, per-category ▲/▼ rows; tap opens that category's payments); spend bar chart with Day/Week/Month toggle (Month adds a month-by-month list with top category and % change; tap to jump to that month); budgets; habit notes; top places; repeating payments) and **Transactions** (filtered by the selected category; tap to recategorise) |
| `/trends` | screens/Trends.tsx | 7/30/90-day weight, sleep (phone-estimated nights noted), steps, spend |
| `/settings` | screens/Settings.tsx ("You" tab) | profile card, goals/budgets rows, **App lock** switch + relock delay, Phone sync (SMS, Health Connect, phone sensors), appearance, backup/restore/delete |

Bottom tabs: Today · Activity · Food · Money · You.

## Components
- `motion.tsx`: `AnimatedNumber`, `Tile` (pressable card + haptic), `Page` (screen transition), `IconDot`.
- `Ring`: animated progress ring with centre content; a second brighter lap above 100%.
- `RouteMap`: Leaflet + OpenStreetMap tiles (attribution shown; tiles need internet; tracking itself doesn't).
- `LockGate`, `Sheet` (+`Field`, `PrimaryButton`), `LogSheets`, `BarcodeScanner`, `ReadinessArc` (exports `BAND`).
- `ui/*`: shadcn (Nova preset, Radix): button, card, chart, tabs, toggle-group, switch, drawer, progress, badge. Add more with `npx shadcn@latest add <name>` or the **shadcn MCP** (`.mcp.json`, after a Claude Code restart).

## Copy rules
Sentence case. Buttons say what happens. Empty states say what to do next. Estimates are labelled (readiness, dish nutrition, phone-sensor sleep "From phone sensors (estimate)", walk kcal).

## Checking UI changes
Run `npm run dev`, then use Playwright at 390×844 and seed via `window.db`. Check light and dark, and that the console has no errors. Charts and rings animate in, so wait about 1.5 s before taking a screenshot. **The Playwright browser may be shared with other sessions; its data and theme can change under you.**

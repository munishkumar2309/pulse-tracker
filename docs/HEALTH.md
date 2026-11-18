# Health

Files: `src/health/calc.ts`, `src/health/recovery.ts`, `src/health/sources.ts` (which source wins), `src/db/hooks.ts` (`targetsFor`, `useToday`), `src/screens/Today.tsx`, `Food.tsx`, `Trends.tsx`, `src/components/LogSheets.tsx`.

## Formulas (`calc.ts`)
| What | Formula | Source |
|---|---|---|
| BMI | kg / m², 1 dp | WHO |
| BMI bands, Asian (default) | <18.5 under, 18.5–22.9 normal, 23–24.9 overweight, ≥25 obese | WHO Expert Consultation, *Lancet* 2004; Misra et al., Indian consensus statement, *JAPI* 2009 |
| BMI bands, WHO | 18.5 / 25 / 30 | WHO |
| Healthy weight range | BMI 18.5 to 22.9 (Asian) or 24.9 (WHO) × m² | derived |
| BMR | Mifflin-St Jeor: 10w + 6.25h − 5a + 5 (male) / −161 (female) | Mifflin et al. 1990 |
| TDEE | BMR × 1.2 / 1.375 / 1.55 / 1.725 / 1.9 | standard activity factors |
| Calorie target | TDEE − pace × 7700 / 7, floor 1500 (male) / 1200 (female) | 7,700 kcal per kg of fat is a planning estimate |
| Water | 35 ml × kg, rounded to 100 ml | common guideline, an estimate |
| Protein | 1.2 g × kg | above the ICMR-NIN RDA of 0.83 g/kg, to keep muscle while in a deficit |
| Goal date | ceil((current − goal) / pace) weeks | |

The UI marks the floor ("Kept at a safe minimum") and states that numbers are estimates, not medical advice.

## Readiness (`recovery.ts`): heuristic, phone-only
Adopted from `docs/research/fitbit-whoop-teardown.md` §4. Labelled in the app as an estimate from sleep and steps.

- **Sleep need** = goal + min(60, total shortfall of the previous 3 nights ÷ 3).
- **S, sleep:** 100 × slept ÷ need, capped at 100.
- **C, regular schedule:** σ = mean of the std-dev of bedtimes (measured from 18:00) and wake times, over the main sleep of the last 7 nights. Score = 100 × (90 − σ) ÷ 75: 15 min or less scores 100, 90 min or more scores 0. Needs 3 or more nights; until then the UI shows "you have N".
- **L, yesterday's effort:** r = yesterday's steps ÷ 14-day average. r ≤ 1.2 scores 100, r ≥ 2.5 scores 0, linear in between.
- **R, resting HR (optional, Phase 4 via Health Connect):** Δ = today − 14-day median. Δ ≤ 0 scores 100, +7 bpm or more scores 0. Needs at least 7 readings.
- **Weights:** S 0.60, C 0.25, L 0.15. With R: S 0.45, C 0.20, L 0.15, R 0.20. Missing parts are dropped and the rest re-weighted. There is no score until today's sleep is logged.
- **Bands (Pulse's own, not WHOOP's 67/34):** 70+ Ready, 40–69 Steady, below 40 Go easy. Each is shown by name, not colour alone.
- Worked example (in tests): need 510, slept 450, σ 25, r 1.5 gives 86, Ready.

Teardown ideas not built yet (candidates for Phase 5): a morning yes/no journal with "linked with" insights after 5 yes and 5 no answers (could link late-night food delivery spend with sleep), weekly catch-up targets, a days-logged streak, and a customisable tile grid on Today.

## Logging
- Today's rings open the log sheets: steps, water (150/250/500 ml), sleep (bed and wake time; a bedtime after the wake time means the previous day). The Food ring goes to the Food tab.
- Weight comes from "Log weight". The latest entry by date is "current weight" for every target.
- Steps, sleep and weight come from Health Connect automatically in Phase 4. `source` records where each entry came from.
- **The phone's own tracking** (`source: 'phone'`): steps from the phone's motion sensors (Google Recording API) and sleep detected from motion and light (Google Sleep API). See docs/ANDROID.md. Phone sleep is an **estimate** with no stages; it must be labelled as such wherever its source is shown.

## Merging sources (`src/health/sources.ts`, tested)
| Data | Rule |
|---|---|
| Steps | Manual always wins. Otherwise keep the **higher** count of phone and Health Connect (they count the same walking, so adding them would double count; each misses steps the other caught). A count never goes down. |
| Sleep | Manual for that morning wins. Phone nights under 60 min are ignored. A phone night is skipped if any entry overlaps it, and a Health Connect session (watch, with stages) **replaces** an overlapping phone night. Overlap is compared as instants, so UTC and local ISO strings mix safely. |

## Food (Phase 3)
Files: `src/data/ifct.json` (generated), `scripts/build-ifct.mjs`, `src/data/dishes.ts`, `src/health/foodSearch.ts`, `src/health/openFoodFacts.ts`, `src/components/BarcodeScanner.tsx`, `src/screens/Food.tsx`, `src/health/food.test.ts`.

| Source | What | Quality |
|---|---|---|
| **IFCT 2017** (NIN/ICMR) via `@ifct2017/compositions` 2.0.9 (MIT) | 542 raw/edible foods, per 100 g, with a Hindi name used as an alias. Energy is converted from kJ (÷4.184). Regenerate with `npm run build:foods`. | Lab-measured; the most accurate source |
| **Dishes** (`dishes.ts`) | 127 common Indian dishes per natural unit (katori 150 g, roti 40 g, plate…), converted to per 100 g | **Estimates** for typical recipes, labelled in the UI. A test checks each dish's kcal is within 20% of 4P+4C+9F (alcohol exempt). |
| **Open Food Facts** (ODbL) | Packaged foods by barcode (`world.` API v2) or name (`in.` search, Indian products) | Crowd-sourced. Entries whose kcal contradicts their own macros by >35% are dropped, and the UI says to check against the packet. Search runs only on a button press (official limit ≈10 searches/min). |

- **Search** (`searchFoods`): every query word must prefix-match a word in the name, alias or brand. Ranking: name starts with the query, then name-word matches, then a dish bonus, then saved foods, then shorter names.
- **Logging:** a pick opens the portion picker (natural unit, 100 g or grams). `foodLogs` keeps a nutrition snapshot. OFF and custom foods picked are saved to `foods`, so they work offline and appear under Recent. Recent = distinct foods from the last 30 days.
- **Barcode:** native `BarcodeDetector` (Chrome / Android WebView), with typed entry as the fallback. The Android build needs the CAMERA permission (Phase 4).
## Food photo recognition
Files: `src/components/FoodPhoto.tsx` (UI), `src/health/foodVision.ts` (pure mapping, `foodVision.test.ts`), `src/health/foodRecognizers.ts` (runs the models), `src/data/foodLabels.ts` (model label → Pulse dish), `scripts/export-food-model.py`.

Flow: Add food → **📷 Photo** → take or pick a photo (shrunk to 1024 px JPEG) → guesses → tap a Pulse food → the normal portion picker → log. **Calories always come from Pulse's own data** (dishes = estimates, IFCT), not from the model. The one exception is "Log AI estimate", offered only when cloud recognition found an item that Pulse has no food for; it is logged as "<name> (AI estimate)".

| Engine | Model | Privacy | Notes |
|---|---|---|---|
| **On the phone** (default) | `dima806/indian_food_image_detection`: ViT-base fine-tune, 80 Indian dishes, **Apache-2.0**, about 75% validation accuracy as reported by its author (not verified by us). Run with Transformers.js 4 + ONNX Runtime Web (WebAssembly, CPU), int8 (`dtype: 'q8'`, about 90 MB). | Photo never leaves the phone | Classifies **one dish per photo**. Top 3 guesses with score ≥ 0.08; below 0.5 the top guess shows "not sure". |
| **Cloud** (opt-in, You → Food photos) | Claude (`claude-opus-5-5`, effort `low`, structured output: items with name, grams, kcal, confidence; server-side refusal fallback on) with the user's own Anthropic API key | Photo is sent to Anthropic | Several items per plate (thalis) and portion guesses. The guessed grams prefill the portion picker. |

Why this model: it was the most capable Indian food model found on Hugging Face (Nov 2026) under a licence that allows use: 80 classes. Others, such as the 20-class ViT/Swin fine-tunes at about 93–94%, cover fewer dishes, and their training set (`indian_food_images`) has no licence. Weakness: its classes lean towards sweets and North Indian curries. It has **no idli, dosa, sambar, plain rice or mixed thali**, so for those use search or cloud recognition. Its training images come from a Kaggle set with an "other" licence: fine for this personal app; check it before any commercial use.

**Labels** (`foodLabels.ts`): all 80 are listed. 47 match a Pulse dish exactly and 19 use a stand-in (`approx`, e.g. imarti → jalebi, labelled "closest match"). 26 dishes were added to `dishes.ts` for this, as estimates under the same macro test. The remaining 14 (regional sweets) have no data and offer "Search…". The model's real label list comes from its `config.json`; the export script writes `labels.json` to compare against the map.

**Model files:** loaded from `public/models/<model id>/` when bundled (`npm run export:food-model`, Python + optimum; then fully offline and Hugging Face is never contacted), otherwise downloaded once from Hugging Face and cached by the browser. **The download path only works if that Hugging Face repo has ONNX weights. This was not verified (huggingface.co was unreachable from the build sandbox), so bundling is the safe route.** The ONNX Runtime `.wasm` is bundled by Vite (imported with `?url`), not fetched from the jsdelivr CDN.

**API key:** stored in `db.meta` under `secret:anthropicKey`; `secret:` rows are never written to backups.

- **Not done:** USDA FoodData Central (optional; would need the user's own key), custom recipe builder, INDB cooked-dish data (licence unchecked).

# Fitbit (now Google Health) and WHOOP: UX and feature teardown for Pulse

Research date: 18 Nov 2026. Scope: public help articles, public product pages and Play Store listing text only. No APKs were downloaded, nothing was decompiled, no logins and no forms. Short quotes are evidence only. All Pulse designs below are original.

Tags: **[Seen]** = stated in a public source (URL in §6). **[Inferred]** = our reading of seen facts. **[Unknown]** = not public or not verified.
Tool tags: *(REA)* = captured with `rea capture-browser-scenario`. *(WS)* = WebSearch snippets (fallback, because whoop.com returned a Cloudflare block to REA and HTTP 403 to WebFetch).

> **Context change:** the Fitbit app became the **Google Health app** in May 2026 (v5.x). The Play listing says "The Fitbit App is now Google Health" [Seen, REA]. Fitbit metrics (Sleep Score, readiness, Active Zone Minutes) still exist there. Badges appear to be gone (§3.5).

---

## 1. Summary: patterns to adopt

1. **Three scores at the top, each opening a detail screen** (WHOOP's Sleep / Recovery / Strain dials). For Pulse that means Sleep, Readiness and Move, with Spend as an optional fourth.
2. **A customisable tile grid under the hero.** Users can edit, add, remove, reorder and switch to an expanded view (Fitbit Today tab, WHOOP My Dashboard).
3. **Every 0–100 score has three named bands and a list of what moved it.** Both apps show contributors, not just a number.
4. **Show calibration openly.** For example, "needs 7 nights" or "consistency unlocks after 3 nights". Show "building baseline n/7" instead of a fake number.
5. **Sleep need is not fixed.** It rises with sleep debt, naps lower it, and sleep is scored as sufficiency plus consistency (WHOOP).
6. **Weekly targets that can be made up later** (Fitbit's weekly cardio ring, WHOOP's Weekly Plan). Progress is the equal-weight mean of the goals, with a Friday check-in and a Monday recap.
7. **A morning yes/no journal that turns into insights** after at least N "yes" and N "no" answers. The insights are worded as associations, not causes.
8. **Logging is fast and corrections are easy.** Water has preset sizes, sleep logs can be edited and the score recalculates, and manual entries win over synced ones in the de-dup order.
9. **Trends come with Week / Month / 6-month (or Year) tabs** on every metric. The messaging is "watch your trend, not one day" (both apps say this).
10. **A streak counter by the profile** (WHOOP Streak) instead of a badge catalogue (Google removed Fitbit badges).

---

## 2. WHOOP

### 2.1 Feature inventory
| Feature | Notes | Tag |
|---|---|---|
| Recovery | Daily score from 1 to 99% (Play listing). Computed during sleep and shown in the morning | [Seen] REA |
| Strain | 0–21 scale, logarithmic. Day Strain plus per-activity Strain. Combines cardiovascular and muscular load | [Seen] REA |
| Sleep Performance | 0–100%. Combines sufficiency, consistency, efficiency and sleep stress | [Seen] REA |
| Sleep need / Sleep Planner | Recommended bedtime and wake time. "Improve My Sleep" goal | [Seen] REA |
| Journal | 160+ yes/no behaviours. Morning prompt after sleep is processed | [Seen] REA |
| Behaviour Insights (Recovery Impacts) | Rated from significant negative to significant positive per behaviour | [Seen] REA |
| Weekly Plan | Preset or custom goals. Runs Monday to Sunday. Unlocks after 7 sleeps | [Seen] REA |
| Month in Review | Replaced the Monthly Performance Assessment | [Seen] REA |
| Coach (AI), Healthspan / "WHOOP Age", Stress Monitor, VO2 max, steps | Tiered by membership | [Seen] REA |
| Streak | "how many consecutive days a member collects WHOOP data", shown next to the profile icon | [Seen] REA |
| Social ("WHOOP Humans"), Teams | Followers, shared stats and Moments | [Seen] REA |
| Phone-only use | "The WHOOP app requires a WHOOP wearable." There is no phone-only mode | [Seen] REA |
| Health Connect / Apple Health | Imports workouts. Exports sleep, RHR and workouts. Imported activities override auto-detected ones | [Seen] REA |

### 2.2 Screen layouts
**Home** [Seen, REA: *Navigating the WHOOP App*, *Calibration Timeline*]
- Top: three dials. **Sleep is top-left, Recovery top-middle, Strain top-right.** Each dial opens its own tab or detail screen.
- **My Day:** today's activities, last night's sleep, a "Start Activity" button and a "Tonight's Sleep" link into the Sleep Planner.
- **Journal card** below the activities, with a "Behaviour Insights" button.
- **My Plan:** a weekly-plan progress bar. Tapping it opens the per-goal view and then "View My Plan".
- **My Dashboard:** customisable metric tiles. A pencil opens show/hide plus drag-to-reorder, then Save. Tapping a tile and then "^" opens Weekly, Monthly or 6-Month trends.
- Top bar: streak next to the profile icon and a device indicator on the right. Bottom nav: Home, Health (heart icon), Coach, community, More, plus an Action (+) button for Start/Add Activity, Journal and Live overlay.
- A "Merge Sleep" notification appears on Home when a nap looks like part of the main sleep. Conflicting activities show a fix prompt.

**Sleep tab** (opened from the Sleep dial) [Seen]: the score breakdown shows each sub-metric in optimal, "sufficient (grey)" or "poor (orange)". It lists Time in Bed, Hours of Sleep, Restorative (REM + Deep), Wake Events, Efficiency, Respiratory Rate, Latency (manual tracking only) and Sleep Debt.
**Recovery tab** (Recovery dial) [Seen]: the score with HRV, RHR, respiratory rate, SpO₂ and skin temperature. Behaviour Insights can also be reached from here.
**Strain tab** (Strain dial) [Seen]: Day Strain, Today's Activities, an optimal Strain target, and for each activity its HR zones, duration and Strain.
**Trends** [Seen]: Weekly, Monthly or 6-Month views for each dashboard metric. A Locker article describes Strain vs Recovery comparison (WS).

### 2.3 Metric definitions
**Recovery**
- Bands: **High 67%+ (green), Moderate 34–66% (yellow), Low ≤33% (red)** [Seen, REA, support *WHOOP Recovery*].
- Inputs: HRV, RHR, respiratory rate, sleep hours vs needed, light sleep plus awake time, skin temperature, SpO₂, and menstrual phase where it applies [Seen].
- HRV and RHR are "the two biggest contributors". HRV is compared to a **30-day baseline** and is a weighted rMSSD over the night, with more weight on slow-wave sleep and later in the night [Seen].
- The exact weights are **[Unknown]**.
- One score per **sleep-to-sleep cycle**. Naps do not create a new score [Seen].
- Strain does not feed Recovery directly. It shows up through next-day HRV and RHR [Seen].

**Strain**
- Bands: Light 0–9, Moderate 10–13, High 14–17, All Out 18–21 [Seen].
- "Strain is logarithmic... easier to go from 0 to 4 than from 10 to 14" [Seen].
- Built from cardiovascular load (how high and how long the HR stays up) plus muscular load (volume × intensity; estimated from activity type and duration, or from logged sets) [Seen].
- The optimal Strain target uses Recovery, Strain so far today and cycle phase [Seen].
- The formula is **[Unknown]**. We **[Inferred]** a saturating curve of HR-zone time.

**Sleep Performance**
- Built from four factors: **Hours vs Needed, Consistency, Efficiency, Sleep Stress**. Each factor has its own weight, and the weights are **[Unknown]** [Seen].
- Display thresholds [Seen]:

| Metric | Optimal | Sufficient | Poor |
|---|---|---|---|
| Score | ≥85% | 70–85% | <70% |
| Hours vs Needed | ≥85% | 70–85% | <70% |
| Consistency | ≥80% | 70–80% | <70% |
| Efficiency | ≥90% | 80–90% | <80% |
| Sleep Stress | <1% | 1–5% | >5% |

- Consistency compares **last night with the previous 4 nights** (it needs 5 consecutive nights to calibrate; the Sleep article says 3 nights to unlock) [Seen].
- Efficiency = time asleep ÷ time in bed [Seen].
- **Sleep need** = Baseline Sleep + Today's Strain + Sleep Debt − Naps. It is "dynamic" and "updates throughout the day" [Seen]. The coefficients are **[Unknown]**.
- Naps lower sleep need but do not count toward debt or Recovery [Seen].

**Journal / Insights**
- Morning auto-prompt for **yesterday's** behaviours. Opening it manually shows today [Seen].
- 14-day swipe and a month calendar where logged days get a green dot [Seen].
- Search tolerates typos and synonyms ("Coffee" finds Caffeine) [Seen].
- Insight threshold: **5 yes + 5 no within 90 days** (Recovery Impacts article). The Journal article says "10 entries over 30 days", so the sources conflict [Seen].
- WHOOP calls the impacts associations, with "machine learning" behind them. The method is **[Unknown]**.

**Weekly Plan** [Seen]: five goal types (sleep, strain, HR-zone minutes, activity frequency, behaviours). Progress is the **equal-weight mean of all goals**, with a Friday check-in notification and a Monday recap after journaling.

**Calibration** [Seen]: Journal insights need 5 yes + 5 no. Strain fully calibrates at 14 recoveries. Healthspan needs 21 recoveries in 31 days. Weekly Plan needs 7 sleeps.

---

## 3. Fitbit / Google Health app

### 3.1 Feature inventory
| Feature | Notes | Tag |
|---|---|---|
| Tabs | With a device: **Today, Fitness, Sleep, Health**. **Phone-only: Today and Health** | [Seen] REA |
| Today tab | Customisable "focus metrics" via Edit, Add/Remove and "Expanded view". Coach messages (Premium). Recent exercise and sleep | [Seen] REA |
| Readiness | 1–100. Inputs: HRV, sleep, RHR. Needs a compatible device | [Seen] REA |
| Sleep Score | 0–100, new algorithm in 2026. Needs sleep stages from a device | [Seen] REA |
| Active Zone Minutes | Heart-rate based. Older devices count "active minutes" instead | [Seen] REA |
| Weekly cardio load ring | Weekly target, usually based on the last 4 weeks of cardio load | [Seen] REA |
| Steps goal | 10,000 by default. The device "flashes and vibrates" when you reach it | [Seen] REA |
| Nutrition | Search, barcode, photo and conversational logging. Calorie target and macros | [Seen] REA |
| Hydration | Presets: "Glass, Bottle, or Large bottle". Caffeine and alcohol can be tracked separately | [Seen] REA |
| Weight / body fat | Under Health → Focus areas → Metabolic | [Seen] REA. BMI display is **[Unknown]** |
| Phone-only steps | "steps, distance, and calories burned" from the phone's step sensor. The phone keeps 7 days of data offline | [Seen] REA |
| Badges | The badges help URL now redirects to "Connect with friends". Press reports say badges were removed | Redirect [Seen] REA; removal [Seen] WS (secondary sources) |
| Social | Friends and weekly leaderboards for Steps and Cardio load | [Seen] REA |
| Health Connect | Two-way sync. De-dup priority: **manual > Health Connect/Apple Health > web API** | [Seen] REA |

### 3.2 Screen layouts
- **Today:** focus metrics at the top (customisable), then shortcuts to "Log data or start workout tracking from your phone", then coach or update messages and their history [Seen, feature map].
- Readiness is "featured prominently in your Today tab metrics dashboard, alongside... weekly cardio load and sleep" [Seen].
- Tapping a metric opens hourly charts, plus Week, Month and Year tabs [Seen].
- The weekly cardio ring "displays your daily contribution and overall weekly percentage" [Seen].
- Food & drink can be a Today tile that shows calories eaten and calories left [Seen].
- **Sleep:** sleep score and duration trends, last night's details, and "Sleep duration" and "Sleep quality" chips that open the sub-metrics. Key metrics: score, duration, quality, schedule, REM, deep, efficiency [Seen].
- **Readiness detail:** "details on what impacted your readiness score" and trend tabs [Seen]. On devices it also gives a personalised activity goal for the day [Seen].
- **Health:** Vitals, then Focus areas (Heart; Metabolic = weight, body fat, glucose; Nutrition = hydration, calorie target, calories in, energy burned, macros; Cycle; Mental wellbeing), then Personal info → Goals [Seen].
- **Phone-only users** see the same Today and Health structure without the Fitness and Sleep tabs [Seen].

### 3.3 Metric definitions
**Readiness**
- "a number on a 100-point scale". Bands: **Low 1–29, Moderate 30–64, High 65–100** [Seen].
- Inputs: HRV, RHR, and sleep "over the past week". Activity was **removed** and replaced by RHR, so the score is "not based on what you did yesterday, but how your body responds to it" [Seen].
- Needs **7 nights** for a baseline (a month for good accuracy) and at least **3 h** of sleep [Seen].
- Calculated "approximately within 20 seconds of getting out of bed" [Seen].
- Weights are **[Unknown]**.

**Sleep Score (2026)**
- Inputs: sleep duration, time to sound sleep, sound sleep, restlessness, full awakenings, interruptions [Seen].
- Wake periods **over 5 min** count as awakenings; shorter ones count as "restlessness" [Seen].
- "Zero [awakenings] is ideal, but fewer than two is considered good" [Seen].
- Each night is compared with targets for age, gender and time in bed [Seen].
- Bands: **Excellent 90–100, Good 80–89, Fair 60–79, Poor <60**, and "Most users see an average... between 72 and 83" [Seen].
- Copy line worth noting: "Always trust your body first" [Seen].
- Edited sleep logs trigger a recalculation [Seen].
- Legacy split of duration 50 / quality 25 / restoration 25 comes from community claims only, so it is **[Unknown]** (WS).

**Active Zone Minutes**
- 1 minute in the moderate zone = 1 AZM. 1 minute in vigorous or peak = **2 AZM** [Seen].
- Default goal **150 per week**, which works out to about 22 per day (AHA) [Seen].
- Without HR, "active minutes" need **at least 3 METs for 10 or more continuous minutes**. That goal defaults to 30 minutes a day [Seen].

**Nutrition and water defaults** [Seen]
- Protein 1.2–1.4 g/kg. Fat 20–35% of calories, carbs make up the rest.
- Water 3.7 L (men) and 2.7 L (women), with a warning that these are "general guidelines".

### 3.4 Phone-only handling (the case closest to Pulse)
- The app falls back to **two tabs**. Readiness and Sleep Score are simply not available: readiness needs a "compatible device", and the sleep score needs "sleep stages" [Seen].
- Phone steps feed distance (from stride length) and calories (from BMR) [Seen].
- **Lesson [Inferred]:** Fitbit hides scores rather than faking them. Pulse should compute a readiness score, but label it a heuristic and show which inputs were used.

### 3.5 Motivation
- Badges look removed (redirect plus secondary press reports).
- Celebrations remain as device vibration at the goal [Seen] and "notifications that... celebrate your achievements" (Play listing) [Seen].
- Weekly leaderboards for Steps and Cardio load [Seen].
- How the in-app goal celebration looks is **[Unknown]**.

---

## 4. Adaptation for Pulse

### 4.1 Pattern map
| Pattern | Source | How Pulse adapts it (original design) | Data we actually have (phone-only) |
|---|---|---|---|
| Hero scores | WHOOP dials, Fitbit focus metrics | One card with three segmented arcs: **Sleep · Readiness · Move**. Tapping an arc opens its detail. An optional fourth chip shows **Spend left today** | HC sleep sessions, HC steps, manual entries, SMS spend |
| Customisable tiles | Both | A 2-column tile grid under the hero: water, weight/BMI, food kcal, brisk minutes, spend. Edit mode for show/hide and drag order; the order is stored locally | Manual and HC |
| Contributors list | Both | Each score's detail shows 3–4 rows with a value, our own band chip, and a single sentence. Example: "Bedtime varied ±40 min this week" | Computed |
| Calibration state | Both | Below thresholds, show "Learning your rhythm · 3/7 nights" with an empty ring, not a number | Count of nights |
| Dynamic sleep need | WHOOP | Need = goal + a share of recent debt (§4.2). Show "Aim for bed by 23:10" from need and usual wake time | HC sleep, user goal |
| Sleep quality without stages | Fitbit, WHOOP | Pulse "Sleep" score = sufficiency 70% + consistency 30%. Add efficiency only when HC gives awake segments. Stages are shown only if HC has them | HC SleepSessionRecord (stages optional) |
| Heart-rate minutes, no HR | Fitbit AZM | **Brisk minutes**: minutes at ≥100 steps/min (cadence heuristic, about 3 METs; Tudor-Locke et al. cadence studies, verify before shipping). Weekly target 150, catch-up allowed | HC StepsRecord intervals (needs per-minute granularity, else hide) |
| Weekly target with catch-up | Fitbit cardio ring, WHOOP plan | A weekly ring for brisk minutes and a weekly spend budget. "Behind by 40 min, 3 days left" | Steps, SMS spend |
| Weekly plan | WHOOP | Pick 3–5 goals (sleep, steps, water, budget, no-delivery days). Progress = equal-weight mean. Friday nudge, Monday recap card | All |
| Morning journal | WHOOP | 3–6 yes/no chips on the first open after waking (alcohol, late meal, screen in bed, ate out, impulse buy). Insight after ≥5 yes and ≥5 no in 90 days: a difference in mean sleep minutes or readiness, worded "linked with", with n shown | Manual, plus SMS-derived "ate out / food delivery" as auto-yes (original) |
| Health × money insight | Original | Same journal engine, correlating spend categories with sleep and steps. Example: "Late-night delivery days: −35 min sleep (n=12)" | SMS and HC |
| Edit + recalc | Both | Editable bed and wake times. The score recomputes and shows an "edited" tag | Manual |
| Source priority | Fitbit | De-dup: manual > HC > estimate. `source` field already exists | DB |
| Quick log | Fitbit hydration | Water chips for 150 / 250 / 500 ml (already built). Long-press for a custom amount | Manual |
| Streak | WHOOP | "n days logged" by the avatar, counting any health or money log. No badge catalogue | DB |
| Trend tabs | Both | W / M / 6M segmented control on every detail screen. 7-day average line over daily bars | DB |

### 4.2 Proposed phone-only readiness score (heuristic, not a medical measure)
Label in UI: **"Readiness (estimate from sleep and steps)"**. Inputs shown on the detail screen.

```
Inputs (Health Connect or manual):
  slept   = minutes asleep in last night's main sleep (the session you woke from today)
  goal    = user's sleep goal, default 480 min
  bed_i, wake_i = bed and wake times of the last 7 main sleeps (bed measured from 18:00 so midnight doesn't wrap)
  steps_y = yesterday's steps; avg14 = mean daily steps over the 14 days before yesterday
  rhr     = today's resting HR (optional, only if HC has RestingHeartRateRecord); rhr14 = median of last 14 values

Sleep need
  debt3 = Σ over the 3 nights before last night of max(0, goal − slept_n)
  need  = goal + min(60, debt3 / 3)        # debt adds at most 1 h
  # deliberately no step-based top-up: load is already scored in L (avoids double-counting)

Components (each clamped to 0–100)
  S  Sleep sufficiency = 100 × slept / need
  C  Regularity        = 100 × (90 − σ) / 75,  σ = mean(SD(bed_i), SD(wake_i)) in minutes
                         (σ ≤ 15 → 100, σ ≥ 90 → 0; needs ≥ 3 nights, else C is missing)
  L  Load balance      = r = steps_y / avg14;  r ≤ 1.2 → 100;  r ≥ 2.5 → 0;  linear: 100 × (2.5 − r) / 1.3
                         (needs ≥ 7 days in avg14 and avg14 ≥ 1000, else L is missing)
  R  Resting HR        = Δ = rhr − rhr14;  Δ ≤ 0 → 100;  Δ ≥ 7 bpm → 0;  linear: 100 × (7 − Δ) / 7
                         (needs ≥ 7 values; else R is missing)

Weights
  without RHR: S 0.60, C 0.25, L 0.15
  with RHR:    S 0.45, C 0.20, L 0.15, R 0.20
  Score = round( Σ wᵢ·Xᵢ / Σ wᵢ ) over the components that are present
  Score = null if S is missing (no main sleep for last night) → show "Log last night's sleep"
```
**Bands (Pulse's own, not WHOOP's 67/34 or Fitbit's 65/30):** **70–100 "Ready"**, **40–69 "Steady"**, **0–39 "Go easy"**. Show the label and an icon, not colour alone.
**Worked example:**
- Inputs: goal 480; the 3 nights before slept 420, 450, 480; σ = 25 min; steps ratio 1.5; no RHR.
- Debt = 90 → need = 510. Sleeping 450 gives S = 88.2. C = 86.7. L = 76.9.
- Score = 0.60·88.2 + 0.25·86.7 + 0.15·76.9 = **86 → Ready**.

**Differences from the current `docs/HEALTH.md`:**
- Sleep is now measured against **need** (with debt), not against the goal.
- Regularity uses bed **and** wake time with a 15-minute grace.
- An optional RHR component is added.
- **The bands change from ≥67/34–66/<34**, which are WHOOP's exact cut-offs.

The owner of `HEALTH.md`, `recovery.ts` and the CHANGELOG should decide whether to adopt this. The teardown does not change them.

### 4.3 What we cannot do phone-only (be honest in the UI)
- No HRV and no sleep stages unless another app writes them to HC.
- No HR zones, no strain-style load, and no illness signals (skin temperature, respiratory rate).
- Hide those tiles rather than showing zeros, which is the same thing Fitbit does for phone-only users.

---

## 5. Things NOT to copy
- **Names:** WHOOP, Fitbit, Google Health, Recovery (as a scored product), Strain, Sleep Performance, Sleep Planner, Behaviour Insights/Impacts, Month in Review, WHOOP Age, Pace of Aging, Healthspan, "My Day / My Plan / My Dashboard", Active Zone Minutes, Zone Minutes, Cardio Load, Daily Readiness Score, Sound sleep, Resilience score.
  - Use generic words instead: Readiness (estimate), Sleep, Move, Brisk minutes, Weekly plan, Journal, Insights.
- **Scales and cut-offs:** do not use the 0–21 logarithmic scale or the green/yellow/red recovery scheme with 67/34/33 thresholds (WHOOP's signature). Do not reuse Fitbit's readiness bands 65/30 or its sleep bands with the "72–83" average claim.
- **Visuals:** WHOOP's three-dial art, dial ordering and black/neon look. Fitbit and Google Health icons, tile shapes, ring styles and animations. Any logos, fonts, screenshots or illustrations. No assets were saved into the project.
- **Copy:** do not reuse their help text or in-app phrases ("primed", "All Out", "Always trust your body first"). Write our own microcopy.
- **Claims:** do not imply illness prediction, medical accuracy, or "ML-driven" insights. Pulse insights are simple mean differences with n shown, labelled "linked with", not "caused by".
- **Business patterns:** paywalled insights and an AI-coach persona are out of scope for Pulse (local-only, no server).

---

## 6. Sources and tools

REA = `rea capture-browser-scenario` 6.9.0, launch mode, Chrome 157 (Playwright), accessibility/DOM/screenshot captures. Evidence bundles are in the session scratchpad `rea-teardown\` (not in the project).

| Source | Used for | Tool |
|---|---|---|
| https://support.whoop.com/s/article/WHOOP-Recovery | Recovery bands, inputs, HRV baseline | REA (accessibility) |
| https://support.whoop.com/s/article/WHOOP-Sleep | Sleep Performance factors and thresholds, sleep need, naps, debt | REA |
| https://support.whoop.com/s/article/WHOOP-Strain | 0–21 bands, logarithmic, cardio and muscular load, optimal target | REA |
| https://support.whoop.com/s/article/WHOOP-Cycles | Sleep-to-sleep cycle, naps, merge sleep, manual sleep add | REA |
| https://support.whoop.com/s/article/Weekly-Plan | Plan goals, equal-weight progress, Friday and Monday cadence | REA |
| https://support.whoop.com/s/article/Heart-Rate-Variability-HRV-Insights-WHOOP-Metrics | rMSSD during sleep, trend messaging | REA |
| https://support.whoop.com/s/article/Navigating-the-WHOOP-Mobile-App | Home layout, My Day / Plan / Dashboard, streak, trends | REA (+ viewport screenshot) |
| https://support.whoop.com/s/article/WHOOP-Journal-Overview | Journal flow, dates, search, 10-in-30 rule | REA |
| https://support.whoop.com/s/article/Recovery-Insights | 5 yes + 5 no in 90 days, impact scale | REA |
| https://support.whoop.com/s/article/Calibration-Timeline | Dial positions, calibration counts | REA |
| https://support.whoop.com/s/article/Apple-Health-Integration | Import and export, override rule | REA |
| https://play.google.com/store/apps/details?id=com.whoop.android | Recovery 1–99%, wearable required, 160+ behaviours | REA (retry; first run timed out) |
| https://support.google.com/googlehealth/answer/14236513 | Sleep Score (2026) components and bands | REA (accessibility + DOM) |
| https://support.google.com/googlehealth/answer/14236710 | Readiness inputs, bands, 7 nights, activity removed | REA (accessibility + DOM) |
| https://support.google.com/googlehealth/answer/14236509 | AZM rules, 150/week, active minutes METs | REA (DOM) |
| https://support.google.com/googlehealth/answer/14236404 | Phone-only step tracking | REA (DOM) |
| https://support.google.com/googlehealth/answer/14237011 | Tabs, Today customisation, Health tab | REA (DOM) |
| https://support.google.com/googlehealth/answer/14506680 | Health Connect sync | REA (DOM) |
| https://support.google.com/fitbit/answer/14236524 → redirected to googlehealth/answer/14237026 | Badges gone (redirect), friends and leaderboards | REA (DOM) |
| https://support.google.com/googlehealth/answer/14237210 | Nutrition, hydration defaults, source priority | REA (DOM) |
| https://support.google.com/googlehealth/answer/14236914 | 10k steps default, device celebration, weekly cardio ring | REA (DOM) |
| https://support.google.com/product-documentation/answer/17081467 | Feature map, phone-only vs device tabs | REA (DOM) |
| https://play.google.com/store/apps/details?id=com.fitbit.FitbitMobile | "Fitbit App is now Google Health", celebrations | REA (accessibility) |
| https://www.fitbit.com/global/us/technology/daily-readiness-score | Redirects to store.google.com, no content | REA |
| https://www.whoop.com/thelocker/how-does-whoop-recovery-work-101/ and …/how-does-whoop-strain-work-101/ | **Blocked** (Cloudflare "you have been blocked") | REA failed. WebFetch: HTTP 403 |
| https://www.whoop.com/thelocker/the-all-new-whoop-home-screen | Three dials, trend comparison | Fallback: WebSearch snippets only |
| https://www.whoop.com/thelocker/a-new-way-to-see-insights-on-which-behaviors-affect-your-recovery/ | Insights framing as associations | Fallback: WebSearch snippets only |
| community.fitbit.com, androidauthority.com, 9to5google.com (search results) | Legacy sleep-score split, badge removal | Fallback: WebSearch (secondary, low confidence) |

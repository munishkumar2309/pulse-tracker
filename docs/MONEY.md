# Money

Files: `src/money/smsParser.ts`, `categorize.ts`, `ingest.ts`, `insights.ts`, `forecast.ts`, `src/data/categories.ts`, `src/screens/Money.tsx`.

## Pipeline
```
SMS text ──parseSms()──► ParsedSms | {rejected}
          ──categorize(parsed, rules)──► {category, excluded}
          ──txnId()──► dedupe against DB ──► db.transactions
```
Input sources:
- **Android:** automatic (`src/native/sms.ts`). The first run reads 90 days of inbox, then new SMS on every open/resume, plus a live listener while the app is open. Only commercial sender IDs are parsed.
- **Browser:** the paste box ("Add bank SMS").
- **Statements:** see below.

## SMS parser (`smsParser.ts`)
Order of checks:
1. **Rejections:** OTP, then reminder/future/request, then failed/declined, then promo, then fund-house/broker confirmations, then no debit/credit verb, then no amount. A confirmation (folio, NAV, units allotted, contract note, order executed) is rejected only when it has **no a/c or card number**. It repeats money the bank SMS already recorded, while a bank's "debited from A/c XX1234 for SIP Folio …" still parses.
2. **Type:** the earliest debit verb vs the earliest credit verb. "debited … SWIGGY credited" is therefore a debit.
3. **Amount:** the first `Rs/INR/₹` amount *not* preceded by "bal/limit/avl/available/outstanding". "debited by 500.0" (SBI, no currency) is handled.
4. **Account:** last 3–4 digits after `a/c|ac|acct|account|card`. `accountKind` is card if the text mentions a credit card or a card (debit card counts as bank).
5. **Merchant:** patterns in order (ICICI `; X credited`, SBI `trf to X`, `at X`, ICICI CC `on X. Avl`, Axis CC `HH:MM:SS IST X Avl`), then `to`/`from` (debits try `to` first, credits `from` first), then `Info:`. Every regex match is tried until one passes `NOT_MERCHANT`. Names are cleaned: UPI path segments are split, a VPA becomes its handle, and display case is applied (`SWIGGY` → `Swiggy`; vowel-less acronyms such as KFC and IRCTC stay upper case).
6. **Date** from the body (yyyy-mm-dd, dd-Mon-yy, ddMonyy, dd/mm/yy), otherwise the received time.
7. **Bank:** sender ID first, else the earliest bank name in the body. UPI IDs (`x@hdfcbank`) are ignored.
8. **Card bill payment** ("payment … received towards your … card") sets `isCardBillPayment`, and the merchant becomes "Card bill payment".

Formats covered by tests: HDFC UPI and card, ICICI UPI and card, SBI UPI and SBI Card, Axis card, Kotak UPI, NEFT salary, UPI refund, ATM. **Add the user's real SMS to `REAL_SAMPLES` in `smsParser.test.ts`** whenever a format fails.

**Dedupe id** (`txnId`): the bank ref if present, else amount|type|account|date|merchantKey.

## Categories (`data/categories.ts`)
Food Delivery, Food & Dining, Groceries, Transport, Fuel, Shopping, Bills & Utilities, Rent, EMI & Loans, Investments, Health, Entertainment, Subscriptions, Travel, Education, Cash, **Transfers** (excluded from spend), **Income** (credits), Other.

`categorize()` order:
1. A user rule (`rules` table, created when "Use this for every payment to X" is ticked).
2. A card bill payment goes to Transfers.
3. A credit goes to Income, unless its keywords say Transfers.
4. An ATM withdrawal goes to Cash.
5. Keywords on the merchant, then keywords on the raw SMS.
6. Anything else goes to Other.

Keywords match on word boundaries, so "ola" does not match "coca cola" and "mart" does not match "smartbuy".

**Auto re-categorising (`recategorizeOther` + `ingest.autoCategorizeOther`):** each time the Money screen opens, saved rows still in Other are run through `categorize()` again with the current keywords and rules, so improving the keyword list or adding a rule fixes old rows too. Rows with `userSet` (a category picked by hand in the editor or the Add expense form) are never touched. Income keywords never apply to debits.

**Investments** (`matchFirst`, so it is tried before every other category; the rest keep list order) cover:
- **Platforms and brokers:** Zerodha, Groww, Upstox and others.
- **Stocks:** NSE/BSE, ICCL / Indian Clearing Corp, NSCCL, CDSL/NSDL.
- **Mutual funds and SIPs:** mutual fund/MF, SIP, BSE StAR MF, CAMS, KFintech, fund-house names.
- **Deposits and small savings:** FD / fixed / term deposit, recurring deposit, NPS, PPF, Sukanya, NSC, KVP.
- **Gold:** digital gold, SafeGold, Augmont, MMTC, SGB / gold bond, gold ETF, jewellers such as Tanishq.

`matchFirst` means an SIP by NACH/ECS ("NACH-DR HDFC MUTUAL FUND") and "Bajaj Finance FD" are Investments, while a plain "Bajaj Finance" or "NACH HOME LOAN EMI" stays EMI & Loans. **Investments are not counted as spend** (`isSpend` skips them). They are totalled separately as `invested` and shown as "Invested ₹X" on the Money summary; budgets can't be set on them. Redemptions, dividends and FD interest are credits, so they go to Income. "amc" and a bare "gold" are deliberately *not* keywords: AMC also means a debit card's annual maintenance charge, and "gold" would catch places like Gold's Gym.

## Insights (`insights.ts`)
Spend means a debit that is not excluded.
- `monthSummary(txns, month, uptoDay?)`: spend, income, invested, last month's full total (`prevSpend`) and the % change. For the month in progress the screen passes today's day, so the change is **like-for-like**: days 1..today of this month against the same days of last month (`prevSameSpend`). A half-finished month is never set against a full one.
- `compareMonths(txns, month, uptoDay?)`: per category, this month vs last month (like-for-like as above): `now`, `prev`, `delta`, `pct` (null when new), biggest change first. Drives the "Compared with <month>" card: total difference, biggest rise, and the category with the largest share.
- `monthlyHistory(txns, month, n)`: spend, invested and top category for each of the last n months (the Month range list under the bar chart; tap a month to open it).
- `byCategory`, `topMerchants`, `dailySpend` (zero-filled), `splitByAccountKind`.
- `habits`: weekday vs weekend average per day, late-night (22:00–03:00) count and amount, food-delivery count.
- `recurring`: same merchant in 2 or more months, amounts within ±15%, gaps of 25–35 days. The next date is the same day next month.
- `categoryShifts`: this month vs the average of the previous 3 months. Shown when the move is at least 25% and at least ₹500, and only once some earlier-month data exists.
- `budgetStatus`: `over` at 100% or more; `ahead` when the % used exceeds the % of the month gone by more than 10 points.

## Forecasts (`forecast.ts`, UI: Money → Forecast tab, `components/MoneyForecast.tsx`)
All forecasts run on the phone from the user's own transactions and are labelled as estimates. History = complete months only (up to 12). The first month is dropped when it starts after the 5th, because the 90-day SMS backfill would make it look cheap.

| Question | Method | Why this one |
|---|---|---|
| Spend in the next 3 months | `holtDamped`: Holt's linear exponential smoothing with a **damped trend**. α (level), β (trend) and φ (damping) are picked per series from a small grid by one-step-ahead squared error. 80% band = ±1.28 × RMSE × √h. Under 3 months: the mean, with a wide band. | Typical history is 3–12 monthly points. That is far too few for ARIMA, Prophet, gradient boosting or neural nets, which overfit or can't be fitted. Damped-trend smoothing is a long-standing strong benchmark on short business series (M3/M4 forecasting competitions). It weights recent months more and doesn't let a trend run away. It is interpretable, needs no training server, and runs instantly in the app. Seasonality (e.g. Diwali) needs 2+ years of data and is not modelled. |
| Where this month is heading | `projectCategories` / `projectTotal`: per category. **Lumpy** categories (≤ 2 payments in a usual month: rent, EMI, fuel) = max(spent so far, usual), so a rent paid on the 2nd isn't extrapolated. Everyday categories: `projectMonth` = so far + remaining days × (w × this month's daily rate + (1 − w) × usual daily rate), w = day / days in month. | A shrinkage blend: early in the month the usual pattern dominates; late in the month the actual pace does. Avoids the "day-3 panic" of naive pace × days. |
| Income ("future earning") | `forecastIncome`: regular sources = same payer with credits in ≥ 2 of the last 3 complete months, each within ±25% of the median (salary), counted at their median, next date = last + 1 month. Other credits = median monthly amount. Band: regular only … regular + the largest other month. | Salary is a fixed, repeating amount, so a trend model would wrongly extrapolate one-off bonuses or refunds. The median ignores outliers. |
| Where you're spending extra | `spendingExtra`: projected category month vs its **median** month (last 6). Flagged when extra ≥ ₹500 **and** ≥ 20% of usual (any amount for a new category) **and**, with 3+ months, extra > 1.5 × robust σ (σ = 1.4826 × MAD). The top 2 merchants by rise vs their average month are named. | A robust z-score (median/MAD) isn't distorted by one big past month, and the ₹500/20% floors stop noise from small categories. |

Investments, transfers and card bill payments are excluded throughout, as in `isSpend`. Tests: `forecast.test.ts`.

## Statement import
Files: `statementFiles.ts` (file → `string[][]`), `statementImport.ts` (pure: rows → `StatementTxn[]`, tested), `ingest.ts` (`ingestStatement`), and the UI in `Money.tsx` (`StatementImport`).

- **Reading:** CSV via papaparse; XLSX/XLS via SheetJS 0.20.3 from the official CDN tarball (the npm-registry `xlsx` is outdated and vulnerable); PDF via pdfjs-dist. All three load only when needed (dynamic import).
- **PDF:** text items are grouped into lines (y within 3pt) and the header line is found (date + description words). Each item goes to the nearest header column centre. Lines with no date carry on the previous narration. A repeated header on a new page is skipped. A locked PDF raises `PdfPasswordError`, and the UI asks for the password.
- **`detectColumns`:** scans the first 40 rows for a date + narration header. Supports separate Withdrawal/Deposit columns (HDFC, ICICI) or a single Amount + Dr/Cr column (SBI style).
- **Parsing:** dates are day-first (dd/mm/yy, dd-Mon-yyyy, yyyy-mm-dd, Excel serial). Amounts handle Indian grouping, ₹, Dr/Cr suffixes and (negatives).
- **Merchant from narration:** split on `/ - | : *`, drop rails, IFSCs, masked numbers and refs, and take the first real name. HDFC `ATW-`, `NWD-` and `ATM WDL` become ATM Withdrawal.
- **Dedupe vs SMS:** (1) the same 12-digit UPI ref gives the same `txnId`; (2) otherwise the same amount and type within ±1 day, with each existing row matched at most once; (3) identical rows inside one statement (two ₹20 chais) are kept, using `_n` id suffixes.
- **Not done yet:** a manual column-mapping UI for unrecognised layouts, and remembering a mapping per bank. Test on the user's real statements and add fixtures.

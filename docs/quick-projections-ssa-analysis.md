# Quick Projections SSA Income — Scenario Analysis

Analysis of how SSA income is determined in Quick Analysis / Quick Summary across three entry paths. **No code changes** — identification of discrepancies only.

---

## 1. Entry paths

| Scenario | How user gets to Quick Summary | What runs the projection |
|----------|--------------------------------|---------------------------|
| **A. Plan saved from assumptions** | Dashboard → “How much do I need?” calculator → “Save as Plan” → redirect to `/plans/{id}?tab=quick-analysis` | `loadAndCalculateSnapshot()` (after `checkExistingData` finds scenario + settings) |
| **B. Plan Inputs form saved** | Already on plan → Quick Start / Plan Inputs form → “Save & See My Retirement Snapshot” | `handleQuickStartCalculate()` (in-memory projection right after save) |
| **C. Loaded from existing plans table** | Dashboard → click “Open” on a plan → `/plans/{id}?tab=quick-analysis` | `loadAndCalculateSnapshot()` (same as A) |

---

## 2. Where SSA income is set

All paths ultimately call `calculateRetirementProjections()` in `lib/utils/retirement-projections.ts`. SSA in the projection depends on:

1. **SSA start age** (`settings.ssa_start_age`) — when SSA income begins (no payment before this age).
2. **Base SSA at start age** — planner and spouse amounts used as “base at start age” for the projection (then early-claim multiplier and inflation from start year are applied in the engine).

So the only inputs that can differ by path are:

- **`ssa_start_age`** (and thus *when* SSA starts).
- **`estimatedPlannerSsaAtStartAge` / `estimatedSpouseSsaAtStartAge`** (and thus *how much* SSA is).

---

## 3. Discrepancy 1 — Base SSA amount (planner / spouse)

### Path A (plan saved from assumptions) and Path C (loaded from table)

- **Flow:** `loadAndCalculateSnapshot()` in `snapshot-tab.tsx`.
- **SSA base:** Uses `inputs.estimatedAnnualIncome` to compute:
  - `baseEstimatedPlannerSsa = calculateEstimatedSSA(inputs.estimatedAnnualIncome, true)`
  - `baseEstimatedSpouseSsa = calculateEstimatedSSA(inputs.estimatedAnnualIncome, false)`
- **`inputs.estimatedAnnualIncome`:**  
  - First time the tab runs (e.g. after “Save as Plan” or after opening from dashboard), `inputs` is still initial state: **`estimatedAnnualIncome: 0`**.  
  - After loading, `setInputs(..., estimatedAnnualIncome: 0)` is called (value is not stored in DB).  
  - So for both A and C we always use **`estimatedAnnualIncome === 0`** for this load path.
- **Effect of `calculateEstimatedSSA(0, …)`:** In `retirement-projections.ts`, `annualIncome <= 0` returns **$20,000** (planner) and **$15,000** (spouse) — same as `SSA_DEFAULT_PLANNER_BENEFIT` / `SSA_DEFAULT_SPOUSE_BENEFIT`.
- **Inflation to SSA start:** Snapshot tab then does:
  - `inflationToSsaStart = (1 + inflation_rate)^yearsToSsaStart`
  - `estimatedPlannerSsaAtStart = baseEstimatedPlannerSsa * inflationToSsaStart`
  - `estimatedSpouseSsaAtStart = baseEstimatedSpouseSsa * inflationToSsaStart`
- **Passed into projection:**  
  `calculateRetirementProjections(..., estimatedPlannerSsaAtStart, estimatedSpouseSsaAtStart)`  
  So the **base at start age** used by the engine is **$20k / $15k grown by inflation from “today” to SSA start year** (e.g. for 10 years to start: ~20k×1.03^10, ~15k×1.03^10).

**Result for A & C:** SSA income in quick projections uses **inflated** base amounts at start age (higher than $20k/$15k in today’s dollars).

---

### Path B (Plan Inputs form saved)

- **Flow:** `handleQuickStartCalculate()` in `snapshot-tab.tsx`.
- **Call:**  
  `calculateRetirementProjections(birthYear, accounts, expenses, [], settings, planLifeExpectancy, undefined, undefined, includePlannerSsa, includeSpouseSsa)`  
  **No 9th/10th arguments** — so `estimatedPlannerSsaAtStartAge` and `estimatedSpouseSsaAtStartAge` are **undefined**.
- **Inside projection:**  
  - `baseSsaAtStartAge = estimatedPlannerSsaAtStartAge || SSA_DEFAULT_PLANNER_BENEFIT` → **$20,000**  
  - `baseSpouseSsaAtStartAge = estimatedSpouseSsaAtStartAge || SSA_DEFAULT_SPOUSE_BENEFIT` → **$15,000**  
  The engine then applies `ssaClaimingMultiplier` and inflation **from SSA start year** only. It does **not** apply inflation from “today” to SSA start.

**Result for B:** SSA income uses a **flat $20k / $15k** (in start-year dollars) as the base at start age — no pre–start-age inflation.

---

### Summary of discrepancy 1

| Path | Base planner SSA at start age | Base spouse SSA at start age |
|------|-------------------------------|-------------------------------|
| A (saved from assumptions) | $20,000 × (1 + inflation)^yearsToSsaStart | $15,000 × (1 + inflation)^yearsToSsaStart |
| C (loaded from table)     | Same as A                     | Same as A                     |
| B (Plan Inputs form save) | $20,000 (no inflation to start) | $15,000 (no inflation to start) |

So **quick projections show higher SSA for A and C than for B** whenever there are years between “today” and SSA start (e.g. 10 years → ~34% higher base at start for A/C vs B).

---

## 4. Discrepancy 2 — SSA start age

When SSA **starts** (and thus in which years income appears) can also differ by how the plan was last saved.

### Path A (plan saved from assumptions)

- **Source:** Calculator “Save as Plan” inserts `rp_calculator_settings` with **`ssa_start_age: assumptions.ssaStartAge`** (from calculator UI; min 62).
- **Stored in DB:** User’s chosen SSA start age (e.g. 62, 65, 67).
- **When loading:** `buildCalculatorSettings(settingsData.data, ...)` uses **`settingsData.ssa_start_age`** → same value.

### Path B (Plan Inputs form saved)

- **Source:** `handleQuickStartCalculate()` sets  
  **`ssaStartAge = Math.max(inputs.retirementAge, SSA_EARLIEST_ELIGIBILITY_AGE)`** (62) and writes it to `rp_calculator_settings`.
- **Stored in DB:** `max(retirement age, 62)` (e.g. retire 60 → 62, retire 65 → 65).
- **In-memory run:** Same `ssaStartAge` is put on `settings.ssa_start_age` for the immediate projection.

So for B, **SSA start age is always ≥ 62** and is tied to retirement age in the Quick Start form.

### Path C (loaded from table)

- **Source:** Plan and scenario were previously saved by either A or B (or another flow that writes `rp_calculator_settings`).
- **Stored in DB:** Whatever was last written: from calculator (A) or from Quick Start (B).
- **When loading:** Again `buildCalculatorSettings(settingsData.data, ...)` → **`settingsData.ssa_start_age`**.

So **SSA start age is consistent with whatever is in the DB** for that scenario. The only behavioral difference is:

- If the user **only** ever used “Save as Plan” (A), `ssa_start_age` can be 62–70 (or whatever the calculator allows).
- If they later use “Save & See My Retirement Snapshot” (B), **B overwrites** `ssa_start_age` with `max(retirementAge, 62)`. So the same plan can show different SSA start ages (and thus different “first year of SSA”) depending on whether the last save was from A or B.

---

## 5. Discrepancy 3 — `estimatedAnnualIncome` never persisted

- In **loadAndCalculateSnapshot()**, SSA base is derived from **`inputs.estimatedAnnualIncome`**.
- After loading, **`setInputs(..., estimatedAnnualIncome: 0)`** is always used (comment: “Not stored in DB, user can customize”).
- So for **every** load (A and C), we use **$0** for the SSA estimate → `calculateEstimatedSSA(0)` → $20k / $15k, then inflated to start.

So:

- User cannot “save” a custom income for SSA and have it persist for the next time they open Quick Summary.
- If the UI ever allowed a non-zero **estimatedAnnualIncome** (e.g. in a custom SSA section), that value is **never** written to the DB, so it would only affect the current session and would reset to 0 on next load.

---

## 6. File reference summary

| Topic | File(s) | Relevant spots |
|-------|--------|----------------|
| Load path (A & C) | `components/retirement/tabs/snapshot-tab.tsx` | `loadAndCalculateSnapshot()`: uses `inputs.estimatedAnnualIncome` (lines ~332–333), builds `estimatedPlannerSsaAtStart` / `estimatedSpouseSsaAtStart` with inflation (lines ~335–347), passes them into `calculateRetirementProjections` (lines ~349–362). `setInputs(..., estimatedAnnualIncome: 0)` (lines ~381–389). |
| Quick Start save path (B) | `components/retirement/tabs/snapshot-tab.tsx` | `handleQuickStartCalculate()`: builds `settings` with `ssa_start_age: ssaStartAge` (lines ~957–959, ~1048–1062), calls `calculateRetirementProjections(..., includePlannerSsa, includeSpouseSsa)` **without** 9th/10th args (lines ~1072–1084). |
| SSA defaults and projection | `lib/utils/retirement-projections.ts` | `calculateEstimatedSSA(0, …)` → 20k/15k (lines ~57–61). `calculateRetirementProjections`: `baseSsaAtStartAge = estimatedPlannerSsaAtStartAge \|\| SSA_DEFAULT_PLANNER_BENEFIT` (line ~635), same for spouse (line ~662). |
| Save from assumptions | `components/retirement/retirement-calculator.tsx` | `handleSaveAsPlan()`: inserts `rp_calculator_settings` with `ssa_start_age: assumptions.ssaStartAge` (line ~377). No stored “estimated SSA income” or “estimated annual income”. |

---

## 7. Summary of discrepancies

1. **Base SSA amount (main numeric difference)**  
   - **A & C:** Base at SSA start = $20k / $15k **increased by inflation from current year to SSA start year**.  
   - **B:** Base at SSA start = **flat $20k / $15k** (no inflation to start).  
   So **quick projections show higher SSA for “saved from assumptions” and “loaded from table” than for “Plan Inputs form saved”** when there are years until SSA start.

2. **SSA start age**  
   - **A:** From calculator → `ssa_start_age` in DB can be 62–70 (or whatever the UI allows).  
   - **B:** Always `max(retirement age, 62)`; overwrites DB when user clicks “Save & See My Retirement Snapshot”.  
   - **C:** Uses whatever is in DB (last save from A or B).  
   So the **same plan** can show different SSA start ages (and different “first year of SSA”) depending on whether the last save was from the calculator or from the Plan Inputs form.

3. **Estimated annual income for SSA**  
   - Not stored anywhere.  
   - Load path always uses `estimatedAnnualIncome: 0` → $20k/$15k then inflated to start.  
   - So any custom SSA income in the UI would not persist across sessions.

---

## 8. Fixes applied (post-analysis)

The following changes were made to remove the discrepancies:

1. **Base SSA amount (Path B aligned with A & C)**  
   In `handleQuickStartCalculate`, the same SSA base and inflation-to-start logic as `loadAndCalculateSnapshot` is now used: compute `baseEstimatedPlannerSsa` / `baseEstimatedSpouseSsa` via `calculateEstimatedSSA(inputs.estimatedAnnualIncome, …)`, apply `inflationToSsaStart`, and pass `estimatedPlannerSsaAtStart` and `estimatedSpouseSsaAtStart` into `calculateRetirementProjections`. Quick Start save now shows the same SSA income as the load path.

2. **Estimated SSA income persisted**  
   - New column `rp_calculator_settings.estimated_ssa_annual_income` (numeric, default 0).  
   - Quick Start save writes `inputs.estimatedAnnualIncome` into this column.  
   - `loadAndCalculateSnapshot` reads `estimated_ssa_annual_income` and uses it for the SSA base (`estimatedIncomeForSsa`) and passes it into `setInputs` / `setSsaSettings` as `estimatedAnnualIncome`. Custom SSA income now persists across sessions.

3. **Tooltip life expectancy**  
   After Quick Start save, `setPlanDataForTooltip` now uses `planLifeExpectancy` instead of a hardcoded `90` for `life_expectancy`.

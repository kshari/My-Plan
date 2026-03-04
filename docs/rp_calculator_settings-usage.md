# How and when `rp_calculator_settings` is used

The table **`rp_calculator_settings`** stores scenario-level calculator assumptions (retirement age, growth/inflation rates, SSA, healthcare, withdrawal strategy, etc.). There is **one row per scenario** (keyed by `scenario_id`); the table also has `plan_id` for cascade/deletion by plan.

---

## Table role

- **Primary key / lookup:** `scenario_id` (one-to-one with `rp_scenarios`).
- **Also stored:** `plan_id` (links to `rp_retirement_plans`) for plan-level operations (e.g. delete all settings when a plan is deleted).
- **Typical columns (conceptually):** `scenario_id`, `plan_id`, `current_year`, `retirement_age`, `retirement_start_year`, `years_to_retirement`, `annual_retirement_expenses`, `growth_rate_before_retirement`, `growth_rate_during_retirement`, `inflation_rate`, `ssa_start_age`, `planner_ssa_income`, `spouse_ssa_income`, `planner_ssa_annual_benefit`, `spouse_ssa_annual_benefit`, `pre_medicare_annual_premium`, `post_medicare_annual_premium`, `withdrawal_strategy_type`, `withdrawal_priority`, `withdrawal_secondary_priority`, `enable_borrowing`, and other strategy-specific fields. App code uses `buildCalculatorSettings()` in `lib/utils/retirement-projections.ts` to map DB rows into the `CalculatorSettings` type used by projection logic.

---

## 1. Reads (SELECT)

| Where | When | What |
|-------|------|------|
| **`lib/utils/supabase-queries.ts`** `getCalculatorSettings(scenarioId)` | Shared helper | `select('*').eq('scenario_id', scenarioId).single()` |
| **`components/retirement/tabs/snapshot-tab.tsx`** | Check if plan has data so we can show quick summary | If user has accounts: load settings for `selectedScenarioId` (or default scenario); if settings exist, call `loadAndCalculateSnapshot()` (lines ~219, ~243). |
| **`snapshot-tab.tsx`** `loadAndCalculateSnapshot()` | Load data for Quick Analysis snapshot | Part of `Promise.all`: `select('*').eq('scenario_id', selectedScenarioId).single()` (lines ~270–272). |
| **`snapshot-tab.tsx`** `handleSavePlanInputs()` | Before update/insert | `select('growth_rate_before_retirement', 'growth_rate_during_retirement', 'ssa_start_age').eq('scenario_id', scenarioId).maybeSingle()` to preserve prior growth/SSA when saving (lines ~885–886). Then `select('id')` to decide update vs insert (lines ~976–977). |
| **`snapshot-tab.tsx`** (projections UI) | Update strategy from UI | `from('rp_calculator_settings').update({...}).eq(...)` (lines ~1423–1424). |
| **`components/retirement/tabs/details-tab.tsx`** | Load plan + scenario data for projections | `select('*').eq('scenario_id', selectedScenarioId).single()` in parallel with plan/accounts/expenses (lines ~343, 698). |
| **`details-tab.tsx`** | Save strategy / run projections | After updating strategy: `update(strategySettings)` then `select('*')` (lines ~612–621). |
| **`components/retirement/tabs/plan-details-tab.tsx`** | Load scenario variables for Plan Details | `select('*').eq('scenario_id', ...)` when loading scenario vars (lines ~230–231). |
| **`components/retirement/tabs/compounding-tab.tsx`** | Compounding assumptions | `select('retirement_age', 'growth_rate_before_retirement', 'inflation_rate').eq('scenario_id', ...)` (lines ~95–96). |
| **`components/retirement/tabs/analysis-tab.tsx`** | Load scenario + projections for analysis | `select('*').eq('scenario_id', selectedScenarioId).single()` with projection details (lines ~164, 553). |
| **`components/retirement/tabs/tax-efficiency-tab.tsx`** | Load scenario + projections | Same pattern: `select('*').eq('scenario_id', selectedScenarioId).single()` (line ~240). |
| **`components/retirement/tabs/scenario-modeling-tab.tsx`** | Load settings when a scenario is selected | `select('*').eq('scenario_id', selectedScenarioId).single()` (lines ~109–110). |
| **`components/retirement/tabs/ssa-withdrawal-analysis-tab.tsx`** | SSA/withdrawal analysis | `select('*').eq('scenario_id', ...)` (lines ~164–165). |
| **`components/retirement/scenarios-table.tsx`** | Scenario metrics (retirement age, growth, etc.) | `select('retirement_age', 'retirement_start_year', 'growth_rate_before_retirement', 'growth_rate_during_retirement').eq('scenario_id', scenario.id).maybeSingle()` (lines ~100–101). |
| **`app/apps/retirement/dashboard/page.tsx`** | Dashboard saved plans: show SSA start age | For default scenarios of plans: `select('scenario_id', 'ssa_start_age').in('scenario_id', scenarioIds)` to build `ssaStartAgeByPlanId` (lines ~37–38). |
| **`lib/utils/calculate-projections.ts`** | Server-side projection run | `select('*').eq('scenario_id', scenarioId).single()` in parallel with plan/accounts/expenses (lines ~34–35). |

---

## 2. Writes (INSERT / UPDATE / UPSERT)

| Where | When | What |
|-------|------|------|
| **`components/retirement/retirement-calculator.tsx`** `handleSaveAsPlan()` | User saves “How much do I need to retire?” as a new plan | After creating plan + scenario: **INSERT** one row into `rp_calculator_settings` with `scenario_id`, `plan_id`, retirement age, growth/inflation, SSA flags and ages, `planner_ssa_annual_benefit`, `spouse_ssa_annual_benefit`, `pre_medicare_annual_premium`, `post_medicare_annual_premium`, etc. (lines ~296–314). |
| **`components/retirement/tabs/snapshot-tab.tsx`** `handleSavePlanInputs()` | User used to save from Quick Analysis form (form removed; handler still updates DB if called) | Resolve or create default scenario; then **UPDATE** if row exists else **INSERT** (by `scenario_id`) with plan inputs (retirement age, expenses, growth, inflation, SSA, healthcare premiums, etc.) (lines ~885–999). |
| **`components/retirement/tabs/details-tab.tsx`** | User changes withdrawal strategy (e.g. from strategy UI) | **UPDATE** `rp_calculator_settings` with new strategy fields (lines ~612–614, ~1423–1424). |
| **`components/retirement/tabs/plan-details-tab.tsx`** `handleSaveScenarioVars()` | User saves “Scenario variables” in Plan Details | **UPSERT** into `rp_calculator_settings` with `onConflict: 'scenario_id'` (lines ~573–577). |

---

## 3. Deletes

| Where | When | What |
|-------|------|------|
| **`app/apps/retirement/plans/[id]/delete/route.ts`** | Plan is deleted | **DELETE** from `rp_calculator_settings` where `plan_id = planId` so all settings for that plan are removed (line ~14). |
| **`components/retirement/scenarios-table.tsx`** `handleDelete(scenarioId)` | Single scenario deleted | **DELETE** where `scenario_id = scenarioId` (line ~154). |
| **`scenarios-table.tsx`** `handleDeleteAll()` | All scenarios for plan deleted | For each scenario, **DELETE** where `scenario_id = s.id` (lines ~173–174). |

---

## 4. Flow summary

- **Create plan from calculator:** Calculator inserts plan + default scenario, then inserts one `rp_calculator_settings` row for that scenario.
- **Quick Analysis (snapshot):** Snapshot tab loads settings by `scenario_id` to run projections and show the quick summary; it no longer shows the form but still has code that can update/insert settings (e.g. if “Save plan inputs” were reconnected elsewhere).
- **Plan Details / Scenario variables:** Plan-details tab loads and upserts settings by `scenario_id` when the user saves scenario variables.
- **Details tab (projections):** Details tab loads settings by `scenario_id` to compute and save projections; it also updates settings when the user changes withdrawal strategy.
- **Other tabs (compounding, analysis, tax-efficiency, scenario-modeling, SSA-withdrawal):** All load settings by `scenario_id` for their respective views.
- **Dashboard:** Reads `ssa_start_age` for default scenarios to display in the saved-plans list.
- **Scenario list:** Reads settings for metrics; deletes settings when a scenario (or all scenarios) is deleted.
- **Plan delete API:** Deletes all settings for the plan by `plan_id`.

So: **`rp_calculator_settings` is used whenever the app needs scenario-level assumptions (for display, for running projections, or for saving user edits), and it is written when creating a plan from the calculator, saving scenario variables, or updating strategy, and deleted when a plan or scenario is removed.**

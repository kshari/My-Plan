# Settings Storage for Snapshot and Advanced Projections

## Database Table

**Table**: `rp_calculator_settings`
**Primary Key**: `scenario_id` (links to `rp_scenarios` table)
**Foreign Key**: `plan_id` (links to `rp_retirement_plans` table)

## Settings Storage - Snapshot Tab

### 1. Save Location
- **File**: `components/retirement/tabs/snapshot-tab.tsx`
- **Function**: `handleQuickStartCalculate()` (lines 673-949)
- **Lines**: 769-822

### 2. Scenario ID Resolution
- **Lines**: 700-729
- **Logic**:
  1. Uses `selectedScenarioId` if available
  2. If not, looks for existing default scenario (`is_default = true`)
  3. If no default exists, creates a new default scenario
  4. Sets `selectedScenarioId` to the resolved scenario ID

### 3. Settings Data Saved
```typescript
{
  plan_id: planId,
  scenario_id: scenarioId,
  retirement_age: inputs.retirementAge,
  retirement_start_year: currentYear + yearsToRetirement,
  years_to_retirement: yearsToRetirement,
  annual_retirement_expenses: retirementStartExpenses, // Inflated to retirement start
  growth_rate_before_retirement: growthRate,
  growth_rate_during_retirement: growthRate * 0.7,
  capital_gains_tax_rate: 0.2,
  income_tax_rate_retirement: 0.25,
  inflation_rate: 0.04,
  planner_ssa_income: true,
  spouse_ssa_income: inputs.ssaForTwo,
  ssa_start_age: 62,
  withdrawal_strategy_type: 'goal_based',
  withdrawal_priority: 'default',
  withdrawal_secondary_priority: 'tax_optimization',
  enable_borrowing: false
}
```

### 4. Save Operation
- **Lines**: 791-822
- **Method**: 
  - Checks if settings exist for `scenario_id`
  - If exists: **UPDATE** `rp_calculator_settings` WHERE `scenario_id = scenarioId`
  - If not exists: **INSERT** into `rp_calculator_settings`

### 5. Load Location
- **File**: `components/retirement/tabs/snapshot-tab.tsx`
- **Function**: `loadAndCalculateSnapshot()` (lines 217-348)
- **Lines**: 228-231
```typescript
supabase.from('rp_calculator_settings')
  .select('*')
  .eq('scenario_id', selectedScenarioId)
  .single()
```

### 6. Additional Load Points
- **Line 177-180**: Loads settings when checking existing data
- **Line 201-204**: Loads settings for default scenario
- **Line 1244**: Loads settings when SSA settings are updated

## Settings Storage - Advanced Projections (Details Tab)

### 1. Save Location - Scenario Variables
- **File**: `components/retirement/tabs/plan-details-tab.tsx`
- **Function**: `handleSaveScenarioVars()` (lines 457-564)
- **Lines**: 510-547

### 2. Settings Data Saved (Scenario Variables)
```typescript
{
  plan_id: planId,
  scenario_id: targetScenarioId,
  current_year: currentYear,
  retirement_age: scenarioVars.retirement_age,
  retirement_start_year: retirementStartYear,
  years_to_retirement: yearsToRetirement,
  annual_retirement_expenses: annualRetirementExpenses, // Calculated from expenses
  growth_rate_before_retirement: scenarioVars.growth_rate_before_retirement / 100,
  growth_rate_during_retirement: scenarioVars.growth_rate_during_retirement / 100,
  loan_rate: 0.1, // Backward compatibility
  capital_gains_tax_rate: scenarioVars.capital_gains_tax_rate / 100,
  income_tax_rate_retirement: scenarioVars.income_tax_rate_retirement / 100,
  inflation_rate: scenarioVars.inflation_rate / 100,
  enable_borrowing: scenarioVars.enable_borrowing || false,
  ssa_start_age: scenarioVars.ssa_start_age || 62,
  planner_ssa_income: scenarioVars.planner_ssa_income !== undefined ? scenarioVars.planner_ssa_income : true,
  spouse_ssa_income: scenarioVars.spouse_ssa_income !== undefined ? scenarioVars.spouse_ssa_income : true
}
```

### 3. Save Operation (Scenario Variables)
- **Line**: 543-547
- **Method**: **UPSERT** into `rp_calculator_settings` with `onConflict: 'scenario_id'`
- **Note**: Also updates `include_spouse` in `rp_retirement_plans` if `spouse_ssa_income` is true

### 4. Save Location - Projections Calculation
- **File**: `components/retirement/tabs/details-tab.tsx`
- **Function**: `calculateAndSaveProjectionsInternal()` (lines 518-717)
- **Note**: Settings are **NOT** saved here - only projections are saved
- **Settings are loaded** from existing `rp_calculator_settings` record

### 5. Load Location
- **File**: `components/retirement/tabs/details-tab.tsx`
- **Function**: `calculateAndSaveProjectionsInternal()` (lines 518-717)
- **Lines**: 521-527
```typescript
const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
  supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy').eq('id', planId).single(),
  supabase.from('rp_accounts').select('*').eq('plan_id', planId),
  supabase.from('rp_expenses').select('*').eq('plan_id', planId),
  supabase.from('rp_other_income').select('*').eq('plan_id', planId),
  supabase.from('rp_calculator_settings').select('*').eq('scenario_id', scenarioId).single(),
])
```

### 6. Additional Load Points
- **Line 172-175**: Loads settings when loading projections
- **Line 276**: Loads settings when scenario changes
- **Line 570**: Loads settings in analysis calculations

## Settings Storage - Other Tabs

### Tax Efficiency Tab
- **File**: `components/retirement/tabs/tax-efficiency-tab.tsx`
- **Line**: 130
- **Operation**: **LOAD ONLY** - `select('*').eq('scenario_id', selectedScenarioId).single()`

### Analysis Tab
- **File**: `components/retirement/tabs/analysis-tab.tsx`
- **Lines**: 180, 570
- **Operation**: **LOAD ONLY** - `select('*').eq('scenario_id', selectedScenarioId).single()`

## Key Differences: Snapshot vs Advanced

### Snapshot Tab
1. **Creates/uses default scenario** if no scenario selected
2. **Saves settings immediately** when Quick Start form is submitted
3. **Uses simplified inputs** (current savings, annual contribution, estimated expenses)
4. **Hardcoded defaults** for many settings (growth rates, tax rates, inflation)
5. **Always uses goal_based strategy** with default priority
6. **Settings are saved BEFORE** projections are calculated

### Advanced Projections (Details Tab)
1. **Uses selected scenario** (user must select/create scenario)
2. **Settings saved separately** via "Save Scenario Variables" button
3. **Uses detailed inputs** from multiple tabs (accounts, expenses, scenario variables)
4. **User-configurable** growth rates, tax rates, inflation, withdrawal strategies
5. **Supports multiple withdrawal strategies** (goal_based, amount_based, sequence_based, etc.)
6. **Settings are loaded** when calculating projections (not saved during calculation)

## Settings Construction

### Snapshot Tab
- **File**: `components/retirement/tabs/snapshot-tab.tsx`
- **Lines**: 848-863
- **Method**: Direct construction from inputs and saved plan data
- **Uses**: `planDataForFilingStatus?.filing_status` or defaults based on `inputs.ssaForTwo`

### Advanced Projections
- **File**: `lib/utils/retirement-projections.ts`
- **Function**: `buildCalculatorSettings()` (lines 507-538)
- **Method**: Constructs from `settingsData` (database) and `planData`
- **Uses**: `planData?.include_spouse` to set filing_status, or `planData?.filing_status`

## Scenario Relationship

### Scenario Table
- **Table**: `rp_scenarios`
- **Fields**: `id`, `plan_id`, `scenario_name`, `is_default`
- **Relationship**: One scenario can have one settings record

### Settings Table
- **Table**: `rp_calculator_settings`
- **Primary Key**: `scenario_id` (one-to-one with scenarios)
- **Foreign Key**: `plan_id` (many-to-one with retirement plans)

## Settings Fields Stored

### Core Settings
- `plan_id` - Links to retirement plan
- `scenario_id` - Links to scenario (primary key)
- `current_year` - Current year for calculations
- `retirement_age` - Age at retirement
- `retirement_start_year` - Year retirement starts
- `years_to_retirement` - Years until retirement
- `annual_retirement_expenses` - Annual expenses at retirement start

### Growth & Inflation
- `growth_rate_before_retirement` - Investment growth rate before retirement (decimal)
- `growth_rate_during_retirement` - Investment growth rate during retirement (decimal)
- `inflation_rate` - Annual inflation rate (decimal)

### Tax Settings
- `capital_gains_tax_rate` - Capital gains tax rate (decimal)
- `income_tax_rate_retirement` - Income tax rate during retirement (decimal)
- Note: `filing_status` is stored in `rp_retirement_plans`, not in settings

### SSA Settings
- `planner_ssa_income` - Boolean: Include planner SSA income
- `spouse_ssa_income` - Boolean: Include spouse SSA income
- `ssa_start_age` - Age to start SSA income

### Withdrawal Strategy
- `withdrawal_strategy_type` - Type of withdrawal strategy
- `withdrawal_priority` - Primary withdrawal priority
- `withdrawal_secondary_priority` - Secondary withdrawal priority
- `fixed_percentage_rate` - For fixed percentage strategy
- `fixed_dollar_amount` - For fixed dollar strategy
- `guardrails_ceiling` - For guardrails strategy
- `guardrails_floor` - For guardrails strategy
- `bracket_topping_threshold` - For bracket-topping strategy

### Other Settings
- `enable_borrowing` - Boolean: Allow borrowing to cover shortfalls
- `loan_rate` - Interest rate for borrowing (backward compatibility)

## Important Notes

1. **Filing Status**: Stored in `rp_retirement_plans.filing_status`, NOT in `rp_calculator_settings`
2. **Scenario-Specific**: Each scenario has its own settings record
3. **Default Scenario**: Snapshot tab creates/uses a default scenario automatically
4. **Settings vs Projections**: Settings are separate from projection results (stored in `rp_projection_details`)
5. **SSA Income Flags**: Stored in settings, but `include_spouse` is stored in plan data

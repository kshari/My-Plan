# Snapshot Projections Usage of retirement-projections.ts

## Answer: YES

The snapshot projections functionality **DOES use** `retirement-projections.ts`. It uses the same core calculation engine as the advanced projections, ensuring consistency.

## Direct Usage

### 1. Imports from retirement-projections.ts
**File**: `components/retirement/tabs/snapshot-tab.tsx:6-17`
```typescript
import { 
  calculateRetirementProjections,      // Main projection calculation
  buildCalculatorSettings,              // Settings construction helper
  calculateProgressiveTax,              // Tax calculation
  calculateCapitalGainsTax,             // Capital gains tax calculation
  determineFilingStatus,                // Filing status determination
  type Account, 
  type Expense, 
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'
```

### 2. Calls to calculateRetirementProjections

#### Location 1: loadAndCalculateSnapshot()
- **File**: `components/retirement/tabs/snapshot-tab.tsx:291-302`
- **Context**: When loading existing data and calculating snapshot
- **Code**:
```typescript
const projections = calculateRetirementProjections(
  birthYear,
  accounts,
  expenses,
  otherIncome,
  settings,
  planData.data.life_expectancy || 90,
  planData.data.spouse_birth_year || undefined,
  planData.data.spouse_life_expectancy || undefined,
  includePlannerSsa,
  includeSpouseSsa
)
```

#### Location 2: handleQuickStartCalculate()
- **File**: `components/retirement/tabs/snapshot-tab.tsx:872-882`
- **Context**: When user submits Quick Start form
- **Code**:
```typescript
const projections = calculateRetirementProjections(
  birthYear,
  accounts,
  expenses,
  [],
  settings,
  90,
  undefined, // spouseBirthYear - not used in quick start
  undefined, // spouseLifeExpectancy - not used in quick start
  includePlannerSsa,
  includeSpouseSsa
)
```

### 3. Uses buildCalculatorSettings()
- **File**: `components/retirement/tabs/snapshot-tab.tsx:278-285`
- **Purpose**: Constructs CalculatorSettings object consistently
- **Code**:
```typescript
const settings = buildCalculatorSettings(
  settingsData.data,
  planData.data,
  currentYear,
  retirementAge,
  yearsToRetirement,
  annualExpenses
)
```

### 4. Uses Tax Calculation Functions
- **calculateProgressiveTax()**: Used in tax tooltip (line 2114)
- **calculateCapitalGainsTax()**: Used in tax tooltip (line 2120)
- **determineFilingStatus()**: Used in tax tooltip (line 2108)

## Additional Processing

### calculateSnapshotResults()
- **File**: `components/retirement/tabs/snapshot-tab.tsx:366` (local function)
- **Purpose**: Processes the full projections array to create simplified snapshot metrics
- **Input**: Takes the projections array from `calculateRetirementProjections()`
- **Output**: Simplified results object with:
  - Monthly/annual retirement income
  - Confidence score
  - Status (on-track, close, at-risk)
  - Years money lasts
  - Legacy value
  - Recommendations
  - Improvements list

## Flow Diagram

```
User Input (Quick Start Form)
    ↓
handleQuickStartCalculate()
    ↓
buildCalculatorSettings() ← from retirement-projections.ts
    ↓
calculateRetirementProjections() ← from retirement-projections.ts
    ↓
[Full Projections Array]
    ↓
calculateSnapshotResults() ← local function in snapshot-tab.tsx
    ↓
[Simplified Snapshot Results]
    ↓
Display in UI
```

## Key Points

1. **Same Core Engine**: Snapshot uses the exact same `calculateRetirementProjections()` function as advanced projections
2. **Consistent Calculations**: Both views use the same tax calculations, withdrawal strategies, and projection logic
3. **Settings Construction**: Both use `buildCalculatorSettings()` for consistency
4. **Additional Processing**: Snapshot adds a `calculateSnapshotResults()` step to simplify the full projections into digestible metrics
5. **Shared Types**: Both use the same `ProjectionDetail`, `Account`, `Expense`, `OtherIncome`, and `CalculatorSettings` types

## Differences

The only difference is:
- **Advanced Projections**: Displays the full projections array directly
- **Snapshot**: Processes the projections array through `calculateSnapshotResults()` to create simplified metrics

Both use the same underlying calculation engine from `retirement-projections.ts`.

# Filing Status Usage Summary

## Definition/Type
- **Location**: `lib/utils/retirement-projections.ts:62`
- **Type**: `filing_status?: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household'`
- **Interface**: `CalculatorSettings`

## Where Filing Status is SET

### 1. Snapshot Tab - Quick Start Save
- **File**: `components/retirement/tabs/snapshot-tab.tsx:693`
- **Logic**: `filing_status: inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single'`
- **Context**: When saving quick start data, sets based on whether spouse SSA is included

### 2. Snapshot Tab - Settings Construction
- **File**: `components/retirement/tabs/snapshot-tab.tsx:859`
- **Logic**: `filing_status: (planDataForFilingStatus?.filing_status as any) || (inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single')`
- **Context**: Uses saved plan data or defaults based on ssaForTwo

### 3. Snapshot Tab - Plan Data for Tooltip
- **File**: `components/retirement/tabs/snapshot-tab.tsx:902`
- **Logic**: `filing_status: inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single'`
- **Context**: Sets in planDataForTooltip for display

### 4. Plan Details Tab - Initial Load
- **File**: `components/retirement/tabs/plan-details-tab.tsx:83`
- **Logic**: Default value `'Married Filing Jointly'`
- **Context**: Initial state for plan basis

### 5. Plan Details Tab - Load from Database
- **File**: `components/retirement/tabs/plan-details-tab.tsx:134`
- **Logic**: `filing_status: data.filing_status || 'Married Filing Jointly'`
- **Context**: Loads from database, defaults to 'Married Filing Jointly'

### 6. Plan Details Tab - Save Plan Basis
- **File**: `components/retirement/tabs/plan-details-tab.tsx:327`
- **Logic**: `filing_status: planBasis.filing_status`
- **Context**: Saves user-selected filing status from dropdown

### 7. Build Calculator Settings
- **File**: `lib/utils/retirement-projections.ts:531`
- **Logic**: `filing_status: (planData?.include_spouse ? 'Married Filing Jointly' : (planData?.filing_status as any)) || 'Single'`
- **Context**: Sets in CalculatorSettings based on include_spouse or planData.filing_status

### 8. Analysis Tab
- **File**: `components/retirement/tabs/analysis-tab.tsx:232`
- **Logic**: `filing_status: (planDataForSettings?.filing_status as any) || 'Single'`
- **Context**: Loads from plan data for analysis calculations

### 9. Tax Efficiency Tab
- **File**: `components/retirement/tabs/tax-efficiency-tab.tsx:172`
- **Logic**: `filing_status: (planDataForSettings?.filing_status as any) || 'Single'`
- **Context**: Loads from plan data for tax efficiency calculations

## Where Filing Status is USED

### 1. Tax Calculation (Main Logic)
- **File**: `lib/utils/retirement-projections.ts:1336`
- **Logic**: `const filingStatus = includeSpouseSsa ? 'Married Filing Jointly' : (settings.filing_status || 'Single')`
- **Purpose**: Determines actual filing status for tax calculations
- **Note**: This is the PRIMARY logic - if includeSpouseSsa is true, overrides settings.filing_status

### 2. Standard Deduction Calculation
- **File**: `lib/utils/retirement-projections.ts:1340`
- **Logic**: `const standardDeduction = filingStatus === 'Married Filing Jointly' ? 29200 : 14600`
- **Purpose**: Sets standard deduction based on filing status

### 3. Progressive Tax Calculation
- **File**: `lib/utils/retirement-projections.ts:297` (function `calculateProgressiveTax`)
- **Usage**: Called with filingStatus parameter throughout projections
- **Locations**:
  - Line 1349: `calculateProgressiveTax(taxableIncomeAfterDeduction, filingStatus)`
  - Line 1367: `calculateProgressiveTax(currentTaxableIncomeAfterDeduction, filingStatus)`
  - Line 1495: `calculateProgressiveTax(finalTaxableIncomeAfterDeduction, filingStatus)`
  - Line 1526: `calculateProgressiveTax(finalTaxableIncomeAfterDeduction, filingStatus)`

### 4. Capital Gains Tax Calculation
- **File**: `lib/utils/retirement-projections.ts:360` (function `calculateCapitalGainsTax`)
- **Usage**: Called with filingStatus parameter throughout projections
- **Locations**:
  - Line 1353: `calculateCapitalGainsTax(distributionTaxable, filingStatus)`
  - Line 1368: `calculateCapitalGainsTax(distributionTaxable, filingStatus)`
  - Line 1510: `calculateCapitalGainsTax(finalTaxableCapitalGains, filingStatus)`
  - Line 1541: `calculateCapitalGainsTax(finalTaxableCapitalGains, filingStatus)`

### 5. Tax Bracket Estimation
- **File**: `lib/utils/retirement-projections.ts:407` (function `estimateMarginalTaxRate`)
- **Usage**: Uses filingStatus to determine standard deduction and tax brackets
- **File**: `lib/utils/retirement-projections.ts:464` (function `estimateCapitalGainsTaxRate`)
- **Usage**: Uses filingStatus to determine capital gains tax brackets

### 6. Snapshot Tab - Tax Tooltip
- **File**: `components/retirement/tabs/snapshot-tab.tsx:2108`
- **Logic**: `const filingStatus = includeSpouseSsa ? 'Married Filing Jointly' : (planDataForTooltip?.filing_status || 'Single')`
- **Purpose**: Shows tax calculation breakdown in tooltip

### 7. Details Tab - Tax Tooltip
- **File**: `components/retirement/tabs/details-tab.tsx:2293`
- **Logic**: `const filingStatus = includeSpouseSsa ? 'Married Filing Jointly' : (settings?.filing_status || 'Single')`
- **Purpose**: Shows tax calculation breakdown in tooltip

### 8. Analysis Tab - Roth Conversion
- **File**: `components/retirement/tabs/analysis-tab.tsx:1273` (function `calculateTaxOnConversion`)
- **Usage**: 
  - Line 1350: `calculateTaxOnConversion(taxableIncome, optimalAmount, settings.filing_status || 'Single')`
  - Line 1360: `calculateTaxOnConversion(avgTaxableIncome, optimalAmount, settings.filing_status || 'Single')`

### 9. Tax Efficiency Tab - Tax Bracket Calculation
- **File**: `components/retirement/tabs/tax-efficiency-tab.tsx:38` (function `calculateTaxBracket`)
- **Usage**: 
  - Line 441: `calculateTaxBracket(income, currentSettings.filing_status || 'Single')`

### 10. Analysis Tab - Tax Bracket Calculation
- **File**: `components/retirement/tabs/analysis-tab.tsx:78` (function `calculateTaxBracket`)
- **Usage**: Uses filingStatus for tax bracket calculations

## Key Logic Pattern

The **PRIMARY** determination of filing status in calculations is:
```typescript
const filingStatus = includeSpouseSsa ? 'Married Filing Jointly' : (settings.filing_status || 'Single')
```

This means:
1. If `includeSpouseSsa` is true → Always use 'Married Filing Jointly'
2. Otherwise → Use `settings.filing_status` or default to 'Single'

## Database Storage

- **Table**: `rp_retirement_plans`
- **Column**: `filing_status`
- **Values**: 'Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household'

## UI Components

### Plan Details Tab - Dropdown
- **File**: `components/retirement/tabs/plan-details-tab.tsx:720-727`
- **Options**: Single, Married Filing Jointly, Married Filing Separately, Head of Household
- **Purpose**: User can manually select filing status

## Display Locations

1. **Snapshot Tab Tooltip**: `components/retirement/tabs/snapshot-tab.tsx:1435`
2. **Details Tab Tooltip**: `components/retirement/tabs/details-tab.tsx:1365`
3. **Tax Efficiency Tab**: `components/retirement/tabs/tax-efficiency-tab.tsx:401`

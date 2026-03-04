/**
 * 2024 Federal tax brackets, standard deductions, and related constants.
 * Single source of truth — every tax calculation should import from here.
 */

export type FilingStatus = 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household'

export interface TaxBracket {
  min: number
  max: number
  rate: number
}

// ── 2024 Federal Income Tax Brackets ──

export const INCOME_TAX_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  'Single': [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  'Married Filing Jointly': [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  'Married Filing Separately': [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ],
  'Head of Household': [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
}

// ── 2024 Long-Term Capital Gains Tax Brackets ──

export const CAPITAL_GAINS_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  'Single': [
    { min: 0, max: 47025, rate: 0.00 },
    { min: 47025, max: 518900, rate: 0.15 },
    { min: 518900, max: Infinity, rate: 0.20 },
  ],
  'Married Filing Jointly': [
    { min: 0, max: 94350, rate: 0.00 },
    { min: 94350, max: 583750, rate: 0.15 },
    { min: 583750, max: Infinity, rate: 0.20 },
  ],
  'Married Filing Separately': [
    { min: 0, max: 47125, rate: 0.00 },
    { min: 47125, max: 291850, rate: 0.15 },
    { min: 291850, max: Infinity, rate: 0.20 },
  ],
  'Head of Household': [
    { min: 0, max: 63100, rate: 0.00 },
    { min: 63100, max: 523050, rate: 0.15 },
    { min: 523050, max: Infinity, rate: 0.20 },
  ],
}

// ── 2024 Standard Deductions ──

export const STANDARD_DEDUCTIONS: Record<FilingStatus, number> = {
  'Single': 14600,
  'Married Filing Jointly': 29200,
  'Married Filing Separately': 14600,
  'Head of Household': 21900,
}

// ── Common fallback rates ──

export const DEFAULT_MARGINAL_TAX_RATE = 0.22
export const DEFAULT_ESTIMATED_TAX_RATE = 0.20
export const DEFAULT_ROTH_CONVERSION_TAX_RATE = 0.15
export const DEFAULT_TAXABLE_ACCOUNT_RATIO = 0.30
export const SSA_TAXABLE_PORTION = 0.50
export const TOP_MARGINAL_RATE = 0.37

/** Helper: look up the standard deduction for a filing status string */
export function getStandardDeduction(filingStatus: string): number {
  return STANDARD_DEDUCTIONS[filingStatus as FilingStatus] ?? STANDARD_DEDUCTIONS['Single']
}

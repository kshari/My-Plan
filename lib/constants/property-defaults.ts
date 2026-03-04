/**
 * Property analysis default values.
 * Single source of truth for property-related defaults.
 */

// ── Loan Defaults ──
export const DEFAULT_INTEREST_RATE_MIN = 4.0
export const DEFAULT_INTEREST_RATE_MAX = 7.0
export const DEFAULT_DOWN_PAYMENT_PCT = 25
export const DEFAULT_DOWN_PAYMENT_MIN = 20
export const DEFAULT_DOWN_PAYMENT_MAX = 30
export const DEFAULT_CLOSING_COST_PCT = 3
export const LOAN_TERMS = [15, 20, 30] as const
export const DEFAULT_LOAN_TERM = 30
export const MAX_INTEREST_RATE_SLIDER = 15
export const MAX_DOWN_PAYMENT_SLIDER = 50

// ── Scenario Analysis Ranges ──
export const DEFAULT_PRICE_CHANGE_MIN = -15
export const DEFAULT_PRICE_CHANGE_MAX = 10
export const DEFAULT_INCOME_CHANGE_MIN = -10
export const DEFAULT_INCOME_CHANGE_MAX = 10
export const DEFAULT_EXPENSE_CHANGE_MIN = -10
export const DEFAULT_EXPENSE_CHANGE_MAX = 10
export const SLIDER_RANGE_MIN = -20
export const SLIDER_RANGE_MAX_PRICE = 30
export const SLIDER_RANGE_MAX_INCOME_EXPENSE = 20

// ── Default Property Values (fallbacks) ──
export const DEFAULT_ASKING_PRICE = 1_000_000
export const DEFAULT_GROSS_INCOME = 120_000
export const DEFAULT_OPERATING_EXPENSES = 40_000

// ── Calculation Constants ──
export const IRR_INITIAL_GUESS = 0.1
export const IRR_TOLERANCE = 0.0001
export const IRR_MAX_ITERATIONS = 100
export const BALANCE_THRESHOLD = 0.01
export const SCENARIO_COMPARISON_TOLERANCE = 0.01
export const THRESHOLD_ANALYSIS_STEP = 0.1
export const SLIDER_STEP = 0.5
export const THRESHOLD_ANALYSIS_RANGE = 50
export const THRESHOLD_ANALYSIS_MAX_RATE = 15
export const MONTHS_PER_YEAR = 12

// ── Property Types ──
export const PROPERTY_TYPES = [
  'Single Family',
  'Multi Family',
  'Apartment',
  'Commercial',
  'Other',
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

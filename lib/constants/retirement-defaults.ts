/**
 * Single source of truth for all retirement planning default values.
 *
 * Every component and utility should import from here instead of
 * hardcoding fallback values. When a DB field is null/missing,
 * use the corresponding constant from this file.
 */

// ── Personal ──
export const DEFAULT_AGE = 40
export const DEFAULT_RETIREMENT_AGE = 65
export const DEFAULT_LIFE_EXPECTANCY = 90
export const DEFAULT_SPOUSE_LIFE_EXPECTANCY = 90
export const DEFAULT_FILING_STATUS = 'Single' as const

// ── Rates (decimal form, e.g. 0.03 = 3%) ──
export const DEFAULT_GROWTH_RATE_PRE_RETIREMENT = 0.10    // 10%
export const DEFAULT_GROWTH_RATE_DURING_RETIREMENT = 0.05 // 5%
export const DEFAULT_INFLATION_RATE = 0.03                // 3%
export const DEFAULT_DEBT_INTEREST_RATE = 0.06            // 6%
export const DEFAULT_CAPITAL_GAINS_TAX_RATE = 0.20        // 20%
export const DEFAULT_INCOME_TAX_RATE_RETIREMENT = 0.25    // 25%
export const DEFAULT_LOAN_RATE = 0.10                     // 10%

// ── Rates (percentage form, for UI display / plan-details-tab) ──
export const DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT = DEFAULT_GROWTH_RATE_PRE_RETIREMENT * 100    // 10
export const DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT = DEFAULT_GROWTH_RATE_DURING_RETIREMENT * 100 // 5
export const DEFAULT_INFLATION_RATE_PCT = DEFAULT_INFLATION_RATE * 100                               // 3

// ── SSA ──
export const DEFAULT_SSA_START_AGE = 65
export const SSA_EARLIEST_ELIGIBILITY_AGE = 62
export const DEFAULT_SSA_ANNUAL_BENEFIT = 22_000
export const DEFAULT_SPOUSE_SSA_BENEFIT = 16_000

// ── Healthcare / Medicare ──
export const MEDICARE_ELIGIBILITY_AGE = 65
export const DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM = 15_000  // ACA marketplace / COBRA estimate
export const DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM = 4_200   // Medicare Part B + supplement estimate

// ── Savings & spending (for the quick calculator) ──
export const DEFAULT_CURRENT_SAVINGS = 200_000
export const DEFAULT_ANNUAL_CONTRIBUTION = 20_000
export const DEFAULT_MONTHLY_EXPENSES = 6_000

// ── Toggles ──
export const DEFAULT_ENABLE_BORROWING = false
export const DEFAULT_INCLUDE_SSA = true
export const DEFAULT_INCLUDE_SPOUSE = false
export const DEFAULT_PLANNER_SSA_INCOME = true
export const DEFAULT_SPOUSE_SSA_INCOME = false

// ── Projection ──
/** Maximum age to project to (loop upper bound, distinct from life expectancy) */
export const DEFAULT_MAX_PROJECTION_AGE = 100

// ── Withdrawal Strategy ──
export const SAFE_WITHDRAWAL_RATE = 0.04        // 4% rule
export const DEFAULT_FIXED_DOLLAR_WITHDRAWAL = 50_000
export const DEFAULT_FIXED_PERCENTAGE_RATE = 0.04
export const GUARDRAIL_CEILING = 0.06            // 6% max withdrawal
export const GUARDRAIL_FLOOR = 0.03              // 3% min withdrawal
export const ROTH_CONVERSION_FRACTION = 0.10     // 10% per year
export const ROTH_CONVERSION_MAX = 10_000
export const QCD_MAX_ANNUAL = 100_000
export const QCD_FRACTION_OF_RMD = 0.50

// ── RMD (Required Minimum Distributions) ──
export const RMD_START_AGE = 73
export const RMD_LIFE_EXPECTANCY_FACTOR_AT_73 = 27.4

// ── Risk / Score Thresholds ──
export const SCORE_ON_TRACK_THRESHOLD = 80
export const SCORE_CLOSE_THRESHOLD = 60
export const SCORE_MEDIUM_RISK_THRESHOLD = 75
export const SCORE_AT_RISK_THRESHOLD = 50

// ── Analysis Score Weights ──
export const SCORE_WEIGHT_LONGEVITY = 0.60
export const SCORE_WEIGHT_TAX_EFFICIENCY = 0.15
export const SCORE_WEIGHT_INFLATION_MEDICAL = 0.10
export const SCORE_WEIGHT_CASHFLOW = 0.05
export const SCORE_WEIGHT_SCENARIO_LONGEVITY = 0.50
export const SCORE_WEIGHT_SCENARIO_SCORE = 0.25

// ── Plan defaults popup / defaults-tab ──
export const DEFAULT_SETTINGS_LIST = [
  { name: 'Growth rate (return) before retirement', default: DEFAULT_GROWTH_RATE_PRE_RETIREMENT },
  { name: 'Loan rate (if borrowed for expenses)', default: DEFAULT_LOAN_RATE },
  { name: 'Growth rate (return) during retirement', default: DEFAULT_GROWTH_RATE_DURING_RETIREMENT },
  { name: 'Capital gains & dividends blended tax rate', default: DEFAULT_CAPITAL_GAINS_TAX_RATE },
  { name: 'Tax rate during retirement', default: DEFAULT_INCOME_TAX_RATE_RETIREMENT },
  { name: 'Inflation', default: DEFAULT_INFLATION_RATE },
] as const

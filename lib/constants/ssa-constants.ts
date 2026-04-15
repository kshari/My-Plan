/**
 * Social Security Administration (SSA) constants.
 * Single source of truth for all SSA-related calculations.
 */

// ── Full Retirement Age ──
export const SSA_FULL_RETIREMENT_AGE = 67

// ── Early / Delayed Claiming Adjustments ──
/** Per-year reduction for claiming before FRA (6.67%/yr simplified) */
export const SSA_EARLY_CLAIMING_REDUCTION_PER_YEAR = 0.0667
/** Maximum cumulative reduction when claiming at 62 (30%) */
export const SSA_MAX_EARLY_REDUCTION = 0.30
/** Minimum multiplier when claiming as early as possible (1.0 - 0.30) */
export const SSA_MIN_CLAIMING_MULTIPLIER = 0.70
/** Per-year bonus for delaying past FRA (8%/yr) */
export const SSA_DELAYED_CREDIT_PER_YEAR = 0.08
/** Maximum cumulative bonus when delaying to 70 (24%) */
export const SSA_MAX_DELAYED_BONUS = 0.24

// ── Wage Base & Estimation ──
/** 2024 Social Security taxable wage base */
export const SSA_WAGE_BASE = 168_600

// ── Simplified PIA Replacement Rates (bend-point model) ──
export const SSA_BEND_POINT_1 = 50_000
export const SSA_BEND_POINT_2 = 100_000
export const SSA_RATE_TIER_1 = 0.40
export const SSA_RATE_TIER_2 = 0.30
export const SSA_RATE_TIER_3 = 0.20

/** Spouse benefit multiplier (lower-earner spouse estimate) */
export const SSA_SPOUSE_BENEFIT_MULTIPLIER = 0.75

// ── Benefit Bounds ──
export const SSA_MIN_BENEFIT_PLANNER = 15_000
export const SSA_MIN_BENEFIT_SPOUSE  = 10_000
export const SSA_MAX_BENEFIT_PLANNER = 45_000
export const SSA_MAX_BENEFIT_SPOUSE  = 35_000

/** Default annual SSA benefit when no estimate is available (planner).
 *  Based on SSA avg retired worker $1,924/mo (SSA Monthly Statistical Snapshot, Oct 2024 — ssa.gov). */
export const SSA_DEFAULT_PLANNER_BENEFIT = 23_100
/** Default annual SSA benefit when no estimate is available (spouse).
 *  Based on SSA avg women retired worker ~$1,714/mo (SSA Statistical Supplement 2024 — ssa.gov). */
export const SSA_DEFAULT_SPOUSE_BENEFIT = 20_500

/** Annual COLA applied to SSA benefits in the projection engine.
 *  2.5% = SSA 2025 Cost-of-Living Adjustment (ssa.gov/OACT/COLA/colaseries.html).
 *  10-year historical average is ~2.6%. */
export const SSA_COLA_RATE = 0.025

/**
 * Calculate the SSA claiming multiplier for a given start age.
 * < FRA → reduced using the correct two-tier monthly formula:
 *   - First 36 months before FRA: 5/9 of 1% per month (≈ 6.667%/yr)
 *   - Months 37–60 before FRA:    5/12 of 1% per month (≈ 5.000%/yr)
 * >= FRA → 1.0 (delayed credits not modeled here; see SSA Withdrawal Analysis tab).
 *
 * Examples:
 *   age 65 (24 months before FRA): 24 × 5/900 = 13.33% reduction → 0.8667
 *   age 63 (48 months before FRA): 36 × 5/900 + 12 × 5/1200 = 20% + 5% = 25% → 0.7500
 *   age 62 (60 months before FRA): 36 × 5/900 + 24 × 5/1200 = 20% + 10% = 30% → 0.7000 (floor)
 */
export function ssaClaimingMultiplier(startAge: number): number {
  if (startAge >= SSA_FULL_RETIREMENT_AGE) return 1.0
  const monthsBefore = Math.round((SSA_FULL_RETIREMENT_AGE - startAge) * 12)
  const tier1Months = Math.min(monthsBefore, 36)
  const tier2Months = Math.max(0, monthsBefore - 36)
  const reduction = (tier1Months * 5) / 900 + (tier2Months * 5) / 1200
  return Math.max(SSA_MIN_CLAIMING_MULTIPLIER, 1.0 - reduction)
}

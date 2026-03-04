/**
 * Monte Carlo simulation parameters.
 * Single source of truth for simulation configuration.
 */

export const MC_DEFAULT_NUM_SIMULATIONS = 1000

/** Standard deviation of returns before retirement (market volatility) */
export const MC_STD_DEV_PRE_RETIREMENT = 0.15
/** Standard deviation of returns during retirement (lower-risk portfolio) */
export const MC_STD_DEV_DURING_RETIREMENT = 0.12

/** Proportion of retirement years with negative cashflow that marks a run as "at-risk" (for display/risk scoring, not success/failure) */
export const MC_NEGATIVE_CASHFLOW_FAILURE_THRESHOLD = 0.20

/** Floor for randomised annual returns — prevents unrealistic crashes beyond worst historical single-year declines */
export const MC_RETURN_FLOOR = -0.40

// ── Percentile keys used in summary reporting ──
export const MC_PERCENTILE_P5  = 0.05
export const MC_PERCENTILE_P25 = 0.25
export const MC_PERCENTILE_P75 = 0.75
export const MC_PERCENTILE_P90 = 0.90
export const MC_PERCENTILE_P95 = 0.95

/** Deterministic stress test: hardcoded bear sequence for first years of retirement (decimal). Year 1: -15%, Year 2: -5%, Year 3: +2%, then normal growth. */
export const STRESS_TEST_BEAR_SEQUENCE = [-0.15, -0.05, 0.02] as const

/** Five bear scenarios for deterministic stress test: name and decimal return sequence for first years of retirement */
export const STRESS_TEST_SCENARIOS = [
  { name: 'Mild', sequence: [-0.05, -0.03, 0] as const },
  { name: 'Moderate', sequence: [-0.10, -0.05, 0] as const },
  { name: 'Severe', sequence: [-0.15, -0.05, 0.02] as const },
  { name: 'Very Severe', sequence: [-0.25, -0.10, 0, 0.05] as const },
  { name: 'Extreme (40% yr 1)', sequence: [-0.40] as const },
] as const

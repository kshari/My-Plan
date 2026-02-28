/**
 * Monte Carlo simulation parameters.
 * Single source of truth for simulation configuration.
 */

export const MC_DEFAULT_NUM_SIMULATIONS = 1000

/** Standard deviation of returns before retirement (market volatility) */
export const MC_STD_DEV_PRE_RETIREMENT = 0.15
/** Standard deviation of returns during retirement (lower-risk portfolio) */
export const MC_STD_DEV_DURING_RETIREMENT = 0.12

/** Proportion of projection years with negative cashflow that marks a run as "failed" */
export const MC_NEGATIVE_CASHFLOW_FAILURE_THRESHOLD = 0.20

// ── Percentile keys used in summary reporting ──
export const MC_PERCENTILE_P5  = 0.05
export const MC_PERCENTILE_P25 = 0.25
export const MC_PERCENTILE_P75 = 0.75
export const MC_PERCENTILE_P90 = 0.90
export const MC_PERCENTILE_P95 = 0.95

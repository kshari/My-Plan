/**
 * Timing constants for debounce, toast, and animation durations.
 * Single source of truth — avoid magic ms values across the codebase.
 */

/** Debounce delay for auto-save operations (ms) */
export const DEBOUNCE_SAVE_MS = 800

/** Toast notification duration — short (ms) */
export const TOAST_DURATION_SHORT = 3000

/** Toast notification duration — long (ms) */
export const TOAST_DURATION_LONG = 5000

/** Delay before removing "Saved" indicator (ms) */
export const SAVED_INDICATOR_MS = 2000

/** API rate-limiting delay between sequential requests (ms) */
export const API_RATE_LIMIT_MS = 200

/** Cache duration for market data (ms) — 5 minutes */
export const MARKET_DATA_CACHE_MS = 5 * 60 * 1000

/** Number of concurrent API requests in a batch */
export const MARKET_DATA_BATCH_SIZE = 5

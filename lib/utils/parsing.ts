/**
 * Safe parsing utilities for values that may be null, undefined, or non-numeric.
 */

/** Parse a value to float with a safe fallback. Handles null, undefined, objects, strings. */
export function parseFloatSafe(value: unknown, defaultValue: number = 0): number {
  if (value == null) return defaultValue
  const parsed = typeof value === 'number' ? value : parseFloat(String(value))
  return isNaN(parsed) ? defaultValue : parsed
}

/** Parse a value to integer with a safe fallback. */
export function parseIntSafe(value: unknown, defaultValue: number = 0): number {
  if (value == null) return defaultValue
  const parsed = typeof value === 'number' ? Math.round(value) : parseInt(String(value), 10)
  return isNaN(parsed) ? defaultValue : parsed
}

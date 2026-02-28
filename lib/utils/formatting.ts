/**
 * Shared formatting utilities for currency, percentages, and chart values.
 */

/** Format a number as currency (e.g. $1,234,567) with no decimals */
export function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0, style: 'currency', currency: 'USD' })
}

/** Format as compact currency for charts (e.g. $1,235k, $1.2M) */
export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}k`
  return `${sign}$${abs.toFixed(0)}`
}

/** Format a decimal as a percentage string (e.g. 0.075 → "7.50%") */
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/** Format a number with commas and optional decimal places */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

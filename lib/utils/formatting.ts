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

/**
 * Parse a YYYY-MM-DD date string as local date (not UTC).
 * new Date("2025-03-06") is UTC midnight, which displays as the previous day in US timezones.
 * Accepts string, number (timestamp), or Date for robustness (e.g. from chart labelFormatter).
 */
export function parseLocalDate(dateOnly: string | number | Date): Date {
  if (typeof dateOnly === 'number') return new Date(dateOnly)
  if (dateOnly instanceof Date) return dateOnly
  const str = String(dateOnly)
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

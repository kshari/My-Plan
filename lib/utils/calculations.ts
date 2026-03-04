/**
 * Shared financial calculation helpers.
 */

/** Apply compound inflation/growth to a value over a number of years. */
export function applyInflation(value: number, annualRate: number, years: number): number {
  return value * Math.pow(1 + annualRate, years)
}

/** Get the compound factor: (1 + rate) ^ years */
export function compoundFactor(annualRate: number, years: number): number {
  return Math.pow(1 + annualRate, years)
}

/** Present value of an annuity: PV = payment * [(1 - (1+r)^-n) / r] */
export function presentValueAnnuity(payment: number, rate: number, periods: number): number {
  if (rate <= 0) return payment * periods
  return payment * (1 - Math.pow(1 + rate, -periods)) / rate
}

/** Future value of regular contributions: FV = C * [((1+r)^n - 1) / r] */
export function futureValueContributions(contribution: number, rate: number, periods: number): number {
  if (rate <= 0) return contribution * periods
  return contribution * ((Math.pow(1 + rate, periods) - 1) / rate)
}

/** Future value of a lump sum: FV = PV * (1+r)^n */
export function futureValue(presentValue: number, rate: number, periods: number): number {
  return presentValue * Math.pow(1 + rate, periods)
}

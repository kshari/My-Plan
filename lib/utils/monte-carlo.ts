// Monte Carlo simulation for retirement planning

import type { Account, Expense, OtherIncome, CalculatorSettings, ProjectionDetail } from './retirement-projections'
import { calculateRetirementProjections } from './retirement-projections'

export interface MonteCarloResult {
  simulation: number
  success: boolean
  finalNetworth: number
  minNetworth: number
  yearsWithNegativeCashFlow: number
  totalTaxes: number
  /** Weighted average of the two growth rates used in this simulation run */
  avgAnnualReturn: number
  projections: ProjectionDetail[]
}

export interface PercentileDetail {
  finalNetworth: number
  /** CAGR from initial portfolio total to finalNetworth over the full projection span */
  cagr: number | null   // null when finalNetworth ≤ 0 (can't log a negative)
  /** Weighted-average growth rate used in this simulation run */
  avgAnnualReturn: number
}

export interface MonteCarloSummary {
  successRate: number
  averageFinalNetworth: number
  medianFinalNetworth: number
  minFinalNetworth: number
  maxFinalNetworth: number
  averageMinNetworth: number
  averageYearsWithNegativeCashFlow: number
  averageTotalTaxes: number
  /** 5th percentile — worst 5% of scenarios (low value = bad) */
  percentile5: number
  percentile25: number
  percentile75: number
  percentile90: number
  /** 95th percentile — best 5% of scenarios (high value = good) */
  percentile95: number
  /** Per-percentile CAGR and average-return details */
  detail: {
    p5:     PercentileDetail
    p25:    PercentileDetail
    median: PercentileDetail
    p75:    PercentileDetail
    p90:    PercentileDetail
    average: PercentileDetail
  }
  /** Starting portfolio balance (sum of all accounts) */
  initialNetworth: number
  /** Total projection years (same for every run) */
  projectionYears: number
}

/**
 * Run Monte Carlo simulation with variable market returns.
 */
export function runMonteCarloSimulation(
  birthYear: number,
  accounts: Account[],
  expenses: Expense[],
  otherIncome: OtherIncome[],
  baseSettings: CalculatorSettings,
  lifeExpectancy: number,
  numSimulations: number = 1000
): { results: MonteCarloResult[], summary: MonteCarloSummary } {
  const results: MonteCarloResult[] = []
  const retirementAge = baseSettings.retirement_age || 65
  const initialNetworth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  for (let sim = 0; sim < numSimulations; sim++) {
    // Generate random market returns using normal distribution
    // Before retirement: mean = base rate, std dev = 15%
    // During retirement: mean = base rate, std dev = 12%
    const beforeRetirementReturn = generateNormalRandom(
      baseSettings.growth_rate_before_retirement,
      0.15
    )
    const duringRetirementReturn = generateNormalRandom(
      baseSettings.growth_rate_during_retirement,
      0.12
    )

    const modifiedSettings: CalculatorSettings = {
      ...baseSettings,
      growth_rate_before_retirement: Math.max(0, beforeRetirementReturn),
      growth_rate_during_retirement: Math.max(0, duringRetirementReturn),
    }

    const projections = calculateRetirementProjections(
      birthYear,
      accounts,
      expenses,
      otherIncome,
      modifiedSettings,
      lifeExpectancy
    )

    const finalNetworth = projections[projections.length - 1]?.networth ?? 0
    const minNetworth = Math.min(...projections.map(p => p.networth ?? 0))
    const yearsWithNegativeCashFlow = projections.filter(p => (p.gap_excess ?? 0) < 0).length
    const totalTaxes = projections.reduce((sum, p) => sum + (p.tax ?? 0), 0)
    const success = finalNetworth > 0 && yearsWithNegativeCashFlow < projections.length * 0.2

    // Weighted-average annual return across both phases
    const yearsBeforeRetirement = projections.filter(p => (p.age ?? 0) < retirementAge).length
    const yearsDuringRetirement  = projections.filter(p => (p.age ?? 0) >= retirementAge).length
    const totalYears = projections.length
    const avgAnnualReturn = totalYears > 0
      ? (Math.max(0, beforeRetirementReturn) * yearsBeforeRetirement +
         Math.max(0, duringRetirementReturn)  * yearsDuringRetirement) / totalYears
      : Math.max(0, beforeRetirementReturn)

    results.push({
      simulation: sim + 1,
      success,
      finalNetworth,
      minNetworth,
      yearsWithNegativeCashFlow,
      totalTaxes,
      avgAnnualReturn,
      projections,
    })
  }

  // Sort ascending by finalNetworth for percentile indexing
  const sorted = [...results].sort((a, b) => a.finalNetworth - b.finalNetworth)
  const n = sorted.length
  const finalNetworths = sorted.map(r => r.finalNetworth)

  const projectionYears = results[0]?.projections.length ?? 0

  /** Build a PercentileDetail from a specific sorted result */
  const makeDetail = (result: MonteCarloResult): PercentileDetail => {
    const fn = result.finalNetworth
    const years = result.projections.length
    const cagr = fn > 0 && initialNetworth > 0 && years > 0
      ? Math.pow(fn / initialNetworth, 1 / years) - 1
      : null
    return { finalNetworth: fn, cagr, avgAnnualReturn: result.avgAnnualReturn }
  }

  /** Build an "average" PercentileDetail across all runs */
  const avgFinalNetworth = finalNetworths.reduce((a, b) => a + b, 0) / n
  const avgAnnualReturnAll = results.reduce((a, b) => a + b.avgAnnualReturn, 0) / results.length
  const avgCagr = avgFinalNetworth > 0 && initialNetworth > 0 && projectionYears > 0
    ? Math.pow(avgFinalNetworth / initialNetworth, 1 / projectionYears) - 1
    : null
  const averageDetail: PercentileDetail = {
    finalNetworth: avgFinalNetworth,
    cagr: avgCagr,
    avgAnnualReturn: avgAnnualReturnAll,
  }

  const successful = results.filter(r => r.success).length
  const minNetworths = results.map(r => r.minNetworth)

  const summary: MonteCarloSummary = {
    successRate:    (successful / numSimulations) * 100,
    averageFinalNetworth: avgFinalNetworth,
    medianFinalNetworth:  finalNetworths[Math.floor(n / 2)],
    minFinalNetworth:     finalNetworths[0],
    maxFinalNetworth:     finalNetworths[n - 1],
    averageMinNetworth:   minNetworths.reduce((a, b) => a + b, 0) / minNetworths.length,
    averageYearsWithNegativeCashFlow:
      results.reduce((sum, r) => sum + r.yearsWithNegativeCashFlow, 0) / results.length,
    averageTotalTaxes:
      results.reduce((sum, r) => sum + r.totalTaxes, 0) / results.length,
    percentile5:  finalNetworths[Math.floor(n * 0.05)],
    percentile25: finalNetworths[Math.floor(n * 0.25)],
    percentile75: finalNetworths[Math.floor(n * 0.75)],
    percentile90: finalNetworths[Math.floor(n * 0.90)],
    percentile95: finalNetworths[Math.floor(n * 0.95)],
    detail: {
      p5:     makeDetail(sorted[Math.floor(n * 0.05)]),
      p25:    makeDetail(sorted[Math.floor(n * 0.25)]),
      median: makeDetail(sorted[Math.floor(n / 2)]),
      p75:    makeDetail(sorted[Math.floor(n * 0.75)]),
      p90:    makeDetail(sorted[Math.floor(n * 0.90)]),
      average: averageDetail,
    },
    initialNetworth,
    projectionYears,
  }

  return { results, summary }
}

/**
 * Generate random number from normal distribution using Box-Muller transform.
 */
function generateNormalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z0 * stdDev
}

/**
 * Analyze sequence of returns risk based on the plan's deterministic projections.
 * Note: because projections use a fixed growth rate, worst ≈ best ≈ average ≈ the assumed rate.
 * Run Monte Carlo for a true market-volatility stress test.
 */
export function analyzeSequenceOfReturnsRisk(
  projections: ProjectionDetail[],
  retirementAge: number
): {
  worstCaseSequence: number
  bestCaseSequence: number
  averageSequence: number
  riskLevel: 'Low' | 'Medium' | 'High'
  description: string
} {
  if (projections.length === 0) {
    return { worstCaseSequence: 0, bestCaseSequence: 0, averageSequence: 0, riskLevel: 'Low', description: 'No projections available' }
  }

  const retirementStartIndex = projections.findIndex(p => p.age && p.age >= retirementAge)
  if (retirementStartIndex === -1) {
    return { worstCaseSequence: 0, bestCaseSequence: 0, averageSequence: 0, riskLevel: 'Low', description: 'Retirement not yet reached' }
  }

  const retirementYears = projections.slice(retirementStartIndex, retirementStartIndex + 10)

  const returns = retirementYears.map((proj, index) => {
    if (index === 0) return 0
    const prevBalance = retirementYears[index - 1]?.networth ?? 0
    const currentBalance = proj.networth ?? 0
    const withdrawals = (proj.distribution_401k ?? 0) + (proj.distribution_roth ?? 0) +
                       (proj.distribution_taxable ?? 0) + (proj.distribution_other ?? 0)
    return prevBalance > 0 ? ((currentBalance - prevBalance + withdrawals) / prevBalance) : 0
  })

  const nonZero = returns.filter(r => r !== 0)
  const worstCaseSequence = nonZero.length > 0 ? Math.min(...nonZero) : 0
  const bestCaseSequence  = nonZero.length > 0 ? Math.max(...nonZero) : 0
  const averageSequence   = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0

  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
  let description = ''

  if (worstCaseSequence < -0.2) {
    riskLevel = 'High'
    description = 'High sequence of returns risk: Poor market performance in early retirement years could significantly impact plan sustainability.'
  } else if (worstCaseSequence < -0.1) {
    riskLevel = 'Medium'
    description = 'Moderate sequence of returns risk: Market downturns in early retirement could affect plan sustainability.'
  } else {
    riskLevel = 'Low'
    description = 'Low sequence of returns risk: Plan appears resilient to market volatility in early retirement.'
  }

  return {
    worstCaseSequence: worstCaseSequence * 100,
    bestCaseSequence:  bestCaseSequence  * 100,
    averageSequence:   averageSequence   * 100,
    riskLevel,
    description,
  }
}

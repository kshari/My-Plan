// Monte Carlo simulation for retirement planning

import type { Account, Expense, OtherIncome, CalculatorSettings, ProjectionDetail } from './retirement-projections'
import { calculateRetirementProjections } from './retirement-projections'
import { DEFAULT_RETIREMENT_AGE } from '@/lib/constants/retirement-defaults'
import {
  MC_DEFAULT_NUM_SIMULATIONS,
  MC_STD_DEV_PRE_RETIREMENT,
  MC_STD_DEV_DURING_RETIREMENT,
  MC_NEGATIVE_CASHFLOW_FAILURE_THRESHOLD,
  MC_RETURN_FLOOR,
  MC_PERCENTILE_P5,
  MC_PERCENTILE_P25,
  MC_PERCENTILE_P75,
  MC_PERCENTILE_P90,
  MC_PERCENTILE_P95,
  STRESS_TEST_SCENARIOS,
} from '@/lib/constants/monte-carlo'

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
 * Run Monte Carlo simulation with per-year variable market returns.
 * Each simulation generates independent random returns for every year of the projection.
 */
export function runMonteCarloSimulation(
  birthYear: number,
  accounts: Account[],
  expenses: Expense[],
  otherIncome: OtherIncome[],
  baseSettings: CalculatorSettings,
  lifeExpectancy: number,
  numSimulations: number = MC_DEFAULT_NUM_SIMULATIONS
): { results: MonteCarloResult[], summary: MonteCarloSummary } {
  const results: MonteCarloResult[] = []
  const retirementAge = baseSettings.retirement_age || DEFAULT_RETIREMENT_AGE
  const initialNetworth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  // Determine how many years fall in each phase so we can generate per-year returns
  const currentYear = baseSettings.current_year || new Date().getFullYear()
  const currentAge = currentYear - birthYear
  const totalProjectionYears = lifeExpectancy - currentAge + 1
  const yearsBeforeRetirement = Math.max(0, retirementAge - currentAge)
  const yearsDuringRetirement = Math.max(0, totalProjectionYears - yearsBeforeRetirement)

  for (let sim = 0; sim < numSimulations; sim++) {
    // Generate independent random return for every single year, floored at MC_RETURN_FLOOR
    const preRetirementReturns: number[] = []
    for (let y = 0; y < yearsBeforeRetirement; y++) {
      preRetirementReturns.push(Math.max(MC_RETURN_FLOOR, generateNormalRandom(
        baseSettings.growth_rate_before_retirement,
        MC_STD_DEV_PRE_RETIREMENT
      )))
    }
    const retirementReturns: number[] = []
    for (let y = 0; y < yearsDuringRetirement; y++) {
      retirementReturns.push(Math.max(MC_RETURN_FLOOR, generateNormalRandom(
        baseSettings.growth_rate_during_retirement,
        MC_STD_DEV_DURING_RETIREMENT
      )))
    }

    // Build the full return sequence that the projection engine will use
    const retirementReturnSequence = retirementReturns

    const modifiedSettings: CalculatorSettings = {
      ...baseSettings,
      pre_retirement_return_sequence: preRetirementReturns,
      retirement_return_sequence: retirementReturnSequence,
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
    const retirementProjections = projections.filter(p => (p.age ?? 0) >= retirementAge)
    const yearsWithNegativeCashFlow = retirementProjections.filter(p => (p.gap_excess ?? 0) < 0).length
    const totalTaxes = projections.reduce((sum, p) => sum + (p.tax ?? 0), 0)
    // Success = plan ends with positive net worth (portfolio doesn't deplete)
    const success = finalNetworth > 0

    const allReturns = [...preRetirementReturns, ...retirementReturns]
    const avgAnnualReturn = allReturns.length > 0
      ? allReturns.reduce((a, b) => a + b, 0) / allReturns.length
      : baseSettings.growth_rate_before_retirement

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
    percentile5:  finalNetworths[Math.floor(n * MC_PERCENTILE_P5)],
    percentile25: finalNetworths[Math.floor(n * MC_PERCENTILE_P25)],
    percentile75: finalNetworths[Math.floor(n * MC_PERCENTILE_P75)],
    percentile90: finalNetworths[Math.floor(n * MC_PERCENTILE_P90)],
    percentile95: finalNetworths[Math.floor(n * MC_PERCENTILE_P95)],
    detail: {
      p5:     makeDetail(sorted[Math.floor(n * MC_PERCENTILE_P5)]),
      p25:    makeDetail(sorted[Math.floor(n * MC_PERCENTILE_P25)]),
      median: makeDetail(sorted[Math.floor(n / 2)]),
      p75:    makeDetail(sorted[Math.floor(n * MC_PERCENTILE_P75)]),
      p90:    makeDetail(sorted[Math.floor(n * MC_PERCENTILE_P90)]),
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

/** Result of one run (baseline or stress) for deterministic stress test */
export interface DeterministicStressRun {
  finalNetworth: number
  minNetworth: number
  yearsWithNegativeCashFlow: number
  success: boolean
  projections: ProjectionDetail[]
}

/** One bear scenario result with max drawdown */
export interface DeterministicStressScenarioResult {
  name: string
  bearSequencePct: number[]
  recoveryRatePct: number
  run: DeterministicStressRun
  /** Peak-to-trough max drawdown as percentage (0–100) */
  maxDrawdownPct: number
}

/** Summary of deterministic stress test: baseline + 5 bear scenarios */
export interface DeterministicStressResult {
  /** Baseline run with steady average growth */
  baseline: DeterministicStressRun
  /** Five bear scenario results */
  scenarios: DeterministicStressScenarioResult[]
  initialNetworth: number
  retirementAge: number
}

/**
 * Compute peak-to-trough max drawdown from projections (as percentage 0–100).
 */
function computeMaxDrawdown(projections: ProjectionDetail[]): number {
  let peak = 0
  let maxDrawdown = 0
  for (const p of projections) {
    const nw = p.networth ?? 0
    if (nw > peak) peak = nw
    if (peak > 0 && nw < peak) {
      const dd = ((peak - nw) / peak) * 100
      if (dd > maxDrawdown) maxDrawdown = dd
    }
  }
  return Math.round(maxDrawdown * 100) / 100
}

/**
 * Run a deterministic stress test: compare plan under steady growth vs 5 bear market
 * scenarios. Each bear sequence is applied in the first years of retirement, followed
 * by a recovery rate so the geometric average over retirement equals the plan's assumed rate.
 */
export function runDeterministicStressTest(
  birthYear: number,
  accounts: Account[],
  expenses: Expense[],
  otherIncome: OtherIncome[],
  baseSettings: CalculatorSettings,
  lifeExpectancy: number
): DeterministicStressResult {
  const retirementAge = baseSettings.retirement_age || DEFAULT_RETIREMENT_AGE
  const initialNetworth = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  const baselineProjections = calculateRetirementProjections(
    birthYear,
    accounts,
    expenses,
    otherIncome,
    baseSettings,
    lifeExpectancy
  )

  const retirementYears = baselineProjections.filter(p => (p.age ?? 0) >= retirementAge).length
  const g = baseSettings.growth_rate_during_retirement

  const toRun = (projections: ProjectionDetail[]): DeterministicStressRun => {
    const finalNetworth = projections[projections.length - 1]?.networth ?? 0
    const minNetworth = Math.min(...projections.map(p => p.networth ?? 0))
    const retProj = projections.filter(p => (p.age ?? 0) >= retirementAge)
    const yearsWithNegativeCashFlow = retProj.filter(p => (p.gap_excess ?? 0) < -1).length
    const success = finalNetworth > 0
    return { finalNetworth, minNetworth, yearsWithNegativeCashFlow, success, projections }
  }

  const scenarios: DeterministicStressScenarioResult[] = []

  for (const scenario of STRESS_TEST_SCENARIOS) {
    const bearSequence = [...scenario.sequence]
    const bearYears = bearSequence.length
    const normalYears = Math.max(1, retirementYears - bearYears)

    const bearProduct = bearSequence.reduce((prod, r) => prod * (1 + r), 1)
    const targetProduct = Math.pow(1 + g, retirementYears)
    const recoveryRate = Math.pow(targetProduct / bearProduct, 1 / normalYears) - 1

    const fullSequence = [
      ...bearSequence,
      ...Array(normalYears).fill(recoveryRate),
    ]

    const stressProjections = calculateRetirementProjections(
      birthYear,
      accounts,
      expenses,
      otherIncome,
      { ...baseSettings, retirement_return_sequence: fullSequence },
      lifeExpectancy
    )

    const run = toRun(stressProjections)
    const maxDrawdownPct = computeMaxDrawdown(run.projections)

    scenarios.push({
      name: scenario.name,
      bearSequencePct: bearSequence.map(r => r * 100),
      recoveryRatePct: Math.round(recoveryRate * 10000) / 100,
      run,
      maxDrawdownPct,
    })
  }

  return {
    baseline: toRun(baselineProjections),
    scenarios,
    initialNetworth,
    retirementAge,
  }
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

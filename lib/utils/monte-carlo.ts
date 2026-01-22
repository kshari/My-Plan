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
  projections: ProjectionDetail[]
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
  percentile25: number
  percentile75: number
  percentile90: number
  percentile95: number
}

/**
 * Run Monte Carlo simulation with variable market returns
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

  for (let sim = 0; sim < numSimulations; sim++) {
    // Generate random market returns using normal distribution
    // Before retirement: mean = base rate, std dev = 15%
    // During retirement: mean = base rate, std dev = 12%
    const beforeRetirementReturn = generateNormalRandom(
      baseSettings.growth_rate_before_retirement,
      0.15 // 15% standard deviation
    )
    const duringRetirementReturn = generateNormalRandom(
      baseSettings.growth_rate_during_retirement,
      0.12 // 12% standard deviation
    )

    // Create modified settings with random returns
    const modifiedSettings: CalculatorSettings = {
      ...baseSettings,
      growth_rate_before_retirement: Math.max(0, beforeRetirementReturn), // Ensure non-negative
      growth_rate_during_retirement: Math.max(0, duringRetirementReturn),
    }

    // Calculate projections with modified returns
    const projections = calculateRetirementProjections(
      birthYear,
      accounts,
      expenses,
      otherIncome,
      modifiedSettings,
      lifeExpectancy
    )

    // Analyze results
    const finalNetworth = projections[projections.length - 1]?.networth || 0
    const minNetworth = Math.min(...projections.map(p => p.networth || 0))
    const yearsWithNegativeCashFlow = projections.filter(p => (p.gap_excess || 0) < 0).length
    const totalTaxes = projections.reduce((sum, p) => sum + (p.tax || 0), 0)
    const success = finalNetworth > 0 && yearsWithNegativeCashFlow < projections.length * 0.2

    results.push({
      simulation: sim + 1,
      success,
      finalNetworth,
      minNetworth,
      yearsWithNegativeCashFlow,
      totalTaxes,
      projections,
    })
  }

  // Calculate summary statistics
  const successful = results.filter(r => r.success).length
  const finalNetworths = results.map(r => r.finalNetworth).sort((a, b) => a - b)
  const minNetworths = results.map(r => r.minNetworth)
  
  const summary: MonteCarloSummary = {
    successRate: (successful / numSimulations) * 100,
    averageFinalNetworth: finalNetworths.reduce((a, b) => a + b, 0) / finalNetworths.length,
    medianFinalNetworth: finalNetworths[Math.floor(finalNetworths.length / 2)],
    minFinalNetworth: Math.min(...finalNetworths),
    maxFinalNetworth: Math.max(...finalNetworths),
    averageMinNetworth: minNetworths.reduce((a, b) => a + b, 0) / minNetworths.length,
    averageYearsWithNegativeCashFlow: results.reduce((sum, r) => sum + r.yearsWithNegativeCashFlow, 0) / results.length,
    averageTotalTaxes: results.reduce((sum, r) => sum + r.totalTaxes, 0) / results.length,
    percentile25: finalNetworths[Math.floor(finalNetworths.length * 0.25)],
    percentile75: finalNetworths[Math.floor(finalNetworths.length * 0.75)],
    percentile90: finalNetworths[Math.floor(finalNetworths.length * 0.90)],
    percentile95: finalNetworths[Math.floor(finalNetworths.length * 0.95)],
  }

  return { results, summary }
}

/**
 * Generate random number from normal distribution using Box-Muller transform
 */
function generateNormalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z0 * stdDev
}

/**
 * Analyze sequence of returns risk
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
    return {
      worstCaseSequence: 0,
      bestCaseSequence: 0,
      averageSequence: 0,
      riskLevel: 'Low',
      description: 'No projections available'
    }
  }

  // Find retirement start index
  const retirementStartIndex = projections.findIndex(p => p.age && p.age >= retirementAge)
  
  if (retirementStartIndex === -1) {
    return {
      worstCaseSequence: 0,
      bestCaseSequence: 0,
      averageSequence: 0,
      riskLevel: 'Low',
      description: 'Retirement not yet reached'
    }
  }

  // Analyze first 10 years of retirement (critical period)
  const retirementYears = projections.slice(retirementStartIndex, retirementStartIndex + 10)
  const initialBalance = projections[retirementStartIndex]?.networth || 0
  const finalBalance = retirementYears[retirementYears.length - 1]?.networth || 0
  
  // Calculate returns for each year
  const returns = retirementYears.map((proj, index) => {
    if (index === 0) return 0
    const prevBalance = retirementYears[index - 1]?.networth || 0
    const currentBalance = proj.networth || 0
    const withdrawals = (proj.distribution_401k || 0) + (proj.distribution_roth || 0) + 
                       (proj.distribution_taxable || 0) + (proj.distribution_other || 0)
    // Approximate return: (current - prev + withdrawals) / prev
    return prevBalance > 0 ? ((currentBalance - prevBalance + withdrawals) / prevBalance) : 0
  })

  const worstCaseSequence = Math.min(...returns.filter(r => r !== 0))
  const bestCaseSequence = Math.max(...returns.filter(r => r !== 0))
  const averageSequence = returns.filter(r => r !== 0).reduce((a, b) => a + b, 0) / returns.filter(r => r !== 0).length

  // Assess risk based on worst case
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
    worstCaseSequence: worstCaseSequence * 100, // Convert to percentage
    bestCaseSequence: bestCaseSequence * 100,
    averageSequence: averageSequence * 100,
    riskLevel,
    description,
  }
}

/**
 * Shared IRR (Internal Rate of Return) utilities for property scenarios.
 *
 * Computes the forward-looking IRR a property investor would earn if they
 * bought today (paying their actual cash invested at closing) and sold at the
 * end of year N at the appreciated value, net of sale costs and remaining
 * loan balance.
 *
 * Used by:
 *   - pl-table.tsx           (year-by-year IRR column)
 *   - financial-metrics.tsx  (Year-1 IRR investment metric)
 *   - deal-workspace.tsx     (Year-3 / Year-10 IRR in Investment Summary)
 *   - scenario-comparison-table.tsx (Year-3 / Year-10 IRR rows)
 *
 * The Year-0 basis for property-value projection is the scenario's
 * `Current Market Value` when present, otherwise `Purchase Price`. The cash
 * actually invested at acquisition stays based on Purchase Price + DP +
 * closing costs (what the investor really paid) — only the appreciation
 * trajectory shifts.
 */

import {
  IRR_INITIAL_GUESS,
  IRR_TOLERANCE,
  IRR_MAX_ITERATIONS,
  BALANCE_THRESHOLD,
  DEFAULT_SALE_COST_PCT,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'

/** Newton-Raphson IRR solver. Returns IRR as a percent (e.g. 12.3 = 12.3%). */
export function calculateIRR(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0

  const hasNegative = cashFlows.some(cf => cf < 0)
  const hasPositive = cashFlows.some(cf => cf > 0)
  if (!hasNegative || !hasPositive) return 0

  let irr = IRR_INITIAL_GUESS

  for (let i = 0; i < IRR_MAX_ITERATIONS; i++) {
    let npv = 0
    let npvDerivative = 0

    for (let j = 0; j < cashFlows.length; j++) {
      const discountFactor = Math.pow(1 + irr, j)
      if (isFinite(discountFactor) && discountFactor !== 0) {
        npv += cashFlows[j] / discountFactor
        if (j > 0) {
          npvDerivative -= (j * cashFlows[j]) / (discountFactor * (1 + irr))
        }
      }
    }

    if (Math.abs(npv) < IRR_TOLERANCE) break
    if (Math.abs(npvDerivative) < IRR_TOLERANCE || !isFinite(npvDerivative)) break

    const newIrr = irr - npv / npvDerivative
    if (!isFinite(newIrr) || newIrr < -0.99 || newIrr > 0.99) break
    irr = newIrr
  }

  const result = irr * 100
  if (!isFinite(result) || result < -99 || result > 99) return 0
  return result
}

export interface YearProjection {
  year: number
  cashFlow: number
  propertyValue: number
  remainingLoanBalance: number
  equity: number
}

/**
 * Project a scenario forward `years` years. Returns the cash flow, property
 * value, remaining loan balance, and equity at the end of each year.
 *
 * The growth/appreciation rates and Year-0 basis live on the scenario itself,
 * so this is a pure function of the scenario record + horizon.
 */
export interface ScenarioProjection {
  totalCashInvested: number
  rows: YearProjection[]
  saleCostRate: number
}

export function projectScenario(
  scenario: Record<string, unknown>,
  years: number,
): ScenarioProjection {
  const purchasePrice = parseFloat(String(scenario['Purchase Price'] ?? 0)) || 0
  const rawCMV = scenario['Current Market Value']
  const parsedCMV = rawCMV == null || rawCMV === '' ? 0 : (parseFloat(String(rawCMV)) || 0)
  const projectionBasis = parsedCMV > 0 ? parsedCMV : purchasePrice

  const baseGrossIncome = parseFloat(String(scenario['Gross Income'] ?? 0)) || 0
  const baseOperatingExpenses = parseFloat(String(scenario['Operating Expenses'] ?? 0)) || 0
  const vacancyRate = parseFloat(String(scenario['Vacancy Rate'] ?? 0)) || 0
  const propMgmtRate = parseFloat(String(scenario['Property Management Rate'] ?? 0)) || 0

  // Default growth rates match the rest of the app (Base Scenario seed = 3%).
  const incomeGrowth = parseFloat(String(scenario['Income Increase'] ?? 3)) || 0
  const expensesGrowth = parseFloat(String(scenario['Expenses Increase'] ?? 3)) || 0
  const propertyValueGrowth = parseFloat(String(scenario['Property Value Increase'] ?? 3)) || 0

  const hasLoan = !!scenario['Has Loan']
  const loanTerm = parseInt(String(scenario['Loan Term'] ?? 0)) || 0
  const interestRate = parseFloat(String(scenario['Interest Rate'] ?? 0)) || 0
  const downPaymentAmount = parseFloat(String(scenario['Down Payment Amount'] ?? 0)) || 0
  const loanClosingCosts = parseFloat(String(scenario['Closing Costs'] ?? 0)) || 0
  const purchaseClosingCosts = parseFloat(String(scenario['Purchase Closing Costs'] ?? 0)) || 0
  const loanPrincipal = Math.max(0, purchasePrice - downPaymentAmount)

  // Mortgage payment derived from loan fields (consistent with pl-table.tsx).
  let monthlyMortgage = parseFloat(String(scenario['Monthly Mortgage'] ?? 0)) || 0
  if (monthlyMortgage <= 0 && hasLoan && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
    const mr = interestRate / 100 / MONTHS_PER_YEAR
    const np = loanTerm * MONTHS_PER_YEAR
    monthlyMortgage = loanPrincipal * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
  }

  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  // Pre-compute the full amortization schedule once so multi-year IRRs don't
  // re-walk months repeatedly.
  const amortization: { interest: number; principal: number; balance: number }[] = []
  if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0 && monthlyMortgage > 0) {
    const monthlyRate = interestRate / 100 / MONTHS_PER_YEAR
    const totalPayments = loanTerm * MONTHS_PER_YEAR
    let balance = loanPrincipal
    for (let year = 1; year <= Math.max(years, loanTerm); year++) {
      let yearInterest = 0
      let yearPrincipal = 0
      for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
        const paymentNum = (year - 1) * MONTHS_PER_YEAR + month
        if (paymentNum <= totalPayments && balance > BALANCE_THRESHOLD) {
          const interestPayment = balance * monthlyRate
          const principalPayment = Math.min(monthlyMortgage - interestPayment, balance)
          yearInterest += interestPayment
          yearPrincipal += Math.max(0, principalPayment)
          balance = Math.max(0, balance - principalPayment)
        }
      }
      amortization.push({ interest: yearInterest, principal: yearPrincipal, balance })
    }
  }

  const rows: YearProjection[] = []
  let remainingLoanBalance = hasLoan ? loanPrincipal : 0

  for (let year = 1; year <= years; year++) {
    const incomeMultiplier = year === 1 ? 1 : Math.pow(1 + incomeGrowth / 100, year - 1)
    const expensesMultiplier = year === 1 ? 1 : Math.pow(1 + expensesGrowth / 100, year - 1)
    const propertyValueMultiplier = Math.pow(1 + propertyValueGrowth / 100, year)

    const grossIncome = baseGrossIncome * incomeMultiplier
    const operatingExpenses = baseOperatingExpenses * expensesMultiplier
    const propertyValue = projectionBasis * propertyValueMultiplier

    const vacancyLoss = grossIncome * (vacancyRate / 100)
    const effectiveIncome = grossIncome - vacancyLoss
    const propMgmtExpense = effectiveIncome * (propMgmtRate / 100)
    const totalExpenses = operatingExpenses + propMgmtExpense
    const noi = effectiveIncome - totalExpenses

    let interest = 0
    let principal = 0
    if (hasLoan && amortization.length > 0) {
      const yearData = amortization[year - 1]
      if (yearData) {
        interest = yearData.interest
        principal = yearData.principal
        remainingLoanBalance = yearData.balance
      } else {
        // Past loan payoff — no debt service, balance stays at 0.
        remainingLoanBalance = 0
      }
    }

    const cashFlow = hasLoan ? noi - interest - principal : noi
    const equity = hasLoan ? propertyValue - remainingLoanBalance : propertyValue

    rows.push({
      year,
      cashFlow,
      propertyValue,
      remainingLoanBalance: hasLoan ? remainingLoanBalance : 0,
      equity,
    })
  }

  const rawSaleCostRate = scenario['Sale Cost Rate']
  const saleCostRate = rawSaleCostRate === null || rawSaleCostRate === undefined || rawSaleCostRate === ''
    ? DEFAULT_SALE_COST_PCT
    : (parseFloat(String(rawSaleCostRate)) || 0)

  return { totalCashInvested, rows, saleCostRate }
}

/**
 * IRR assuming the property is bought today and sold at the end of `years`
 * at its appreciated value, net of sale costs and remaining loan balance.
 *
 * Returns IRR as a percent. Returns null when the scenario doesn't have the
 * inputs to compute one (zero price / zero cash invested), so callers can
 * render `—` instead of a misleading `0%`.
 */
export function computeIrrForHoldingPeriod(
  scenario: Record<string, unknown>,
  years: number,
): number | null {
  if (years < 1) return null
  return computeIrrFromProjection(projectScenario(scenario, years), years)
}

/**
 * Same IRR calculation as `computeIrrForHoldingPeriod` but reusing a
 * pre-computed projection so callers that already extract multi-year metrics
 * (cash flow, CoC, IRR) from a single scenario don't have to walk the
 * amortization schedule repeatedly. Pass a projection with at least `years`
 * rows.
 */
export function computeIrrFromProjection(
  projection: ScenarioProjection,
  years: number,
): number | null {
  if (years < 1) return null
  const { totalCashInvested, rows, saleCostRate } = projection
  if (totalCashInvested <= 0 || rows.length < years) return null

  const cashFlows: number[] = [-totalCashInvested]
  for (let i = 0; i < years; i++) {
    if (i === years - 1) {
      const saleCost = rows[i].propertyValue * (saleCostRate / 100)
      const netSaleProceeds = rows[i].equity - saleCost
      cashFlows.push(rows[i].cashFlow + netSaleProceeds)
    } else {
      cashFlows.push(rows[i].cashFlow)
    }
  }

  return calculateIRR(cashFlows)
}

export interface YearMetricSet {
  /** Annual cash flow at year N, or null if the projection couldn't reach year N. */
  cashFlow: number | null
  /** Cash-on-Cash return at year N (cashFlow / totalCashInvested × 100). Null when
   *  totalCashInvested is 0 or the projection is too short. */
  cocr: number | null
  /** IRR assuming sale at the end of year N. Null when not computable. */
  irr: number | null
}

/**
 * Compute Cash Flow, CoC, and IRR at each requested year from a single
 * scenario record. Internally projects once for `max(years)` years and pulls
 * the per-year numbers out — useful for the comparison table where each
 * scenario needs the same trio at multiple horizons (Y1/Y3/Y5/Y10).
 */
export function computeYearMetrics(
  scenario: Record<string, unknown>,
  years: number[],
): Record<number, YearMetricSet> {
  const out: Record<number, YearMetricSet> = {}
  if (years.length === 0) return out

  const horizon = Math.max(...years)
  const projection = projectScenario(scenario, horizon)
  const { totalCashInvested, rows } = projection

  for (const yr of years) {
    if (yr < 1 || yr > rows.length) {
      out[yr] = { cashFlow: null, cocr: null, irr: null }
      continue
    }
    const row = rows[yr - 1]
    const cashFlow = row.cashFlow
    const cocr = totalCashInvested > 0 ? (cashFlow / totalCashInvested) * 100 : null
    const irr = computeIrrFromProjection(projection, yr)
    out[yr] = { cashFlow, cocr, irr }
  }

  return out
}

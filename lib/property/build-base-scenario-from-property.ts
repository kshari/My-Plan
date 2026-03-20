/**
 * Builds scenario + loan objects that match pi_financial_scenarios / pi_loans shape
 * using property listing fields and global analysis defaults (same idea as dashboard quick analysis).
 */
import {
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_CLOSING_COST_PCT,
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_LOAN_TERM,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'

/** Minimal property shape (pi_properties or team_shared_properties) */
export type PropertyForBaseScenario = {
  'Asking Price'?: number | null
  'Gross Income'?: number | null
  'Operating Expenses'?: number | null
  estimated_rent?: number | null
}

export const BASE_SCENARIO_NAME = 'Base scenario (property defaults)'
export const BASE_SCENARIO_SLUG = 'base'

function firstYearAmortization(
  loanPrincipal: number,
  annualRatePct: number,
  loanTermYears: number,
  monthlyPayment: number,
): { firstYearInterest: number; firstYearPrincipal: number } {
  if (loanPrincipal <= 0 || monthlyPayment <= 0) {
    return { firstYearInterest: 0, firstYearPrincipal: 0 }
  }
  const monthlyRate = annualRatePct / 100 / MONTHS_PER_YEAR
  let balance = loanPrincipal
  let firstYearInterest = 0
  let firstYearPrincipal = 0
  const n = loanTermYears * MONTHS_PER_YEAR
  for (let month = 1; month <= MONTHS_PER_YEAR && month <= n; month++) {
    const interestPayment = balance * monthlyRate
    const principalPayment = Math.min(monthlyPayment - interestPayment, balance)
    firstYearInterest += interestPayment
    firstYearPrincipal += principalPayment > 0 ? principalPayment : 0
    balance = Math.max(0, balance - principalPayment)
  }
  return { firstYearInterest, firstYearPrincipal }
}

export function buildBaseScenarioFromProperty(property: PropertyForBaseScenario): {
  scenario: Record<string, unknown>
  loan: Record<string, unknown> | null
} {
  const askingPrice = Number(property['Asking Price'] ?? 0) || 0

  const monthlyRent = Number(property.estimated_rent ?? property['Gross Income'] ?? 0) || 0
  const monthlyGrossIncome = Number(property['Gross Income'] ?? property.estimated_rent ?? 0) || 0
  const monthlyIncome = monthlyRent > 0 ? monthlyRent : monthlyGrossIncome
  const monthlyExpenses = Number(property['Operating Expenses'] ?? 0) || 0

  const annualGross = monthlyIncome * MONTHS_PER_YEAR
  const annualOperatingExpenses = monthlyExpenses * MONTHS_PER_YEAR
  const noi = annualGross - annualOperatingExpenses

  const downPct = DEFAULT_DOWN_PAYMENT_PCT
  const downPayment = askingPrice > 0 ? askingPrice * (downPct / 100) : 0
  const purchaseClosingCosts = askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
  const loanPrincipal = askingPrice > 0 ? askingPrice - downPayment : 0
  const loanClosingCosts =
    loanPrincipal > 0 ? loanPrincipal * (DEFAULT_CLOSING_COST_PCT / 100) : 0

  let hasLoan = false
  let monthlyPayment = 0
  let annualMortgage = 0
  let firstYearInterest = 0
  let firstYearPrincipal = 0
  let interestRate = DEFAULT_ANALYSIS_INTEREST_RATE
  let loanTerm = DEFAULT_LOAN_TERM

  if (askingPrice > 0 && loanPrincipal > 0) {
    hasLoan = true
    const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
    const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
    monthlyPayment =
      monthlyRate > 0 && numPayments > 0
        ? loanPrincipal *
          ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
            (Math.pow(1 + monthlyRate, numPayments) - 1))
        : 0
    annualMortgage = monthlyPayment * MONTHS_PER_YEAR
    ;({ firstYearInterest, firstYearPrincipal } = firstYearAmortization(
      loanPrincipal,
      DEFAULT_ANALYSIS_INTEREST_RATE,
      DEFAULT_LOAN_TERM,
      monthlyPayment,
    ))
  }

  const netIncome = hasLoan ? noi - firstYearInterest : noi
  const capRate = askingPrice > 0 && noi > 0 ? (noi / askingPrice) * 100 : 0

  const scenario: Record<string, unknown> = {
    'Scenario Name': BASE_SCENARIO_NAME,
    'Purchase Price': askingPrice,
    'Gross Income': annualGross,
    'Operating Expenses': annualOperatingExpenses,
    'Cap Rate': capRate,
    'Net Income': netIncome,
    'Taxable Income After Depreciation': null,
    'Income Increase': 0,
    'Expenses Increase': 0,
    'Property Value Increase': 0,
    'Has Loan': hasLoan,
    'Loan Term': hasLoan ? loanTerm : null,
    'Down Payment Percentage': hasLoan ? downPct : null,
    'Down Payment Amount': hasLoan ? downPayment : null,
    'Interest Rate': hasLoan ? interestRate : null,
    'Closing Costs': hasLoan ? loanClosingCosts : null,
    'Purchase Closing Costs': purchaseClosingCosts,
    'Monthly Mortgage': hasLoan ? monthlyPayment : null,
    'Annual Interest': hasLoan ? firstYearInterest : null,
    'Annual Principal': hasLoan ? firstYearPrincipal : null,
    'expense_breakdown': null,
  }

  if (!hasLoan) {
    return { scenario, loan: null }
  }

  const loan: Record<string, unknown> = {
    'Loan Term': loanTerm,
    'Down Payment Percentage': downPct,
    'Down Payment Amount': downPayment,
    'Purchase Price': askingPrice,
    'Interest Rate': interestRate,
    'Monthly Mortgage': monthlyPayment,
    'Monthly Principal': firstYearPrincipal / MONTHS_PER_YEAR,
    'Monthly Interest': firstYearInterest / MONTHS_PER_YEAR,
    'Closing Costs': loanClosingCosts,
    'Annual Mortgage': annualMortgage,
    'Annual Principal': firstYearPrincipal,
    'Annual Interest': firstYearInterest,
  }

  return { scenario, loan }
}

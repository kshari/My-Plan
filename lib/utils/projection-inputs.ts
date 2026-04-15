/**
 * Shared utility for building identical inputs to calculateRetirementProjections.
 *
 * Both the Strategy Comparison (details-tab) and the Tax Efficiency Roth simulation
 * call calculateRetirementProjections.  Historically they built their inputs
 * independently, leading to subtle mismatches in field names, SSA parameters, and
 * settings construction that produced different tax totals for the "same" strategy.
 *
 * This module is the single source of truth for that mapping logic.
 */

import {
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
} from '@/lib/utils/retirement-projections'
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_SSA_START_AGE,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
} from '@/lib/constants/retirement-defaults'

// ---------------------------------------------------------------------------
// Return type — everything a caller needs to invoke calculateRetirementProjections
// ---------------------------------------------------------------------------

export interface ProjectionInputs {
  birthYear: number
  lifeExpectancy: number
  accounts: Account[]
  expenses: Expense[]
  otherIncome: OtherIncome[]
  /** Full settings built by buildCalculatorSettings (includes ssa_start_age, priorities, etc.) */
  baseSettings: CalculatorSettings
  spouseBirthYear: number | undefined
  spouseLifeExpectancy: number | undefined
  includePlannerSsa: boolean
  includeSpouseSsa: boolean
  estimatedPlannerSsaAtStart: number | undefined
  estimatedSpouseSsaAtStart: number | undefined
}

// ---------------------------------------------------------------------------
// Individual mappers (exported so callers that only need one piece can use them)
// ---------------------------------------------------------------------------

export function mapAccounts(rows: any[]): Account[] {
  return (rows || []).map(acc => ({
    id: acc.id,
    account_name: acc.account_name || '',
    owner: acc.owner || 'planner',
    account_type: acc.account_type || 'Other',
    balance: acc.balance || 0,
    annual_contribution: acc.annual_contribution || 0,
  }))
}

export function mapExpenses(rows: any[]): Expense[] {
  return (rows || []).map(exp => ({
    id: exp.id,
    expense_name: exp.expense_name || '',
    // Engine reads amount_before_65 / amount_after_65 — NOT annual_amount
    amount_before_65: exp.amount_before_65 || 0,
    amount_after_65: exp.amount_after_65 || 0,
  }))
}

export function mapOtherIncome(rows: any[]): OtherIncome[] {
  return (rows || []).map(inc => ({
    id: inc.id,
    // DB column is income_source; engine field is income_name
    income_name: inc.income_source || inc.income_name || '',
    // Engine reads amount / start_year / end_year — NOT annual_amount / start_age
    amount: inc.annual_amount || inc.amount || 0,
    start_year: inc.start_year ?? undefined,
    end_year: inc.end_year ?? undefined,
    inflation_adjusted: inc.inflation_adjusted || false,
  }))
}

// ---------------------------------------------------------------------------
// Master builder
// ---------------------------------------------------------------------------

/**
 * Build all inputs required to call calculateRetirementProjections from raw
 * Supabase row data.  Used by Strategy Comparison and Tax Efficiency so both
 * produce numerically identical projections for the same strategy.
 *
 * @param planRow       Row from rp_retirement_plans
 * @param settingsRow   Row from rp_calculator_settings (for the selected scenario)
 * @param accountRows   Rows from rp_accounts
 * @param expenseRows   Rows from rp_expenses
 * @param otherIncomeRows Rows from rp_other_income
 */
export function buildProjectionInputs(
  planRow: any,
  settingsRow: any,
  accountRows: any[],
  expenseRows: any[],
  otherIncomeRows: any[],
): ProjectionInputs {
  const currentYear = settingsRow?.current_year || new Date().getFullYear()
  const birthYear: number = planRow?.birth_year ?? currentYear - 50
  const retirementAge: number = settingsRow?.retirement_age || DEFAULT_RETIREMENT_AGE
  const yearsToRetirement = retirementAge - (currentYear - birthYear)

  const expenses = mapExpenses(expenseRows)
  const otherIncome = mapOtherIncome(otherIncomeRows)
  const accounts = mapAccounts(accountRows)

  // Annual expenses derived the same way as details-tab: use the age-appropriate
  // amount tier, multiply by 12.
  const annualExpenses =
    expenses.reduce((sum, exp) => {
      const amount = retirementAge >= 65 ? (exp.amount_after_65 || 0) : (exp.amount_before_65 || 0)
      return sum + amount
    }, 0) * 12

  const baseSettings = buildCalculatorSettings(
    settingsRow,
    planRow,
    currentYear,
    retirementAge,
    yearsToRetirement,
    annualExpenses,
  )

  // ---------------------------------------------------------------------------
  // SSA inclusion flags — exact mirror of details-tab logic
  // ---------------------------------------------------------------------------
  const includePlannerSsa: boolean =
    settingsRow?.planner_ssa_income !== undefined ? !!settingsRow.planner_ssa_income : true

  const explicitSpouseSsa = settingsRow?.spouse_ssa_income !== undefined
    ? !!settingsRow.spouse_ssa_income
    : false
  const hasSpouse = !!planRow?.include_spouse
  const isMarriedFilingJointly = planRow?.filing_status === 'Married Filing Jointly'
  const isSingleFiler = planRow?.filing_status === 'Single'
  const includeSpouseSsa: boolean =
    !isSingleFiler && (explicitSpouseSsa || hasSpouse || isMarriedFilingJointly)

  // ---------------------------------------------------------------------------
  // Estimated SSA benefits at claiming age (inflation-adjusted to claiming year)
  // ---------------------------------------------------------------------------
  const estimatedIncomeForSsa = Number(settingsRow?.estimated_ssa_annual_income) || 0

  const plannerBenefit = settingsRow?.planner_ssa_annual_benefit != null
    ? Number(settingsRow.planner_ssa_annual_benefit)
    : includePlannerSsa
      ? estimatedIncomeForSsa > 0
        ? calculateEstimatedSSA(estimatedIncomeForSsa, true)
        : DEFAULT_SSA_ANNUAL_BENEFIT
      : 0

  const spouseBenefit = settingsRow?.spouse_ssa_annual_benefit != null
    ? Number(settingsRow.spouse_ssa_annual_benefit)
    : includeSpouseSsa
      ? estimatedIncomeForSsa > 0
        ? calculateEstimatedSSA(estimatedIncomeForSsa, false)
        : DEFAULT_SPOUSE_SSA_BENEFIT
      : 0

  const ssaStartAge = baseSettings.ssa_start_age || retirementAge || DEFAULT_SSA_START_AGE
  const currentAge = currentYear - birthYear
  const yearsToSsaStart = Math.max(0, ssaStartAge - currentAge)
  const inflationToSsaStart = Math.pow(1 + baseSettings.inflation_rate, yearsToSsaStart)

  // Spouse may be a different age; compute their own years-to-SSA-start so their benefit
  // is inflated over the correct horizon rather than the planner's horizon.
  const spouseBirthYearVal = planRow?.spouse_birth_year
  const spouseCurrentAge = spouseBirthYearVal ? currentYear - spouseBirthYearVal : null
  const spouseYearsToSsaStart = spouseCurrentAge !== null
    ? Math.max(0, ssaStartAge - spouseCurrentAge)
    : yearsToSsaStart
  const spouseInflationToSsaStart = Math.pow(1 + baseSettings.inflation_rate, spouseYearsToSsaStart)

  const estimatedPlannerSsaAtStart = includePlannerSsa
    ? plannerBenefit * inflationToSsaStart
    : undefined
  const estimatedSpouseSsaAtStart = includeSpouseSsa
    ? spouseBenefit * spouseInflationToSsaStart
    : undefined

  return {
    birthYear,
    lifeExpectancy: planRow?.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
    accounts,
    expenses,
    otherIncome,
    baseSettings,
    spouseBirthYear: planRow?.spouse_birth_year ?? undefined,
    spouseLifeExpectancy: planRow?.spouse_life_expectancy ?? undefined,
    includePlannerSsa,
    includeSpouseSsa,
    estimatedPlannerSsaAtStart,
    estimatedSpouseSsaAtStart,
  }
}

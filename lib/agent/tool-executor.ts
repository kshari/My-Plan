/**
 * Server-side executor for 'read' and 'calculate' agent tools.
 *
 * Each function validates inputs, fetches data from Supabase, runs the
 * appropriate calculation utility, and returns a serialisable JSON result
 * that will be injected back into the LLM conversation as a tool result.
 *
 * Mutation tools are NOT handled here — they go through the existing
 * actions.ts / execute route and are shown to the user for confirmation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateProgressiveTax,
  type Account,
  type Expense,
  type OtherIncome,
} from '@/lib/utils/retirement-projections'
import { runMonteCarloSimulation } from '@/lib/utils/monte-carlo'
import { computeInvestmentScore, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'
import { simulateDebtPayoff, futureValue } from '@/lib/utils/pulse-calculations'
import { getStandardDeduction } from '@/lib/constants/tax-brackets'
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_MAX_PROJECTION_AGE,
} from '@/lib/constants/retirement-defaults'
import { calculateMarginalTaxRate } from '@/lib/utils/tax-calculations'

export type ToolResult =
  | { success: true; result: unknown }
  | { success: false; error: string }

// ── get_pulse_check_history ──────────────────────────────────────────────────

export async function toolGetPulseCheckHistory(
  supabase: SupabaseClient,
  userId: string,
  args: { limit?: number },
): Promise<ToolResult> {
  const limit = Math.min(Number(args.limit ?? 50), 200)
  const { data, error } = await supabase
    .from('fp_pulse_checks')
    .select('check_date, net_worth_snapshot, mood, resilience_score')
    .eq('user_id', userId)
    .order('check_date', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    result: {
      count: data?.length ?? 0,
      records: (data ?? []).map((c) => ({
        date: c.check_date,
        net_worth: c.net_worth_snapshot,
        mood: c.mood,
        resilience_score: c.resilience_score,
      })),
    },
  }
}

// ── get_retirement_scenario_projection ──────────────────────────────────────

export async function toolGetRetirementScenarioProjection(
  supabase: SupabaseClient,
  userId: string,
  args: { plan_id: number; scenario_id: number },
): Promise<ToolResult> {
  const planId = Number(args.plan_id)
  const scenarioId = Number(args.scenario_id)
  if (!planId || !scenarioId) return { success: false, error: 'plan_id and scenario_id are required' }

  // Verify ownership
  const { data: plan } = await supabase
    .from('rp_retirement_plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .single()
  if (!plan) return { success: false, error: 'Plan not found or unauthorized' }

  // Fetch stored projection details
  const { data: rows, error } = await supabase
    .from('rp_projection_details')
    .select('age, year, networth, income, expenses, tax, gap_excess, withdrawal_amount')
    .eq('scenario_id', scenarioId)
    .order('year', { ascending: true })

  if (error) return { success: false, error: error.message }
  if (!rows?.length) {
    return {
      success: true,
      result: {
        message: 'No projection data stored for this scenario yet. Use calculate_retirement_projection to compute it.',
        rows: [],
      },
    }
  }

  return {
    success: true,
    result: {
      scenario_id: scenarioId,
      years_count: rows.length,
      rows: rows.map((r) => ({
        age: r.age,
        year: r.year,
        net_worth: Math.round(r.networth ?? 0),
        income: Math.round(r.income ?? 0),
        expenses: Math.round(r.expenses ?? 0),
        tax: Math.round(r.tax ?? 0),
        gap_excess: Math.round(r.gap_excess ?? 0),
        withdrawal: Math.round(r.withdrawal_amount ?? 0),
      })),
    },
  }
}

// ── get_property_financial_scenarios ────────────────────────────────────────

export async function toolGetPropertyFinancialScenarios(
  supabase: SupabaseClient,
  userId: string,
  args: { property_id: number },
): Promise<ToolResult> {
  const propertyId = Number(args.property_id)
  if (!propertyId) return { success: false, error: 'property_id is required' }

  // Verify ownership
  const { data: prop } = await supabase
    .from('pi_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('user_id', userId)
    .single()
  if (!prop) return { success: false, error: 'Property not found or unauthorized' }

  const { data, error } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    result: {
      property_id: propertyId,
      scenario_count: data?.length ?? 0,
      scenarios: data ?? [],
    },
  }
}

// ── calculate_future_value ───────────────────────────────────────────────────

export async function toolCalculateFutureValue(
  _supabase: SupabaseClient,
  _userId: string,
  args: { principal: number; annual_rate: number; years: number; monthly_contribution?: number },
): Promise<ToolResult> {
  const { principal, annual_rate, years } = args
  const monthly_contribution = Number(args.monthly_contribution ?? 0)

  if (principal == null || annual_rate == null || years == null) {
    return { success: false, error: 'principal, annual_rate, and years are required' }
  }
  if (years <= 0 || years > 100) return { success: false, error: 'years must be between 1 and 100' }
  if (annual_rate < -1 || annual_rate > 5) return { success: false, error: 'annual_rate should be a decimal like 0.07 for 7%' }

  const fv = futureValue(principal, monthly_contribution, annual_rate, years)
  const totalContributions = principal + monthly_contribution * 12 * years
  const totalGrowth = fv - totalContributions

  return {
    success: true,
    result: {
      future_value: Math.round(fv),
      total_contributions: Math.round(totalContributions),
      total_growth: Math.round(totalGrowth),
      annual_rate_pct: `${(annual_rate * 100).toFixed(2)}%`,
      years,
    },
  }
}

// ── calculate_retirement_projection ─────────────────────────────────────────

export async function toolCalculateRetirementProjection(
  supabase: SupabaseClient,
  userId: string,
  args: { plan_id: number; scenario_id: number },
): Promise<ToolResult> {
  const planId = Number(args.plan_id)
  const scenarioId = Number(args.scenario_id)
  if (!planId || !scenarioId) return { success: false, error: 'plan_id and scenario_id are required' }

  // Load all plan data
  const [planRes, accountsRes, expensesRes, incomeRes, settingsRes] = await Promise.all([
    supabase
      .from('rp_retirement_plans')
      .select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy, filing_status')
      .eq('id', planId)
      .eq('user_id', userId)
      .single(),
    supabase.from('rp_accounts').select('*').eq('plan_id', planId),
    supabase.from('rp_expenses').select('*').eq('plan_id', planId),
    supabase.from('rp_other_income').select('*').eq('plan_id', planId),
    supabase.from('rp_calculator_settings').select('*').eq('scenario_id', scenarioId).single(),
  ])

  if (planRes.error || !planRes.data) return { success: false, error: 'Plan not found or unauthorized' }

  const planData = planRes.data
  if (!planData.birth_year) return { success: false, error: 'Plan is missing birth_year — please complete the plan setup' }

  const currentYear = new Date().getFullYear()
  const retirementAge = settingsRes.data?.retirement_age ?? DEFAULT_RETIREMENT_AGE
  const yearsToRetirement = Math.max(0, retirementAge - (currentYear - planData.birth_year))
  const lifeExpectancy = planData.life_expectancy ?? DEFAULT_MAX_PROJECTION_AGE

  const expensesData = expensesRes.data ?? []
  const annualExpenses = expensesData.reduce(
    (sum: number, e: Expense) => sum + Number(e.amount_before_65 ?? 0) * 12,
    0,
  )

  const settings = buildCalculatorSettings(
    settingsRes.data,
    planData,
    currentYear,
    retirementAge,
    yearsToRetirement,
    annualExpenses,
  )

  const accounts: Account[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    account_name: a.account_name ?? '',
    owner: a.owner ?? 'planner',
    balance: Number(a.balance ?? 0),
    account_type: a.account_type,
    annual_contribution: Number(a.annual_contribution ?? 0),
  }))

  const expenses: Expense[] = expensesData.map((e) => ({
    id: e.id,
    expense_name: e.expense_name ?? '',
    amount_before_65: Number(e.amount_before_65 ?? 0),
    amount_after_65: Number(e.amount_after_65 ?? 0),
  }))

  const otherIncome: OtherIncome[] = (incomeRes.data ?? []).map((i) => ({
    id: i.id,
    income_name: i.income_name ?? '',
    amount: Number(i.annual_amount ?? 0),
    start_year: i.start_age ? planData.birth_year + i.start_age : undefined,
    end_year: i.end_age ? planData.birth_year + i.end_age : undefined,
    inflation_adjusted: Boolean(i.cola),
  }))

  const projections = calculateRetirementProjections(
    planData.birth_year,
    accounts,
    expenses,
    otherIncome,
    settings,
    lifeExpectancy,
    planData.spouse_birth_year ?? undefined,
    planData.spouse_life_expectancy ?? undefined,
  )

  if (!projections.length) return { success: false, error: 'Projection engine returned no results' }

  const retirementProjections = projections.filter((p) => (p.age ?? 0) >= retirementAge)
  const atRetirement = retirementProjections[0]
  const lastProjection = projections[projections.length - 1]

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const portfolioAtRetirement = atRetirement?.networth ?? 0
  const finalNetworth = lastProjection?.networth ?? 0
  const yearsMoneyLasts = retirementProjections.findIndex((p) => (p.networth ?? 0) <= 0)
  const totalTaxes = projections.reduce((s, p) => s + (p.tax ?? 0), 0)
  const avgMonthlyRetirementIncome =
    retirementProjections.length > 0
      ? retirementProjections.reduce((s, p) => s + (p.total_income ?? 0), 0) /
        retirementProjections.length /
        12
      : 0

  // Confidence score: positive final networth = pass, score proportional to portfolio ratio
  const confidenceScore =
    finalNetworth > 0
      ? Math.min(100, Math.round((finalNetworth / (totalBalance || 1)) * 50 + 50))
      : Math.max(0, Math.round((finalNetworth / (totalBalance || 1)) * 50 + 50))

  return {
    success: true,
    result: {
      plan_id: planId,
      scenario_id: scenarioId,
      current_age: currentYear - planData.birth_year,
      retirement_age: retirementAge,
      life_expectancy: lifeExpectancy,
      current_portfolio_balance: Math.round(totalBalance),
      portfolio_at_retirement: Math.round(portfolioAtRetirement),
      final_net_worth: Math.round(finalNetworth),
      years_money_lasts: yearsMoneyLasts === -1 ? 'Full life expectancy' : `${yearsMoneyLasts} years into retirement`,
      avg_monthly_income_in_retirement: Math.round(avgMonthlyRetirementIncome),
      total_taxes_lifetime: Math.round(totalTaxes),
      confidence_score: confidenceScore,
      status: confidenceScore >= 80 ? 'on_track' : confidenceScore >= 60 ? 'close' : 'needs_attention',
    },
  }
}

// ── run_monte_carlo ──────────────────────────────────────────────────────────

export async function toolRunMonteCarlo(
  supabase: SupabaseClient,
  userId: string,
  args: { plan_id: number; scenario_id: number; num_simulations?: number },
): Promise<ToolResult> {
  const planId = Number(args.plan_id)
  const scenarioId = Number(args.scenario_id)
  const numSimulations = Math.min(Number(args.num_simulations ?? 500), 1000)

  if (!planId || !scenarioId) return { success: false, error: 'plan_id and scenario_id are required' }

  const [planRes, accountsRes, expensesRes, incomeRes, settingsRes] = await Promise.all([
    supabase
      .from('rp_retirement_plans')
      .select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy, filing_status')
      .eq('id', planId)
      .eq('user_id', userId)
      .single(),
    supabase.from('rp_accounts').select('*').eq('plan_id', planId),
    supabase.from('rp_expenses').select('*').eq('plan_id', planId),
    supabase.from('rp_other_income').select('*').eq('plan_id', planId),
    supabase.from('rp_calculator_settings').select('*').eq('scenario_id', scenarioId).single(),
  ])

  if (planRes.error || !planRes.data?.birth_year) {
    return { success: false, error: 'Plan not found, unauthorized, or missing birth_year' }
  }

  const planData = planRes.data
  const currentYear = new Date().getFullYear()
  const retirementAge = settingsRes.data?.retirement_age ?? DEFAULT_RETIREMENT_AGE
  const yearsToRetirement = Math.max(0, retirementAge - (currentYear - planData.birth_year))
  const lifeExpectancy = planData.life_expectancy ?? DEFAULT_MAX_PROJECTION_AGE

  const expensesData = expensesRes.data ?? []
  const annualExpenses = expensesData.reduce(
    (sum: number, e: Expense) => sum + Number(e.amount_before_65 ?? 0) * 12,
    0,
  )

  const settings = buildCalculatorSettings(
    settingsRes.data,
    planData,
    currentYear,
    retirementAge,
    yearsToRetirement,
    annualExpenses,
  )

  const accounts: Account[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    account_name: a.account_name ?? '',
    owner: a.owner ?? 'planner',
    balance: Number(a.balance ?? 0),
    account_type: a.account_type,
    annual_contribution: Number(a.annual_contribution ?? 0),
  }))

  const expenses: Expense[] = expensesData.map((e) => ({
    id: e.id,
    expense_name: e.expense_name ?? '',
    amount_before_65: Number(e.amount_before_65 ?? 0),
    amount_after_65: Number(e.amount_after_65 ?? 0),
  }))

  const otherIncome: OtherIncome[] = (incomeRes.data ?? []).map((i) => ({
    id: i.id,
    income_name: i.income_name ?? '',
    amount: Number(i.annual_amount ?? 0),
    start_year: i.start_age ? planData.birth_year + i.start_age : undefined,
    end_year: i.end_age ? planData.birth_year + i.end_age : undefined,
    inflation_adjusted: Boolean(i.cola),
  }))

  const { summary } = runMonteCarloSimulation(
    planData.birth_year,
    accounts,
    expenses,
    otherIncome,
    settings,
    lifeExpectancy,
    numSimulations,
  )

  return {
    success: true,
    result: {
      plan_id: planId,
      scenario_id: scenarioId,
      num_simulations: numSimulations,
      success_rate_pct: Math.round(summary.successRate * 100),
      median_final_net_worth: Math.round(summary.medianFinalNetworth),
      percentile_5_net_worth: Math.round(summary.percentile5),
      percentile_25_net_worth: Math.round(summary.percentile25),
      percentile_75_net_worth: Math.round(summary.percentile75),
      percentile_95_net_worth: Math.round(summary.percentile95),
      avg_years_negative_cashflow: Math.round(summary.averageYearsWithNegativeCashFlow * 10) / 10,
      risk_level:
        summary.successRate >= 0.9
          ? 'low'
          : summary.successRate >= 0.7
            ? 'moderate'
            : 'high',
    },
  }
}

// ── calculate_property_metrics ───────────────────────────────────────────────

export async function toolCalculatePropertyMetrics(
  supabase: SupabaseClient,
  userId: string,
  args: { property_id: number },
): Promise<ToolResult> {
  const propertyId = Number(args.property_id)
  if (!propertyId) return { success: false, error: 'property_id is required' }

  const { data: prop } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', userId)
    .single()
  if (!prop) return { success: false, error: 'Property not found or unauthorized' }

  // Fetch the first financial scenario for loan terms
  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('id', { ascending: true })
    .limit(1)

  const scenario = scenarios?.[0]
  const askingPrice = Number((prop as Record<string, unknown>)['Asking Price'] ?? 0)
  const grossIncome = Number((prop as Record<string, unknown>)['Gross Income'] ?? 0)
  const operatingExpenses = Number((prop as Record<string, unknown>)['Operating Expenses'] ?? 0)

  const noi = grossIncome - operatingExpenses
  const capRate = askingPrice > 0 ? (noi / askingPrice) * 100 : 0

  // Cash-on-cash return needs down payment from scenario
  const downPaymentPct = scenario
    ? Number((scenario as Record<string, unknown>)['Down Payment %'] ?? 25) / 100
    : 0.25
  const downPayment = askingPrice * downPaymentPct
  const closingCosts = askingPrice * 0.03
  const totalInvested = downPayment + closingCosts

  // Annual debt service from scenario, or estimate via mortgage calc
  let annualDebtService = 0
  if (scenario) {
    const monthlyMortgage = Number((scenario as Record<string, unknown>)['Monthly Mortgage'] ?? 0)
    annualDebtService = monthlyMortgage * 12
  } else if (askingPrice > 0) {
    const loanAmount = askingPrice * (1 - downPaymentPct)
    const monthlyRate = 0.07 / 12
    const n = 360
    const payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    annualDebtService = payment * 12
  }

  const annualCashFlow = noi - annualDebtService
  const roi = totalInvested > 0 ? (annualCashFlow / totalInvested) * 100 : 0

  const monthlyGrossIncome = grossIncome / 12
  const onePercentRatio = askingPrice > 0 ? (monthlyGrossIncome / askingPrice) * 100 : null
  const grm = grossIncome > 0 ? askingPrice / grossIncome : null

  const dscr = annualDebtService > 0 ? noi / annualDebtService : null

  const { score, components } = computeInvestmentScore(
    DEFAULT_SCORING_CONFIG,
    {
      capRate,
      roi,
      annualCashFlow,
      noiForCalcs: noi,
      onePercentRatio,
      grm,
    },
    (v) => `$${Math.abs(Math.round(v)).toLocaleString()}`,
  )

  return {
    success: true,
    result: {
      property_id: propertyId,
      asking_price: askingPrice,
      gross_annual_income: grossIncome,
      operating_expenses: operatingExpenses,
      noi: Math.round(noi),
      cap_rate_pct: Math.round(capRate * 100) / 100,
      annual_cash_flow: Math.round(annualCashFlow),
      cash_on_cash_return_pct: Math.round(roi * 100) / 100,
      one_percent_ratio_pct: onePercentRatio != null ? Math.round(onePercentRatio * 100) / 100 : null,
      grm: grm != null ? Math.round(grm * 10) / 10 : null,
      dscr: dscr != null ? Math.round(dscr * 100) / 100 : null,
      investment_score: score,
      score_components: components.map((c) => ({ label: c.label, pts: c.pts, max: c.maxPts, detail: c.description })),
    },
  }
}

// ── calculate_tax_estimate ───────────────────────────────────────────────────

export async function toolCalculateTaxEstimate(
  _supabase: SupabaseClient,
  _userId: string,
  args: { gross_income: number; filing_status: string },
): Promise<ToolResult> {
  const grossIncome = Number(args.gross_income)
  const filingStatus = args.filing_status

  if (!grossIncome || !filingStatus) {
    return { success: false, error: 'gross_income and filing_status are required' }
  }

  // Normalise filing status to match tax brackets format (capitalised)
  const statusMap: Record<string, string> = {
    single: 'Single',
    married_filing_jointly: 'Married Filing Jointly',
    married_filing_separately: 'Married Filing Separately',
    head_of_household: 'Head of Household',
  }
  const normalisedStatus = statusMap[filingStatus.toLowerCase()] ?? filingStatus

  const standardDeduction = getStandardDeduction(normalisedStatus)
  const taxableIncome = Math.max(0, grossIncome - standardDeduction)
  const taxOwed = calculateProgressiveTax(taxableIncome, normalisedStatus)
  const effectiveRate = grossIncome > 0 ? taxOwed / grossIncome : 0
  const marginalRate = calculateMarginalTaxRate(taxableIncome, normalisedStatus)

  return {
    success: true,
    result: {
      gross_income: Math.round(grossIncome),
      standard_deduction: standardDeduction,
      taxable_income: Math.round(taxableIncome),
      federal_tax_owed: Math.round(taxOwed),
      effective_tax_rate_pct: Math.round(effectiveRate * 1000) / 10,
      marginal_tax_rate_pct: Math.round(marginalRate * 100),
      filing_status: normalisedStatus,
      note: 'Federal income tax only (2024 brackets). Does not include FICA, state tax, itemized deductions, or credits.',
    },
  }
}

// ── calculate_debt_payoff ────────────────────────────────────────────────────

export async function toolCalculateDebtPayoff(
  supabase: SupabaseClient,
  userId: string,
  args: { extra_monthly_payment?: number },
): Promise<ToolResult> {
  const extra = Number(args.extra_monthly_payment ?? 0)

  const { data: profile } = await supabase
    .from('fp_profiles')
    .select('debts')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) return { success: false, error: 'Financial Pulse profile not found' }

  type RawDebt = { name?: string; balance?: number; interest_rate?: number; min_payment?: number }
  const rawDebts = (profile.debts as RawDebt[] | null) ?? []
  if (rawDebts.length === 0) {
    return { success: true, result: { message: 'No debts found in your Financial Pulse profile.' } }
  }

  const debts = rawDebts.map((d) => ({
    name: d.name ?? 'Debt',
    balance: Number(d.balance ?? 0),
    rate: Number(d.interest_rate ?? 6),
    min_payment: Number(d.min_payment ?? Math.ceil(Number(d.balance ?? 0) * 0.02)),
  }))

  const avalanche = simulateDebtPayoff(
    debts.map(({ balance, rate, min_payment }) => ({ balance, rate, min_payment })),
    extra,
    'avalanche',
  )
  const snowball = simulateDebtPayoff(
    debts.map(({ balance, rate, min_payment }) => ({ balance, rate, min_payment })),
    extra,
    'snowball',
  )

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0)
  const fmtMonths = (m: number) =>
    m === 0 ? 'already paid off' : `${Math.floor(m / 12)}y ${m % 12}m`

  return {
    success: true,
    result: {
      total_debt_balance: Math.round(totalBalance),
      extra_monthly_payment: extra,
      debts: debts.map((d) => ({
        name: d.name,
        balance: Math.round(d.balance),
        interest_rate_pct: d.rate,
        min_payment: d.min_payment,
      })),
      avalanche_strategy: {
        description: 'Pay highest-interest debt first — minimises total interest',
        months_to_payoff: avalanche.months,
        time_to_payoff: fmtMonths(avalanche.months),
        total_interest_paid: Math.round(avalanche.totalInterest),
      },
      snowball_strategy: {
        description: 'Pay lowest-balance debt first — builds momentum with quick wins',
        months_to_payoff: snowball.months,
        time_to_payoff: fmtMonths(snowball.months),
        total_interest_paid: Math.round(snowball.totalInterest),
      },
      interest_saved_by_avalanche: Math.round(snowball.totalInterest - avalanche.totalInterest),
    },
  }
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeReadOrCalcTool(
  toolName: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_pulse_check_history':
      return toolGetPulseCheckHistory(supabase, userId, args as { limit?: number })

    case 'get_retirement_scenario_projection':
      return toolGetRetirementScenarioProjection(supabase, userId, args as { plan_id: number; scenario_id: number })

    case 'get_property_financial_scenarios':
      return toolGetPropertyFinancialScenarios(supabase, userId, args as { property_id: number })

    case 'calculate_future_value':
      return toolCalculateFutureValue(supabase, userId, args as {
        principal: number; annual_rate: number; years: number; monthly_contribution?: number
      })

    case 'calculate_retirement_projection':
      return toolCalculateRetirementProjection(supabase, userId, args as { plan_id: number; scenario_id: number })

    case 'run_monte_carlo':
      return toolRunMonteCarlo(supabase, userId, args as { plan_id: number; scenario_id: number; num_simulations?: number })

    case 'calculate_property_metrics':
      return toolCalculatePropertyMetrics(supabase, userId, args as { property_id: number })

    case 'calculate_tax_estimate':
      return toolCalculateTaxEstimate(supabase, userId, args as { gross_income: number; filing_status: string })

    case 'calculate_debt_payoff':
      return toolCalculateDebtPayoff(supabase, userId, args as { extra_monthly_payment?: number })

    default:
      return { success: false, error: `Unknown tool: ${toolName}` }
  }
}

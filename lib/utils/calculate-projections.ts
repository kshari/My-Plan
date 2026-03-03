import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_SSA_START_AGE,
  DEFAULT_MAX_PROJECTION_AGE,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  SCORE_ON_TRACK_THRESHOLD,
  SCORE_CLOSE_THRESHOLD,
} from '@/lib/constants/retirement-defaults'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
  type ProjectionDetail,
} from '@/lib/utils/retirement-projections'

/**
 * Calculates and saves retirement projections for a given scenario
 * This is a shared utility that can be used by multiple components
 */
export async function calculateAndSaveProjectionsForScenario(
  planId: number,
  scenarioId: number,
  lifeExpectancy: number = DEFAULT_MAX_PROJECTION_AGE,
  supabaseInstance?: SupabaseClient
): Promise<void> {
  const supabase = supabaseInstance ?? createClient()
  
  try {
    // Load all necessary data
    const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
      supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy, filing_status').eq('id', planId).single(),
      supabase.from('rp_accounts').select('*').eq('plan_id', planId),
      supabase.from('rp_expenses').select('*').eq('plan_id', planId),
      supabase.from('rp_other_income').select('*').eq('plan_id', planId),
      supabase.from('rp_calculator_settings').select('*').eq('scenario_id', scenarioId).single(),
    ])

    if (planData.error) throw planData.error
    if (accountsData.error) throw accountsData.error
    if (expensesData.error) throw expensesData.error
    if (incomeData.error) throw incomeData.error
    if (settingsData.error) throw settingsData.error

    if (!planData.data?.birth_year) {
      console.warn('Please set birth year in Plan Details')
      return
    }

    if (!settingsData.data) {
      console.warn('Please configure scenario settings in Plan Details')
      return
    }

    const accounts: Account[] = (accountsData.data || []).map(acc => ({
      id: acc.id,
      account_name: acc.account_name,
      owner: acc.owner || '',
      balance: acc.balance || 0,
      account_type: acc.account_type,
      annual_contribution: acc.annual_contribution || 0,
    }))

    const expenses: Expense[] = (expensesData.data || []).map(exp => ({
      id: exp.id,
      expense_name: exp.expense_name,
      amount_after_65: exp.amount_after_65 || 0,
      amount_before_65: exp.amount_before_65 || 0,
    }))

    const otherIncome: OtherIncome[] = (incomeData.data || []).map(inc => ({
      id: inc.id,
      income_name: inc.income_source || '',
      amount: inc.annual_amount || 0,
      start_year: inc.start_year || undefined,
      end_year: inc.end_year || undefined,
      inflation_adjusted: inc.inflation_adjusted || false,
    }))

    // Calculate years to retirement
    const currentYear = new Date().getFullYear()
    const birthYear = planData.data.birth_year
    const retirementAge = settingsData.data.retirement_age || DEFAULT_RETIREMENT_AGE
    const yearsToRetirement = retirementAge - (currentYear - birthYear)
    const annualExpenses = expenses.reduce((sum, exp) => {
      const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
      return sum + (amount || 0)
    }, 0) * 12
    
    const baseSettings = buildCalculatorSettings(
      settingsData.data,
      planData.data,
      currentYear,
      retirementAge,
      yearsToRetirement,
      annualExpenses
    )
    
    // Always use default strategy for saved projections
    baseSettings.withdrawal_priority = 'default'
    baseSettings.withdrawal_secondary_priority = 'tax_optimization'

    // Calculate estimated SSA amounts at start age
    const includePlannerSsa = settingsData.data?.planner_ssa_income !== undefined ? settingsData.data.planner_ssa_income : true
    
    // Automatically include spouse SSA if:
    // 1. User explicitly set it to true, OR
    // 2. Plan includes spouse (include_spouse = true), OR
    // 3. Filing status is "Married Filing Jointly"
    // This ensures realistic projections for married couples
    const explicitSpouseSsa = (settingsData.data?.spouse_ssa_income !== undefined ? settingsData.data.spouse_ssa_income : false)
    const hasSpouse = planData.data.include_spouse || false
    const isMarriedFilingJointly = planData.data.filing_status === 'Married Filing Jointly'
    const includeSpouseSsa = explicitSpouseSsa || hasSpouse || isMarriedFilingJointly

    // Use same SSA benefit logic as Quick Projections: stored benefit, else estimate from income, else defaults
    const estimatedIncomeForSsa = Number(settingsData.data?.estimated_ssa_annual_income) || 0
    const plannerBenefit = settingsData.data?.planner_ssa_annual_benefit != null
      ? Number(settingsData.data.planner_ssa_annual_benefit)
      : (includePlannerSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, true) : DEFAULT_SSA_ANNUAL_BENEFIT) : 0)
    const spouseBenefit = settingsData.data?.spouse_ssa_annual_benefit != null
      ? Number(settingsData.data.spouse_ssa_annual_benefit)
      : (includeSpouseSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, false) : DEFAULT_SPOUSE_SSA_BENEFIT) : 0)
    const baseEstimatedPlannerSsa = includePlannerSsa ? plannerBenefit : 0
    const baseEstimatedSpouseSsa = includeSpouseSsa ? spouseBenefit : 0

    const ssaStartAge = baseSettings.ssa_start_age || baseSettings.retirement_age || DEFAULT_SSA_START_AGE
    const currentAge = currentYear - birthYear
    const yearsToSsaStart = Math.max(0, ssaStartAge - currentAge)
    const inflationToSsaStart = Math.pow(1 + baseSettings.inflation_rate, yearsToSsaStart)
    
    const estimatedPlannerSsaAtStart = includePlannerSsa ? baseEstimatedPlannerSsa * inflationToSsaStart : undefined
    const estimatedSpouseSsaAtStart = includeSpouseSsa ? baseEstimatedSpouseSsa * inflationToSsaStart : undefined

    // Calculate projections using default strategy
    const projectionsForSaving = calculateRetirementProjections(
      planData.data.birth_year,
      accounts,
      expenses,
      otherIncome,
      baseSettings,
      lifeExpectancy,
      planData.data.spouse_birth_year || undefined,
      planData.data.spouse_life_expectancy || undefined,
      includePlannerSsa,
      includeSpouseSsa,
      estimatedPlannerSsaAtStart,
      estimatedSpouseSsaAtStart
    )

    // Delete existing projections for this scenario
    const { error: deleteError } = await supabase
      .from('rp_projection_details')
      .delete()
      .eq('scenario_id', scenarioId)

    if (deleteError) {
      console.error('Error deleting existing projections:', deleteError)
      throw deleteError
    }

    // Insert new projections
    const projectionsToInsert = projectionsForSaving.map(proj => ({
      plan_id: planId,
      scenario_id: scenarioId,
      year: proj.year,
      age: proj.age,
      event: proj.event,
      ssa_income: proj.ssa_income || 0,
      distribution_401k: proj.distribution_401k || 0,
      distribution_roth: proj.distribution_roth || 0,
      distribution_taxable: proj.distribution_taxable || 0,
      distribution_hsa: proj.distribution_hsa || 0,
      distribution_ira: proj.distribution_ira || 0,
      distribution_other: proj.distribution_other || 0,
      investment_income: proj.investment_income || 0,
      other_recurring_income: proj.other_recurring_income || 0,
      total_income: proj.total_income || 0,
      after_tax_income: proj.after_tax_income || 0,
      living_expenses: proj.living_expenses || 0,
      special_expenses: proj.healthcare_expenses || proj.special_expenses || 0,
      total_expenses: proj.total_expenses || 0,
      gap_excess: proj.gap_excess || 0,
      cumulative_liability: proj.cumulative_liability || 0,
      debt_balance: proj.debt_balance || 0,
      debt_interest_paid: proj.debt_interest_paid || 0,
      debt_principal_paid: proj.debt_principal_paid || 0,
      assets_remaining: proj.assets_remaining || 0,
      networth: proj.networth || 0,
      balance_401k: proj.balance_401k || 0,
      balance_roth: proj.balance_roth || 0,
      balance_investment: proj.balance_investment || 0,
      balance_other_investments: proj.balance_other_investments || 0,
      balance_hsa: proj.balance_hsa || 0,
      balance_ira: proj.balance_ira || 0,
      taxable_income: proj.taxable_income || 0,
      tax: proj.tax || 0,
    }))

    // Use upsert to handle any remaining duplicates
    const { error: insertError } = await supabase
      .from('rp_projection_details')
      .upsert(projectionsToInsert, {
        onConflict: 'scenario_id,year',
        ignoreDuplicates: false
      })

    if (insertError) throw insertError

    // Compute and save plan metrics so dashboard table shows all values
    const metrics = computePlanMetricsFromProjections(
      projectionsForSaving,
      retirementAge,
      lifeExpectancy
    )
    const { error: metricsError } = await supabase.from('rp_plan_metrics').upsert({
      plan_id: planId,
      current_age: currentAge,
      retirement_age: retirementAge,
      confidence_score: metrics.confidenceScore,
      monthly_income: metrics.monthlyRetirementIncome,
      years_money_lasts: metrics.yearsMoneyLasts,
      networth_at_retirement: metrics.networthAtRetirement,
      legacy_value: metrics.legacyValue,
      status: metrics.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'plan_id' })
    if (metricsError) {
      console.error('rp_plan_metrics upsert failed:', metricsError)
      throw metricsError
    }
  } catch (error: any) {
    console.error('Error calculating projections:', error)
    throw error
  }
}

/**
 * Compute plan metrics from projection results (same logic as snapshot tab summary).
 * Used so Saved Retirement Plans table shows confidence, income, years, networth, legacy.
 */
function computePlanMetricsFromProjections(
  projections: ProjectionDetail[],
  retirementAge: number,
  lifeExpectancy: number
): {
  confidenceScore: number
  monthlyRetirementIncome: number
  yearsMoneyLasts: number
  networthAtRetirement: number
  legacyValue: number
  status: string
} {
  const retirementProjections = projections.filter((p) => p.age >= retirementAge)
  const networthAtRetirement = retirementProjections[0]?.networth ?? 0

  if (retirementProjections.length === 0) {
    return {
      confidenceScore: 0,
      monthlyRetirementIncome: 0,
      yearsMoneyLasts: 0,
      networthAtRetirement: 0,
      legacyValue: 0,
      status: 'at-risk',
    }
  }

  const earlyRetirementYears = retirementProjections.slice(0, 10)
  const monthlyRetirementIncome =
    earlyRetirementYears.length > 0
      ? earlyRetirementYears.reduce((sum, p) => sum + (p.after_tax_income || 0), 0) /
        earlyRetirementYears.length /
        12
      : 0

  let yearsMoneyLasts = 0
  let fundsRunOutAge: number | null = null
  for (let i = 0; i < retirementProjections.length; i++) {
    const proj = retirementProjections[i]
    const networth = proj.networth || 0
    if (networth <= 0) {
      fundsRunOutAge = proj.age ?? retirementAge + i
      yearsMoneyLasts = i + 1
      break
    }
  }

  if (fundsRunOutAge === null) {
    const lifeExpectancyIndex = retirementProjections.findIndex((p) => p.age === lifeExpectancy)
    yearsMoneyLasts =
      lifeExpectancyIndex >= 0 ? lifeExpectancyIndex + 1 : lifeExpectancy - retirementAge
  }

  let legacyValue = 0
  if (fundsRunOutAge === null || fundsRunOutAge >= lifeExpectancy) {
    const atLife = retirementProjections.find((p) => p.age === lifeExpectancy)
    legacyValue = atLife?.networth ?? 0
  }

  const totalYears = retirementProjections.length
  const yearsWithShortfall = retirementProjections.filter(
    (p) => (p.gap_excess || 0) < -1000
  ).length
  const shortfallRatio = totalYears > 0 ? yearsWithShortfall / totalYears : 0
  const confidenceScore = Math.max(
    0,
    Math.min(100, Math.round((1 - shortfallRatio) * 100))
  )

  let status: 'on-track' | 'close' | 'at-risk'
  if (confidenceScore >= SCORE_ON_TRACK_THRESHOLD) status = 'on-track'
  else if (confidenceScore >= SCORE_CLOSE_THRESHOLD) status = 'close'
  else status = 'at-risk'

  return {
    confidenceScore,
    monthlyRetirementIncome,
    yearsMoneyLasts,
    networthAtRetirement,
    legacyValue,
    status,
  }
}

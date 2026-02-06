import { createClient } from '@/lib/supabase/client'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
} from '@/lib/utils/retirement-projections'

/**
 * Calculates and saves retirement projections for a given scenario
 * This is a shared utility that can be used by multiple components
 */
export async function calculateAndSaveProjectionsForScenario(
  planId: number,
  scenarioId: number,
  lifeExpectancy: number = 100
): Promise<void> {
  const supabase = createClient()
  
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
    const retirementAge = settingsData.data.retirement_age || 65
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
    
    const baseEstimatedPlannerSsa = includePlannerSsa ? calculateEstimatedSSA(0, true) : 0
    const baseEstimatedSpouseSsa = includeSpouseSsa ? calculateEstimatedSSA(0, false) : 0
    
    const ssaStartAge = baseSettings.ssa_start_age || baseSettings.retirement_age || 65
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
      special_expenses: proj.special_expenses || 0,
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
  } catch (error: any) {
    console.error('Error calculating projections:', error)
    throw error
  }
}

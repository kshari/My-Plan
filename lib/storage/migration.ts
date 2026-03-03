import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalPlanData } from './types'
import { LOCAL_STORAGE_KEY } from './types'

/**
 * Reads local plan data from localStorage (if any).
 */
export function getLocalPlanData(): LocalPlanData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Migrates local plan data to Supabase under the given user.
 * Creates a plan, accounts, expenses, other income, scenario + settings,
 * then clears localStorage.
 *
 * Returns the new plan ID on success, or null on failure.
 */
export async function migrateLocalToSupabase(
  supabase: SupabaseClient,
  userId: string,
  localData: LocalPlanData
): Promise<number | null> {
  try {
    const plan = localData.plan
    const currentYear = new Date().getFullYear()

    // 1. Create plan
    const { data: planRow, error: planError } = await supabase
      .from('rp_retirement_plans')
      .insert({
        user_id: userId,
        plan_name: plan.plan_name || 'My Plan',
        birth_year: plan.birth_year,
        life_expectancy: plan.life_expectancy,
        filing_status: plan.filing_status,
        include_spouse: plan.include_spouse,
        spouse_birth_year: plan.spouse_birth_year || null,
        spouse_life_expectancy: plan.spouse_life_expectancy || null,
      })
      .select()
      .single()

    if (planError || !planRow) {
      console.error('Migration: failed to create plan', planError)
      return null
    }

    const planId = planRow.id

    // 2. Insert accounts
    if (localData.accounts.length > 0) {
      const accountRows = localData.accounts.map(a => ({
        plan_id: planId,
        account_name: a.account_name,
        owner: a.owner || 'Planner',
        balance: a.balance || 0,
        account_type: a.account_type || '401k',
        annual_contribution: a.annual_contribution || 0,
      }))
      const { error } = await supabase.from('rp_accounts').insert(accountRows)
      if (error) console.error('Migration: accounts insert error', error)
    }

    // 3. Insert expenses
    if (localData.expenses.length > 0) {
      const expenseRows = localData.expenses.map(e => ({
        plan_id: planId,
        expense_name: e.expense_name,
        amount_before_65: e.amount_before_65 || 0,
        amount_after_65: e.amount_after_65 || 0,
      }))
      const { error } = await supabase.from('rp_expenses').insert(expenseRows)
      if (error) console.error('Migration: expenses insert error', error)
    }

    // 4. Insert other income
    if (localData.otherIncome.length > 0) {
      const incomeRows = localData.otherIncome.map(i => ({
        plan_id: planId,
        income_source: i.income_name,
        annual_amount: i.amount || 0,
        start_year: i.start_year || null,
        end_year: i.end_year || null,
        inflation_adjusted: i.inflation_adjusted || false,
      }))
      const { error } = await supabase.from('rp_other_income').insert(incomeRows)
      if (error) console.error('Migration: other income insert error', error)
    }

    // 5. Create default scenario
    const { data: scenario, error: scenError } = await supabase
      .from('rp_scenarios')
      .insert({ plan_id: planId, scenario_name: 'Base Scenario', is_default: true })
      .select()
      .single()

    if (scenError || !scenario) {
      console.error('Migration: failed to create scenario', scenError)
      return planId
    }

    // 6. Create calculator settings from local settings
    const s = localData.settings || {}
    const retirementAge = (s as any).retirement_age || 65
    const age = currentYear - (plan.birth_year || currentYear - 50)
    const yearsToRet = Math.max(0, retirementAge - age)

    await supabase.from('rp_calculator_settings').insert({
      plan_id: planId,
      scenario_id: scenario.id,
      current_year: currentYear,
      retirement_age: retirementAge,
      retirement_start_year: currentYear + yearsToRet,
      years_to_retirement: yearsToRet,
      annual_retirement_expenses: (s as any).annual_retirement_expenses || 0,
      growth_rate_before_retirement: (s as any).growth_rate_before_retirement || 0.07,
      growth_rate_during_retirement: (s as any).growth_rate_during_retirement || 0.05,
      inflation_rate: (s as any).inflation_rate || 0.03,
      enable_borrowing: (s as any).enable_borrowing || false,
      ssa_start_age: (s as any).ssa_start_age || retirementAge,
    })

    // 7. Save calculator defaults if present
    if (localData.calculatorDefaults && Object.keys(localData.calculatorDefaults).length > 0) {
      const d = localData.calculatorDefaults as any
      await supabase.from('rp_calculator_defaults').upsert({
        user_id: userId,
        age: d.age,
        retirement_age: d.retirementAge,
        life_expectancy: d.lifeExpectancy,
        current_savings: d.currentSavings,
        annual_contribution: d.annualContribution,
        monthly_expenses: d.monthlyExpenses,
        growth_rate_pre_retirement: d.growthRatePreRetirement,
        growth_rate_during_retirement: d.growthRateDuringRetirement,
        inflation_rate: d.inflationRate,
        include_ssa: d.includeSsa,
        ssa_start_age: d.ssaStartAge,
        ssa_annual_benefit: d.ssaAnnualBenefit,
        include_spouse: d.includeSpouse,
        spouse_age: d.spouseAge,
        spouse_ssa_benefit: d.spouseSsaBenefit,
        pre_medicare_annual_premium: d.preMedicareAnnualPremium,
        post_medicare_annual_premium: d.postMedicareAnnualPremium,
      }, { onConflict: 'user_id' })
    }

    // 8. Run projections server-side
    try {
      const res = await fetch(`/apps/retirement/plans/${planId}/run-projections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          lifeExpectancy: plan.life_expectancy || 90,
        }),
      })
      if (!res.ok) console.error('Migration: projection run failed', await res.text())
    } catch {
      // Non-critical
    }

    // 9. Clear localStorage
    localStorage.removeItem(LOCAL_STORAGE_KEY)

    return planId
  } catch (error) {
    console.error('Migration failed:', error)
    return null
  }
}

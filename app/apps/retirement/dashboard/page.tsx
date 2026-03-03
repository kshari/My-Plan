import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import RetirementPlanList, { type PlanAssumptions } from '@/components/retirement/retirement-plan-list'
import RetirementCalculator from '@/components/retirement/retirement-calculator'

interface CalculatorSettingsRow {
  scenario_id: number
  ssa_start_age?: number | null
  retirement_age?: number | null
  annual_retirement_expenses?: number | null
  growth_rate_before_retirement?: number | null
  growth_rate_during_retirement?: number | null
  inflation_rate?: number | null
  planner_ssa_income?: boolean | null
  spouse_ssa_income?: boolean | null
  planner_ssa_annual_benefit?: number | null
  spouse_ssa_annual_benefit?: number | null
  pre_medicare_annual_premium?: number | null
  post_medicare_annual_premium?: number | null
}

export default async function RetirementDashboardPage() {
  const { supabase, user } = await requireAuth()

  const { data: plans, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch latest computed metrics for each plan
  const planIds = (plans || []).map((p) => p.id)
  const { data: metrics } = planIds.length
    ? await supabase
        .from('rp_plan_metrics')
        .select('*')
        .in('plan_id', planIds)
    : { data: [] }

  // Fetch default scenario's settings per plan (SSA start age + full assumptions for "Show all the assumptions")
  let ssaStartAgeByPlanId: Record<number, number | null> = {}
  let settingsByPlanId: Record<number, PlanAssumptions | null> = {}
  if (planIds.length > 0) {
    const { data: defaultScenarios } = await supabase
      .from('rp_scenarios')
      .select('id, plan_id')
      .in('plan_id', planIds)
      .eq('is_default', true)
    const scenarioIds = (defaultScenarios || []).map((s) => s.id)
    const planIdByScenarioId = Object.fromEntries((defaultScenarios || []).map((s) => [s.id, s.plan_id]))
    if (scenarioIds.length > 0) {
      const { data: settingsRows } = await supabase
        .from('rp_calculator_settings')
        .select(
          'scenario_id, ssa_start_age, retirement_age, annual_retirement_expenses, growth_rate_before_retirement, growth_rate_during_retirement, inflation_rate, planner_ssa_income, spouse_ssa_income, planner_ssa_annual_benefit, spouse_ssa_annual_benefit, pre_medicare_annual_premium, post_medicare_annual_premium'
        )
        .in('scenario_id', scenarioIds)
      ssaStartAgeByPlanId = Object.fromEntries(planIds.map((pid) => [pid, null])) as Record<number, number | null>
      settingsByPlanId = Object.fromEntries(planIds.map((pid) => [pid, null])) as Record<number, PlanAssumptions | null>
      ;(settingsRows || []).forEach((row: CalculatorSettingsRow) => {
        const planId = planIdByScenarioId[row.scenario_id]
        if (planId != null) {
          if (row.ssa_start_age != null) ssaStartAgeByPlanId[planId] = row.ssa_start_age
          settingsByPlanId[planId] = {
            retirement_age: row.retirement_age ?? null,
            annual_retirement_expenses: row.annual_retirement_expenses ?? null,
            growth_rate_before_retirement: row.growth_rate_before_retirement ?? null,
            growth_rate_during_retirement: row.growth_rate_during_retirement ?? null,
            inflation_rate: row.inflation_rate ?? null,
            ssa_start_age: row.ssa_start_age ?? null,
            planner_ssa_income: row.planner_ssa_income ?? null,
            spouse_ssa_income: row.spouse_ssa_income ?? null,
            planner_ssa_annual_benefit: row.planner_ssa_annual_benefit ?? null,
            spouse_ssa_annual_benefit: row.spouse_ssa_annual_benefit ?? null,
            pre_medicare_annual_premium: row.pre_medicare_annual_premium ?? null,
            post_medicare_annual_premium: row.post_medicare_annual_premium ?? null,
          }
        }
      })
    }
  }

  return (
    <div className={`${PAGE_CONTAINER} space-y-8`}>
      {/* Calculator first */}
      <RetirementCalculator />

      {/* Saved plans */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold tracking-tight">Saved Retirement Plans</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your detailed plans with full scenario modeling
          </p>
          {error && (
            <p className="mt-1 text-sm text-destructive">Error loading plans: {error.message}</p>
          )}
        </div>

        <RetirementPlanList plans={plans || []} metrics={metrics || []} ssaStartAgeByPlanId={ssaStartAgeByPlanId} settingsByPlanId={settingsByPlanId} />
      </div>
    </div>
  )
}

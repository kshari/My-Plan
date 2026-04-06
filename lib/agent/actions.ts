import type { SupabaseClient } from '@supabase/supabase-js'

const FP_PROFILE_ALLOWED_KEYS = [
  'age', 'state', 'household_type', 'household_size', 'annual_gross_income',
  'filing_status', 'total_retirement_savings', 'total_non_retirement_savings',
  'monthly_expenses', 'monthly_savings', 'home_value', 'mortgage_balance',
] as const

const RP_PLAN_ALLOWED_KEYS = [
  'plan_name', 'birth_year', 'life_expectancy', 'filing_status',
  'include_spouse', 'spouse_birth_year', 'spouse_life_expectancy',
] as const

const RP_ACCOUNT_ALLOWED_KEYS = [
  'account_name', 'owner', 'balance', 'account_type', 'annual_contribution',
] as const

const RP_EXPENSE_ALLOWED_KEYS = [
  'expense_name', 'amount_before_65', 'amount_after_65',
] as const

const RP_SCENARIO_SETTINGS_ALLOWED_KEYS = [
  'retirement_age', 'return_rate_before_retirement', 'return_rate_during_retirement',
  'inflation_rate', 'ssa_start_age',
] as const

const RP_OTHER_INCOME_ALLOWED_KEYS = [
  'income_name', 'annual_amount', 'start_age', 'end_age', 'cola',
] as const

export type AgentAction =
  | { type: 'update_fp_profile'; payload: Record<string, unknown> }
  | { type: 'update_rp_plan'; payload: { plan_id: number; [k: string]: unknown } }
  | { type: 'update_rp_account'; payload: { account_id: number; [k: string]: unknown } }
  | { type: 'update_rp_expense'; payload: { expense_id: number; [k: string]: unknown } }
  | { type: 'update_rp_other_income'; payload: { income_id: number; [k: string]: unknown } }
  | { type: 'create_rp_scenario'; payload: { plan_id: number; scenario_name: string; [k: string]: unknown } }
  | { type: 'update_rp_scenario'; payload: { scenario_id: number; [k: string]: unknown } }

export const ALLOWED_ACTION_TYPES = [
  'update_fp_profile', 'update_rp_plan', 'update_rp_account', 'update_rp_expense',
  'update_rp_other_income', 'create_rp_scenario', 'update_rp_scenario',
] as const

function pick<T extends string>(obj: Record<string, unknown>, keys: readonly T[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}

async function verifyPlanOwnership(
  supabase: SupabaseClient,
  planId: number,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('rp_retirement_plans')
    .select('id')
    .eq('id', planId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function executeAgentAction(
  supabase: SupabaseClient,
  userId: string,
  action: AgentAction
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    switch (action.type) {
      case 'update_fp_profile': {
        const updates = pick(action.payload as Record<string, unknown>, FP_PROFILE_ALLOWED_KEYS)
        if (Object.keys(updates).length === 0) {
          return { success: false, error: 'No allowed fields to update' }
        }
        const { error } = await supabase
          .from('fp_profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
        if (error) return { success: false, error: error.message }
        return { success: true }
      }

      case 'update_rp_plan': {
        const planId = Number(action.payload.plan_id)
        if (!Number.isInteger(planId)) return { success: false, error: 'Invalid plan_id' }
        const ok = await verifyPlanOwnership(supabase, planId, userId)
        if (!ok) return { success: false, error: 'Plan not found or unauthorized' }
        const updates = pick(action.payload as Record<string, unknown>, RP_PLAN_ALLOWED_KEYS)
        if (Object.keys(updates).length === 0) return { success: false, error: 'No allowed fields to update' }
        const { error } = await supabase.from('rp_retirement_plans').update(updates).eq('id', planId)
        if (error) return { success: false, error: error.message }
        return { success: true }
      }

      case 'update_rp_account': {
        const accountId = Number(action.payload.account_id)
        if (!Number.isInteger(accountId)) return { success: false, error: 'Invalid account_id' }
        const { data: account } = await supabase.from('rp_accounts').select('plan_id').eq('id', accountId).single()
        if (!account) return { success: false, error: 'Account not found' }
        const ok = await verifyPlanOwnership(supabase, account.plan_id, userId)
        if (!ok) return { success: false, error: 'Unauthorized' }
        const updates = pick(action.payload as Record<string, unknown>, RP_ACCOUNT_ALLOWED_KEYS)
        if (Object.keys(updates).length === 0) return { success: false, error: 'No allowed fields to update' }
        const { error } = await supabase.from('rp_accounts').update(updates).eq('id', accountId)
        if (error) return { success: false, error: error.message }
        return { success: true }
      }

      case 'update_rp_expense': {
        const expenseId = Number(action.payload.expense_id)
        if (!Number.isInteger(expenseId)) return { success: false, error: 'Invalid expense_id' }
        const { data: expense } = await supabase.from('rp_expenses').select('plan_id').eq('id', expenseId).single()
        if (!expense) return { success: false, error: 'Expense not found' }
        const ok = await verifyPlanOwnership(supabase, expense.plan_id, userId)
        if (!ok) return { success: false, error: 'Unauthorized' }
        const updates = pick(action.payload as Record<string, unknown>, RP_EXPENSE_ALLOWED_KEYS)
        if (Object.keys(updates).length === 0) return { success: false, error: 'No allowed fields to update' }
        const { error } = await supabase.from('rp_expenses').update(updates).eq('id', expenseId)
        if (error) return { success: false, error: error.message }
        return { success: true }
      }

      case 'update_rp_other_income': {
        const incomeId = Number(action.payload.income_id)
        if (!Number.isInteger(incomeId)) return { success: false, error: 'Invalid income_id' }
        const { data: income } = await supabase.from('rp_other_income').select('plan_id').eq('id', incomeId).single()
        if (!income) return { success: false, error: 'Other income not found' }
        const ok = await verifyPlanOwnership(supabase, income.plan_id, userId)
        if (!ok) return { success: false, error: 'Unauthorized' }
        const updates = pick(action.payload as Record<string, unknown>, RP_OTHER_INCOME_ALLOWED_KEYS)
        if (Object.keys(updates).length === 0) return { success: false, error: 'No allowed fields to update' }
        const { error } = await supabase.from('rp_other_income').update(updates).eq('id', incomeId)
        if (error) return { success: false, error: error.message }
        return { success: true }
      }

      case 'create_rp_scenario': {
        const planId = Number(action.payload.plan_id)
        const scenarioName = String(action.payload.scenario_name ?? 'New Scenario').trim()
        if (!Number.isInteger(planId)) return { success: false, error: 'Invalid plan_id' }
        const ok = await verifyPlanOwnership(supabase, planId, userId)
        if (!ok) return { success: false, error: 'Plan not found or unauthorized' }
        const { data: newScenario, error } = await supabase
          .from('rp_scenarios')
          .insert({ plan_id: planId, scenario_name: scenarioName || 'New Scenario', is_default: false })
          .select('id')
          .single()
        if (error) return { success: false, error: error.message }

        // Persist scenario-specific settings when provided
        const settings = pick(action.payload as Record<string, unknown>, RP_SCENARIO_SETTINGS_ALLOWED_KEYS)
        // Map tool param names to DB column names
        const aiDbSettings: Record<string, unknown> = {}
        if (settings.retirement_age !== undefined) aiDbSettings.retirement_age = settings.retirement_age
        if (settings.return_rate_before_retirement !== undefined) aiDbSettings.growth_rate_before_retirement = settings.return_rate_before_retirement
        if (settings.return_rate_during_retirement !== undefined) aiDbSettings.growth_rate_during_retirement = settings.return_rate_during_retirement
        if (settings.inflation_rate !== undefined) aiDbSettings.inflation_rate = settings.inflation_rate
        if (settings.ssa_start_age !== undefined) aiDbSettings.ssa_start_age = settings.ssa_start_age

        if (Object.keys(aiDbSettings).length > 0) {
          // Copy the default scenario's settings as a base so that SSA benefits, expenses,
          // tax rates, and other user-configured values are inherited. The AI-provided values
          // (retirement_age, growth rates, etc.) then override the copied values.
          let inheritedSettings: Record<string, unknown> = {}
          const { data: defaultScenario } = await supabase
            .from('rp_scenarios')
            .select('id')
            .eq('plan_id', planId)
            .eq('is_default', true)
            .maybeSingle()
          if (defaultScenario) {
            const { data: baseSettings } = await supabase
              .from('rp_calculator_settings')
              .select('*')
              .eq('scenario_id', defaultScenario.id)
              .maybeSingle()
            if (baseSettings) {
              // Strip identity/foreign-key columns; keep only user-configured settings
              const { id: _id, created_at: _ca, updated_at: _ua, scenario_id: _sid, plan_id: _pid, ...rest } = baseSettings as Record<string, unknown>
              inheritedSettings = rest
            }
          }

          // AI-provided values take precedence over inherited base-scenario values
          const mergedSettings = { ...inheritedSettings, ...aiDbSettings }

          const { error: settingsErr } = await supabase
            .from('rp_calculator_settings')
            .upsert({ plan_id: planId, scenario_id: newScenario.id, ...mergedSettings }, { onConflict: 'scenario_id' })
          if (settingsErr) return { success: false, error: settingsErr.message }
        }
        return { success: true }
      }

      case 'update_rp_scenario': {
        const scenarioId = Number(action.payload.scenario_id)
        if (!Number.isInteger(scenarioId)) return { success: false, error: 'Invalid scenario_id' }

        // Verify ownership through the plan
        const { data: scenario } = await supabase
          .from('rp_scenarios')
          .select('plan_id')
          .eq('id', scenarioId)
          .single()
        if (!scenario) return { success: false, error: 'Scenario not found' }
        const ok = await verifyPlanOwnership(supabase, scenario.plan_id, userId)
        if (!ok) return { success: false, error: 'Unauthorized' }

        // Update the scenario name if provided and non-empty
        if (action.payload.scenario_name !== undefined) {
          const newName = String(action.payload.scenario_name).trim()
          if (newName) {
            const { error } = await supabase
              .from('rp_scenarios')
              .update({ scenario_name: newName })
              .eq('id', scenarioId)
            if (error) return { success: false, error: error.message }
          }
        }

        // Upsert settings
        const settings = pick(action.payload as Record<string, unknown>, RP_SCENARIO_SETTINGS_ALLOWED_KEYS)
        const dbSettings: Record<string, unknown> = {}
        if (settings.retirement_age !== undefined) dbSettings.retirement_age = settings.retirement_age
        if (settings.return_rate_before_retirement !== undefined) dbSettings.growth_rate_before_retirement = settings.return_rate_before_retirement
        if (settings.return_rate_during_retirement !== undefined) dbSettings.growth_rate_during_retirement = settings.return_rate_during_retirement
        if (settings.inflation_rate !== undefined) dbSettings.inflation_rate = settings.inflation_rate
        if (settings.ssa_start_age !== undefined) dbSettings.ssa_start_age = settings.ssa_start_age

        if (Object.keys(dbSettings).length > 0) {
          // If this scenario is missing SSA/expense settings, read what it currently has and
          // back-fill missing fields from the default scenario so projections stay consistent.
          const { data: existingSettings } = await supabase
            .from('rp_calculator_settings')
            .select('planner_ssa_annual_benefit, spouse_ssa_annual_benefit, annual_retirement_expenses')
            .eq('scenario_id', scenarioId)
            .maybeSingle()

          const needsInheritance =
            existingSettings == null ||
            (existingSettings.planner_ssa_annual_benefit == null && existingSettings.annual_retirement_expenses == null)

          let inheritedSettings: Record<string, unknown> = {}
          if (needsInheritance) {
            const { data: defaultScenario } = await supabase
              .from('rp_scenarios')
              .select('id')
              .eq('plan_id', scenario.plan_id)
              .eq('is_default', true)
              .maybeSingle()
            if (defaultScenario) {
              const { data: baseSettings } = await supabase
                .from('rp_calculator_settings')
                .select('*')
                .eq('scenario_id', defaultScenario.id)
                .maybeSingle()
              if (baseSettings) {
                const { id: _id, created_at: _ca, updated_at: _ua, scenario_id: _sid, plan_id: _pid, ...rest } = baseSettings as Record<string, unknown>
                inheritedSettings = rest
              }
            }
          }

          const mergedSettings = { ...inheritedSettings, ...dbSettings }

          const { error: settingsErr } = await supabase
            .from('rp_calculator_settings')
            .upsert({ plan_id: scenario.plan_id, scenario_id: scenarioId, ...mergedSettings }, { onConflict: 'scenario_id' })
          if (settingsErr) return { success: false, error: settingsErr.message }
        }
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action type: ${(action as AgentAction).type}` }
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return { success: false, error: message }
  }
}

export function parseAgentActions(body: unknown): AgentAction[] | null {
  if (!body || typeof body !== 'object' || !('actions' in body)) return null
  const raw = (body as { actions: unknown }).actions
  if (!Array.isArray(raw)) return null
  const out: AgentAction[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || !('type' in item) || !('payload' in item)) continue
    const type = String((item as { type: unknown }).type)
    const payload = (item as { payload: unknown }).payload
    if (!ALLOWED_ACTION_TYPES.includes(type as (typeof ALLOWED_ACTION_TYPES)[number])) continue
    if (typeof payload !== 'object' || payload === null) continue
    out.push({ type: type as AgentAction['type'], payload: payload as Record<string, unknown> } as AgentAction)
  }
  return out
}

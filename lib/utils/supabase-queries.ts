import { createClient } from '@/lib/supabase/client'

/**
 * Shared Supabase query helpers for commonly-fetched data.
 * All functions use the browser client (for use in client components).
 */

/** Fetch calculator settings for a scenario. */
export async function getCalculatorSettings(scenarioId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_calculator_settings')
    .select('*')
    .eq('scenario_id', scenarioId)
    .single()
  return { data, error }
}

/** Fetch all scenarios for a plan. */
export async function getScenarios(planId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_scenarios')
    .select('*')
    .eq('plan_id', planId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
  return { data: data || [], error }
}

/** Fetch accounts for a plan. */
export async function getAccounts(planId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_accounts')
    .select('*')
    .eq('plan_id', planId)
  return { data: data || [], error }
}

/** Fetch expenses for a plan. */
export async function getExpenses(planId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_expenses')
    .select('*')
    .eq('plan_id', planId)
  return { data: data || [], error }
}

/** Fetch other income for a plan. */
export async function getOtherIncome(planId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_other_income')
    .select('*')
    .eq('plan_id', planId)
  return { data: data || [], error }
}

/** Fetch the plan with its owner info. */
export async function getPlan(planId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('id', planId)
    .single()
  return { data, error }
}

/** Fetch projection details for a scenario. */
export async function getProjectionDetails(scenarioId: number) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('rp_projection_details')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('year', { ascending: true })
  return { data: data || [], error }
}

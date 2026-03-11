import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContextScope } from './context-scope'

const ALL_DOMAINS = ['pulse', 'retirement', 'property'] as const

/**
 * Build a text summary of the user's app data for the LLM.
 * Uses actual numbers (no ranges) so answers are specific.
 * When a ContextScope is provided, only the relevant data domains are fetched.
 */
export async function buildAgentContext(
  supabase: SupabaseClient,
  userId: string,
  scope?: ContextScope
): Promise<string> {
  const domains = new Set(scope?.domains ?? ALL_DOMAINS)
  const sections: string[] = []

  if (domains.has('pulse')) {
    await buildPulseContext(supabase, userId, sections)
  }

  if (domains.has('retirement')) {
    await buildRetirementContext(supabase, userId, sections, scope?.focusedPlanId)
  }

  if (domains.has('property')) {
    await buildPropertyContext(supabase, userId, sections, scope?.focusedPropertyId)
  }

  if (sections.length === 0) {
    const domainNames = [...domains].join(', ')
    return `The user has not yet added any data to the relevant app(s): ${domainNames}. You can suggest they complete their profile or add a plan or property.`
  }

  return sections.join('\n\n')
}

async function buildPulseContext(
  supabase: SupabaseClient,
  userId: string,
  sections: string[]
) {
  const { data: profile } = await supabase
    .from('fp_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (profile) {
    const lines: string[] = [
      '## Financial Pulse Profile',
      `Age: ${profile.age ?? 'not set'}`,
      `State: ${profile.state ?? 'not set'}`,
      `Household type: ${profile.household_type ?? 'not set'}, size: ${profile.household_size ?? 1}`,
      `Annual gross income: $${Number(profile.annual_gross_income ?? 0).toLocaleString()}`,
      `Filing status: ${profile.filing_status ?? 'not set'}`,
      `Total retirement savings: $${Number(profile.total_retirement_savings ?? 0).toLocaleString()}`,
      `Total non-retirement savings: $${Number(profile.total_non_retirement_savings ?? 0).toLocaleString()}`,
      `Monthly expenses: $${Number(profile.monthly_expenses ?? 0).toLocaleString()}`,
      `Monthly savings: $${Number(profile.monthly_savings ?? 0).toLocaleString()}`,
    ]
    if (profile.home_value != null) lines.push(`Home value: $${Number(profile.home_value).toLocaleString()}`)
    if (profile.mortgage_balance != null) lines.push(`Mortgage balance: $${Number(profile.mortgage_balance).toLocaleString()}`)
    if (profile.college_529_balance != null) lines.push(`College 529 balance: $${Number(profile.college_529_balance).toLocaleString()}`)
    const debts = profile.debts as Array<{ name?: string; balance?: number }> | null
    if (Array.isArray(debts) && debts.length > 0) {
      lines.push(`Debts: ${debts.map((d) => `${d.name ?? 'Debt'}: $${Number(d.balance ?? 0).toLocaleString()}`).join(', ')}`)
    }
    const subs = profile.subscriptions as Array<{ name?: string; monthly_cost?: number }> | null
    if (Array.isArray(subs) && subs.length > 0) {
      lines.push(`Subscriptions (monthly): ${subs.map((s) => `${s.name ?? 'Item'}: $${Number(s.monthly_cost ?? 0)}`).join(', ')}`)
    }
    sections.push(lines.join('\n'))
  }

  const { data: pulseChecks } = await supabase
    .from('fp_pulse_checks')
    .select('check_date, net_worth_snapshot, mood, resilience_score')
    .eq('user_id', userId)
    .order('check_date', { ascending: false })
    .limit(5)

  if (pulseChecks?.length) {
    const lines = [
      '## Recent Pulse Checks',
      ...pulseChecks.map(
        (c) =>
          `${c.check_date}: net worth $${Number(c.net_worth_snapshot ?? 0).toLocaleString()}, mood ${c.mood ?? '-'}, resilience ${c.resilience_score ?? '-'}`
      ),
    ]
    sections.push(lines.join('\n'))
  }
}

async function buildRetirementContext(
  supabase: SupabaseClient,
  userId: string,
  sections: string[],
  focusedPlanId?: number
) {
  const { data: plans } = await supabase
    .from('rp_retirement_plans')
    .select('id, plan_name, birth_year, life_expectancy, filing_status, include_spouse, spouse_birth_year, spouse_life_expectancy')
    .eq('user_id', userId)

  if (!plans?.length) return

  const planIds = plans.map((p) => p.id)
  const [accountsRes, expensesRes, otherIncomeRes, scenariosRes] = await Promise.all([
    supabase.from('rp_accounts').select('*').in('plan_id', planIds),
    supabase.from('rp_expenses').select('*').in('plan_id', planIds),
    supabase.from('rp_other_income').select('*').in('plan_id', planIds),
    supabase.from('rp_scenarios').select('id, plan_id, scenario_name, is_default').in('plan_id', planIds),
  ])
  const accounts = accountsRes.data ?? []
  const expenses = expensesRes.data ?? []
  const otherIncome = otherIncomeRes.data ?? []
  const scenarios = scenariosRes.data ?? []

  const planLines: string[] = ['## Retirement Plans']

  const focusedFirst = focusedPlanId
    ? [...plans.filter((p) => p.id === focusedPlanId), ...plans.filter((p) => p.id !== focusedPlanId)]
    : plans

  for (const plan of focusedFirst) {
    const isFocused = focusedPlanId === plan.id
    const label = isFocused ? ' ← currently viewing' : ''

    planLines.push(
      `\nPlan id=${plan.id}, name: "${plan.plan_name ?? 'Unnamed'}"${label}, birth_year: ${plan.birth_year ?? 'not set'}, life_expectancy: ${plan.life_expectancy ?? 'not set'}, filing_status: ${plan.filing_status ?? 'not set'}, include_spouse: ${plan.include_spouse ?? false}${plan.spouse_birth_year != null ? `, spouse_birth_year: ${plan.spouse_birth_year}, spouse_life_expectancy: ${plan.spouse_life_expectancy ?? 'not set'}` : ''}.`
    )

    if (focusedPlanId && !isFocused) {
      const planAccounts = accounts.filter((a: { plan_id: number }) => a.plan_id === plan.id)
      const totalBalance = planAccounts.reduce((sum: number, a: { balance?: number }) => sum + Number(a.balance ?? 0), 0)
      if (planAccounts.length) {
        planLines.push(`  (${planAccounts.length} accounts, total $${totalBalance.toLocaleString()})`)
      }
      continue
    }

    const planAccounts = accounts.filter((a: { plan_id: number }) => a.plan_id === plan.id)
    if (planAccounts.length) {
      const totalBalance = planAccounts.reduce((sum: number, a: { balance?: number }) => sum + Number(a.balance ?? 0), 0)
      planLines.push(
        `  Accounts (${planAccounts.length}): ${planAccounts.map((a: { account_name?: string; balance?: number }) => `${a.account_name ?? 'Account'}: $${Number(a.balance ?? 0).toLocaleString()}`).join('; ')}. Total: $${totalBalance.toLocaleString()}.`
      )
    }
    const planExpenses = expenses.filter((e: { plan_id: number }) => e.plan_id === plan.id)
    if (planExpenses.length) {
      planLines.push(
        `  Expenses: ${planExpenses.map((e: { expense_name?: string; amount_before_65?: number; amount_after_65?: number }) => `${e.expense_name ?? 'Expense'}: $${Number(e.amount_before_65 ?? 0).toLocaleString()}/mo before 65, $${Number(e.amount_after_65 ?? 0).toLocaleString()}/mo after 65`).join('; ')}.`
      )
    }
    const planOtherIncome = otherIncome.filter((i: { plan_id: number }) => i.plan_id === plan.id)
    if (planOtherIncome.length) {
      planLines.push(
        `  Other Income: ${planOtherIncome.map((i: { id: number; income_name?: string; annual_amount?: number; start_age?: number; end_age?: number }) => `id=${i.id} "${i.income_name ?? 'Income'}": $${Number(i.annual_amount ?? 0).toLocaleString()}/yr, ages ${i.start_age ?? '?'}–${i.end_age ?? '?'}`).join('; ')}.`
      )
    }
    const planScenarios = scenarios.filter((s: { plan_id: number }) => s.plan_id === plan.id)
    if (planScenarios.length) {
      planLines.push(`  Scenarios: ${planScenarios.map((s: { id: number; scenario_name?: string }) => `id=${s.id} "${s.scenario_name ?? 'Unnamed'}"${(s as { is_default?: boolean }).is_default ? ' (default)' : ''}`).join(', ')}.`)
    }
  }
  sections.push(planLines.join('\n'))
}

async function buildPropertyContext(
  supabase: SupabaseClient,
  userId: string,
  sections: string[],
  focusedPropertyId?: number
) {
  const { data: properties } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('user_id', userId)

  if (!properties?.length) return

  const propIds = properties.map((p: { id: number }) => p.id)
  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .in('Property ID', propIds)

  const propLines: string[] = ['## Property Investments']

  const focusedFirst = focusedPropertyId
    ? [...properties.filter((p: { id: number }) => p.id === focusedPropertyId), ...properties.filter((p: { id: number }) => p.id !== focusedPropertyId)]
    : properties

  for (const prop of focusedFirst) {
    const isFocused = focusedPropertyId === prop.id
    const label = isFocused ? ' ← currently viewing' : ''
    const asking = (prop as Record<string, unknown>)['Asking Price']
    const gross = (prop as Record<string, unknown>)['Gross Income']
    const opEx = (prop as Record<string, unknown>)['Operating Expenses']

    if (focusedPropertyId && !isFocused) {
      propLines.push(
        `Property id=${prop.id}, address: "${(prop as { address?: string }).address ?? 'not set'}", Asking Price: $${Number(asking ?? 0).toLocaleString()}.`
      )
      continue
    }

    propLines.push(
      `Property id=${prop.id}, address: "${(prop as { address?: string }).address ?? 'not set'}"${label}, type: ${(prop as { type?: string }).type ?? 'not set'}, Asking Price: $${Number(asking ?? 0).toLocaleString()}, Gross Income: $${Number(gross ?? 0).toLocaleString()}/yr, Operating Expenses: $${Number(opEx ?? 0).toLocaleString()}/yr.`
    )
    const propScenarios = (scenarios ?? []).filter((s: { 'Property ID': number }) => s['Property ID'] === prop.id)
    if (propScenarios.length) {
      propLines.push(`  Financial scenarios: ${propScenarios.length} (ids: ${propScenarios.map((s: { id: number }) => s.id).join(', ')}).`)
    }
  }
  sections.push(propLines.join('\n'))
}

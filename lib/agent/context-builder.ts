import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContextScope } from './context-scope'

const ALL_DOMAINS = ['pulse', 'retirement'] as const

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
    if (Number(profile.stock_investments ?? 0) > 0) lines.push(`Stock investments: $${Number(profile.stock_investments).toLocaleString()}`)
    if (Number(profile.real_estate_investments ?? 0) > 0) lines.push(`Real estate investments: $${Number(profile.real_estate_investments).toLocaleString()}`)
    if (profile.home_value != null) lines.push(`Home value: $${Number(profile.home_value).toLocaleString()}`)
    if (profile.mortgage_balance != null) lines.push(`Mortgage balance: $${Number(profile.mortgage_balance).toLocaleString()}`)
    if (profile.college_529_balance != null) lines.push(`College 529 balance: $${Number(profile.college_529_balance).toLocaleString()}`)
    const childAges = profile.child_ages as number[] | null
    if (Array.isArray(childAges) && childAges.length > 0) lines.push(`Child ages: ${childAges.join(', ')}`)

    type DebtEntry = { name?: string; balance?: number; interest_rate?: number; min_payment?: number }
    const debts = profile.debts as DebtEntry[] | null
    if (Array.isArray(debts) && debts.length > 0) {
      lines.push(`Debts:`)
      for (const d of debts) {
        const parts = [`  - ${d.name ?? 'Debt'}: $${Number(d.balance ?? 0).toLocaleString()}`]
        if (d.interest_rate != null) parts.push(`${d.interest_rate}% APR`)
        if (d.min_payment != null) parts.push(`min $${d.min_payment}/mo`)
        lines.push(parts.join(', '))
      }
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

  // Fetch calculator settings for all scenarios so the model knows current assumptions
  const scenarioIds = scenarios.map((s: { id: number }) => s.id)
  const settingsRes = scenarioIds.length > 0
    ? await supabase.from('rp_calculator_settings').select('*').in('scenario_id', scenarioIds)
    : { data: [] }
  const allSettings = settingsRes.data ?? []

  const planLines: string[] = ['## Retirement Plans']
  const currentYear = new Date().getFullYear()

  const focusedFirst = focusedPlanId
    ? [...plans.filter((p) => p.id === focusedPlanId), ...plans.filter((p) => p.id !== focusedPlanId)]
    : plans

  for (const plan of focusedFirst) {
    const isFocused = focusedPlanId === plan.id
    const label = isFocused ? ' ← currently viewing' : ''
    const currentAge = plan.birth_year ? currentYear - plan.birth_year : null

    planLines.push(
      `\nPlan id=${plan.id}, name: "${plan.plan_name ?? 'Unnamed'}"${label}` +
      `, birth_year: ${plan.birth_year ?? 'not set'}${currentAge != null ? ` (current age: ${currentAge})` : ''}` +
      `, life_expectancy: ${plan.life_expectancy ?? 'not set'}` +
      `, filing_status: ${plan.filing_status ?? 'not set'}` +
      `, include_spouse: ${plan.include_spouse ?? false}` +
      (plan.spouse_birth_year != null ? `, spouse_birth_year: ${plan.spouse_birth_year}, spouse_life_expectancy: ${plan.spouse_life_expectancy ?? 'not set'}` : '') +
      '.'
    )

    if (focusedPlanId && !isFocused) {
      const planAccounts = accounts.filter((a: { plan_id: number }) => a.plan_id === plan.id)
      const totalBalance = planAccounts.reduce((sum: number, a: { balance?: number }) => sum + Number(a.balance ?? 0), 0)
      if (planAccounts.length) {
        planLines.push(`  (${planAccounts.length} accounts, total $${totalBalance.toLocaleString()})`)
      }
      continue
    }

    // -- Accounts (with full detail) --
    const planAccounts = accounts.filter((a: { plan_id: number }) => a.plan_id === plan.id)
    if (planAccounts.length) {
      const totalBalance = planAccounts.reduce((sum: number, a: { balance?: number }) => sum + Number(a.balance ?? 0), 0)
      const totalContrib = planAccounts.reduce((sum: number, a: { annual_contribution?: number }) => sum + Number(a.annual_contribution ?? 0), 0)
      planLines.push(`  Accounts (${planAccounts.length}, total balance: $${totalBalance.toLocaleString()}, total annual contributions: $${totalContrib.toLocaleString()}):`)
      for (const a of planAccounts) {
        const acc = a as { id: number; account_name?: string; account_type?: string; owner?: string; balance?: number; annual_contribution?: number }
        planLines.push(
          `    - id=${acc.id} "${acc.account_name ?? 'Account'}" type=${acc.account_type ?? 'unknown'}, owner=${acc.owner ?? 'planner'}` +
          `, balance: $${Number(acc.balance ?? 0).toLocaleString()}, annual contribution: $${Number(acc.annual_contribution ?? 0).toLocaleString()}`
        )
      }
    }

    // -- Expenses (with IDs) --
    const planExpenses = expenses.filter((e: { plan_id: number }) => e.plan_id === plan.id)
    if (planExpenses.length) {
      const totalMonthly = planExpenses.reduce((sum: number, e: { amount_before_65?: number }) => sum + Number(e.amount_before_65 ?? 0), 0)
      planLines.push(`  Expenses (${planExpenses.length}, total: $${totalMonthly.toLocaleString()}/mo before 65):`)
      for (const e of planExpenses) {
        const exp = e as { id: number; expense_name?: string; amount_before_65?: number; amount_after_65?: number }
        planLines.push(
          `    - id=${exp.id} "${exp.expense_name ?? 'Expense'}": $${Number(exp.amount_before_65 ?? 0).toLocaleString()}/mo before 65, $${Number(exp.amount_after_65 ?? 0).toLocaleString()}/mo after 65`
        )
      }
    }

    // -- Other Income (SSA, pensions, etc.) --
    const planOtherIncome = otherIncome.filter((i: { plan_id: number }) => i.plan_id === plan.id)
    if (planOtherIncome.length) {
      planLines.push(`  Other Income (${planOtherIncome.length}):`)
      for (const i of planOtherIncome) {
        const inc = i as { id: number; income_name?: string; annual_amount?: number; start_age?: number; end_age?: number; cola?: boolean | number }
        const colaFlag = inc.cola ? ' (inflation-adjusted)' : ''
        planLines.push(
          `    - id=${inc.id} "${inc.income_name ?? 'Income'}": $${Number(inc.annual_amount ?? 0).toLocaleString()}/yr, ages ${inc.start_age ?? '?'}–${inc.end_age ?? '?'}${colaFlag}`
        )
      }
    }

    // -- Scenarios + Calculator Settings --
    const planScenarios = scenarios.filter((s: { plan_id: number }) => s.plan_id === plan.id)
    if (planScenarios.length) {
      planLines.push(`  Scenarios:`)
      for (const s of planScenarios) {
        const scen = s as { id: number; scenario_name?: string; is_default?: boolean }
        const defaultLabel = scen.is_default ? ' (default)' : ''
        planLines.push(`    - id=${scen.id} "${scen.scenario_name ?? 'Unnamed'}"${defaultLabel}`)

        // Include calculator settings for this scenario
        const settings = allSettings.find((st: { scenario_id: number }) => st.scenario_id === scen.id) as Record<string, unknown> | undefined
        if (settings) {
          const settingParts: string[] = []
          if (settings.retirement_age != null) settingParts.push(`retirement_age: ${settings.retirement_age}`)
          if (settings.growth_rate_before_retirement != null) settingParts.push(`pre-retirement return: ${(Number(settings.growth_rate_before_retirement) * 100).toFixed(1)}%`)
          if (settings.growth_rate_during_retirement != null) settingParts.push(`post-retirement return: ${(Number(settings.growth_rate_during_retirement) * 100).toFixed(1)}%`)
          if (settings.inflation_rate != null) settingParts.push(`inflation: ${(Number(settings.inflation_rate) * 100).toFixed(1)}%`)
          if (settings.ssa_start_age != null) settingParts.push(`SSA start age: ${settings.ssa_start_age}`)
          if (settings.planner_ssa_annual_benefit != null || settings.estimated_ssa_annual_income != null) {
            const ssaBenefit = Number(settings.planner_ssa_annual_benefit ?? settings.estimated_ssa_annual_income ?? 0)
            if (ssaBenefit > 0) settingParts.push(`estimated SSA benefit: $${ssaBenefit.toLocaleString()}/yr`)
          }
          if (settings.spouse_ssa_annual_benefit != null && Number(settings.spouse_ssa_annual_benefit) > 0) {
            settingParts.push(`spouse SSA benefit: $${Number(settings.spouse_ssa_annual_benefit).toLocaleString()}/yr`)
          }
          if (settings.pre_medicare_annual_premium != null && Number(settings.pre_medicare_annual_premium) > 0) {
            settingParts.push(`pre-Medicare health insurance: $${Math.round(Number(settings.pre_medicare_annual_premium) / 12).toLocaleString()}/mo`)
          }
          if (settings.post_medicare_annual_premium != null && Number(settings.post_medicare_annual_premium) > 0) {
            settingParts.push(`post-Medicare premium: $${Math.round(Number(settings.post_medicare_annual_premium) / 12).toLocaleString()}/mo`)
          }
          if (settings.withdrawal_strategy_type) settingParts.push(`withdrawal strategy: ${settings.withdrawal_strategy_type}`)
          if (settings.annual_retirement_expenses != null) settingParts.push(`annual retirement expenses: $${Number(settings.annual_retirement_expenses).toLocaleString()}`)
          if (settingParts.length > 0) {
            planLines.push(`      Settings: ${settingParts.join(', ')}`)
          }
        }
      }
    }
  }
  sections.push(planLines.join('\n'))
}


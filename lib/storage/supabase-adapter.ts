import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account, Expense, OtherIncome, CalculatorSettings, ProjectionDetail } from '@/lib/utils/retirement-projections'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'
import type { DataService, Plan, LocalPlanData } from './types'
import { LOCAL_STORAGE_KEY } from './types'

/**
 * Supabase-backed DataService.
 * Wraps existing direct Supabase calls behind the DataService interface
 * so components can work with either local or remote storage.
 */
export class SupabaseDataService implements DataService {
  readonly mode = 'supabase' as const
  private supabase: SupabaseClient
  private planId: number
  private scenarioId: number

  constructor(supabase: SupabaseClient, planId: number, scenarioId: number) {
    this.supabase = supabase
    this.planId = planId
    this.scenarioId = scenarioId
  }

  setPlanId(id: number) { this.planId = id }
  setScenarioId(id: number) { this.scenarioId = id }

  // ── Plan ──

  async getPlan(): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('rp_retirement_plans')
      .select('id, plan_name, birth_year, life_expectancy, filing_status, include_spouse, spouse_birth_year, spouse_life_expectancy')
      .eq('id', this.planId)
      .single()
    if (error || !data) return null
    return data as Plan
  }

  async savePlan(updates: Partial<Plan>): Promise<Plan> {
    const { data, error } = await this.supabase
      .from('rp_retirement_plans')
      .update(updates)
      .eq('id', this.planId)
      .select('id, plan_name, birth_year, life_expectancy, filing_status, include_spouse, spouse_birth_year, spouse_life_expectancy')
      .single()
    if (error) throw error
    return data as Plan
  }

  // ── Accounts ──

  async getAccounts(): Promise<Account[]> {
    const { data } = await this.supabase
      .from('rp_accounts')
      .select('*')
      .eq('plan_id', this.planId)
    return (data || []).map(a => ({
      id: a.id,
      account_name: a.account_name,
      owner: a.owner || '',
      balance: a.balance || 0,
      account_type: a.account_type,
      annual_contribution: a.annual_contribution || 0,
    }))
  }

  async saveAccount(account: Account): Promise<Account> {
    if (account.id) {
      const { data, error } = await this.supabase
        .from('rp_accounts')
        .update({
          account_name: account.account_name,
          owner: account.owner,
          balance: account.balance,
          account_type: account.account_type,
          annual_contribution: account.annual_contribution,
        })
        .eq('id', account.id)
        .select()
        .single()
      if (error) throw error
      return data as Account
    }
    const { data, error } = await this.supabase
      .from('rp_accounts')
      .insert({
        plan_id: this.planId,
        account_name: account.account_name,
        owner: account.owner,
        balance: account.balance,
        account_type: account.account_type,
        annual_contribution: account.annual_contribution,
      })
      .select()
      .single()
    if (error) throw error
    return data as Account
  }

  async deleteAccount(id: number | string): Promise<void> {
    const { error } = await this.supabase.from('rp_accounts').delete().eq('id', Number(id))
    if (error) throw error
  }

  // ── Expenses ──

  async getExpenses(): Promise<Expense[]> {
    const { data } = await this.supabase
      .from('rp_expenses')
      .select('*')
      .eq('plan_id', this.planId)
    return (data || []).map(e => ({
      id: e.id,
      expense_name: e.expense_name,
      amount_before_65: e.amount_before_65 || 0,
      amount_after_65: e.amount_after_65 || 0,
    }))
  }

  async saveExpense(expense: Expense): Promise<Expense> {
    if (expense.id) {
      const { data, error } = await this.supabase
        .from('rp_expenses')
        .update({
          expense_name: expense.expense_name,
          amount_before_65: expense.amount_before_65,
          amount_after_65: expense.amount_after_65,
        })
        .eq('id', expense.id)
        .select()
        .single()
      if (error) throw error
      return data as Expense
    }
    const { data, error } = await this.supabase
      .from('rp_expenses')
      .insert({
        plan_id: this.planId,
        expense_name: expense.expense_name,
        amount_before_65: expense.amount_before_65,
        amount_after_65: expense.amount_after_65,
      })
      .select()
      .single()
    if (error) throw error
    return data as Expense
  }

  async deleteExpense(id: number | string): Promise<void> {
    const { error } = await this.supabase.from('rp_expenses').delete().eq('id', Number(id))
    if (error) throw error
  }

  // ── Other Income ──

  async getOtherIncome(): Promise<OtherIncome[]> {
    const { data } = await this.supabase
      .from('rp_other_income')
      .select('*')
      .eq('plan_id', this.planId)
    return (data || []).map(i => ({
      id: i.id,
      income_name: i.income_source || '',
      amount: i.annual_amount || 0,
      start_year: i.start_year || undefined,
      end_year: i.end_year || undefined,
      inflation_adjusted: i.inflation_adjusted || false,
    }))
  }

  async saveOtherIncome(income: OtherIncome): Promise<OtherIncome> {
    if (income.id) {
      const { data, error } = await this.supabase
        .from('rp_other_income')
        .update({
          income_source: income.income_name,
          annual_amount: income.amount,
          start_year: income.start_year,
          end_year: income.end_year,
          inflation_adjusted: income.inflation_adjusted,
        })
        .eq('id', income.id)
        .select()
        .single()
      if (error) throw error
      return { ...income, id: data.id }
    }
    const { data, error } = await this.supabase
      .from('rp_other_income')
      .insert({
        plan_id: this.planId,
        income_source: income.income_name,
        annual_amount: income.amount,
        start_year: income.start_year,
        end_year: income.end_year,
        inflation_adjusted: income.inflation_adjusted,
      })
      .select()
      .single()
    if (error) throw error
    return { ...income, id: data.id }
  }

  async deleteOtherIncome(id: number | string): Promise<void> {
    const { error } = await this.supabase.from('rp_other_income').delete().eq('id', Number(id))
    if (error) throw error
  }

  // ── Settings ──

  async getSettings(): Promise<Partial<CalculatorSettings> | null> {
    const { data, error } = await this.supabase
      .from('rp_calculator_settings')
      .select('*')
      .eq('scenario_id', this.scenarioId)
      .single()
    if (error || !data) return null
    return data as Partial<CalculatorSettings>
  }

  async saveSettings(settings: Partial<CalculatorSettings>): Promise<void> {
    const { error } = await this.supabase
      .from('rp_calculator_settings')
      .upsert({ ...settings, scenario_id: this.scenarioId }, { onConflict: 'scenario_id' })
    if (error) throw error
  }

  // ── Projections ──

  async getProjections(): Promise<ProjectionDetail[]> {
    const { data } = await this.supabase
      .from('rp_projection_details')
      .select('*')
      .eq('scenario_id', this.scenarioId)
      .order('year')
    return (data || []) as ProjectionDetail[]
  }

  async saveProjections(projections: ProjectionDetail[]): Promise<void> {
    await this.supabase.from('rp_projection_details').delete().eq('scenario_id', this.scenarioId)
    if (projections.length > 0) {
      const rows = projections.map(p => ({ ...p, plan_id: this.planId, scenario_id: this.scenarioId }))
      const { error } = await this.supabase.from('rp_projection_details').upsert(rows, { onConflict: 'scenario_id,year' })
      if (error) throw error
    }
  }

  // ── Calculator Defaults ──

  async getCalculatorDefaults(): Promise<Partial<RetirementAssumptions> | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await this.supabase
      .from('rp_calculator_defaults')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (error || !data) return null
    return data.defaults as Partial<RetirementAssumptions>
  }

  async saveCalculatorDefaults(defaults: Partial<RetirementAssumptions>): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return
    await this.supabase
      .from('rp_calculator_defaults')
      .upsert({ user_id: user.id, defaults }, { onConflict: 'user_id' })
  }

  // ── Local data helpers (no-ops for Supabase adapter, used by migration) ──

  hasLocalData(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LOCAL_STORAGE_KEY) !== null
  }

  exportLocalData(): LocalPlanData | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  clearLocalData(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY)
  }
}

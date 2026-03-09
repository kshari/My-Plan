/**
 * Shared demographic profile types, usable across all apps.
 * This is the canonical shape for user financial demographics.
 */

export type HouseholdType = 'single' | 'married' | 'married_with_children'

export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household'

export interface Debt {
  name: string
  balance: number
  rate: number
  min_payment: number
}

export interface Subscription {
  name: string
  monthly_cost: number
  category: 'entertainment' | 'productivity' | 'health' | 'news' | 'cloud' | 'other'
}

export interface DemographicProfile {
  id?: string
  user_id?: string
  age: number
  state: string
  household_type: HouseholdType
  household_size: number
  annual_gross_income: number
  filing_status: FilingStatus
  total_retirement_savings: number
  emergency_fund: number
  stock_investments: number
  real_estate_investments: number
  monthly_expenses: number
  monthly_savings: number
  home_value: number | null
  mortgage_balance: number | null
  debts: Debt[]
  college_529_balance: number | null
  child_ages: number[]
  subscriptions: Subscription[]
  explored_scenarios: string[]
  created_at?: string
  updated_at?: string
}

export interface BenchmarkRow {
  metric: string
  age_min: number
  age_max: number
  household_type: HouseholdType | 'all'
  region: string | null
  percentile_25: number
  percentile_50: number
  percentile_75: number
  percentile_90: number
  source: string
  year: number
}

export interface PulseCheck {
  id?: string
  user_id?: string
  check_date: string
  net_worth_snapshot: number
  reflection_question: string
  reflection_answer: string | null
  mood: number
  resilience_score: number
  created_at?: string
}

export const EMPTY_PROFILE: DemographicProfile = {
  age: 35,
  state: '',
  household_type: 'single',
  household_size: 1,
  annual_gross_income: 0,
  filing_status: 'single',
  total_retirement_savings: 0,
  emergency_fund: 0,
  stock_investments: 0,
  real_estate_investments: 0,
  monthly_expenses: 0,
  monthly_savings: 0,
  home_value: null,
  mortgage_balance: null,
  debts: [],
  college_529_balance: null,
  child_ages: [],
  subscriptions: [],
  explored_scenarios: [],
}

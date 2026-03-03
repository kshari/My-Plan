import type {
  Account,
  Expense,
  OtherIncome,
  CalculatorSettings,
  ProjectionDetail,
} from '@/lib/utils/retirement-projections'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'

export interface Plan {
  id?: number | string
  plan_name: string
  birth_year: number
  life_expectancy: number
  filing_status: string
  include_spouse: boolean
  spouse_birth_year?: number
  spouse_life_expectancy?: number
}

export interface LocalPlanData {
  version: 1
  plan: Plan
  accounts: (Account & { _localId?: string })[]
  expenses: (Expense & { _localId?: string })[]
  otherIncome: (OtherIncome & { _localId?: string })[]
  settings: Partial<CalculatorSettings>
  projections: ProjectionDetail[]
  calculatorDefaults: Partial<RetirementAssumptions>
}

/**
 * Unified data service interface.
 * Components use this instead of calling Supabase directly,
 * allowing seamless switching between localStorage and Supabase backends.
 */
export interface DataService {
  readonly mode: 'local' | 'supabase'

  // Plan
  getPlan(): Promise<Plan | null>
  savePlan(data: Partial<Plan>): Promise<Plan>

  // Accounts
  getAccounts(): Promise<Account[]>
  saveAccount(account: Account): Promise<Account>
  deleteAccount(id: number | string): Promise<void>

  // Expenses
  getExpenses(): Promise<Expense[]>
  saveExpense(expense: Expense): Promise<Expense>
  deleteExpense(id: number | string): Promise<void>

  // Other Income
  getOtherIncome(): Promise<OtherIncome[]>
  saveOtherIncome(income: OtherIncome): Promise<OtherIncome>
  deleteOtherIncome(id: number | string): Promise<void>

  // Settings (single scenario for local)
  getSettings(): Promise<Partial<CalculatorSettings> | null>
  saveSettings(settings: Partial<CalculatorSettings>): Promise<void>

  // Projections (cached computation results)
  getProjections(): Promise<ProjectionDetail[]>
  saveProjections(projections: ProjectionDetail[]): Promise<void>

  // Calculator defaults
  getCalculatorDefaults(): Promise<Partial<RetirementAssumptions> | null>
  saveCalculatorDefaults(defaults: Partial<RetirementAssumptions>): Promise<void>

  // Local data helpers
  hasLocalData(): boolean
  exportLocalData(): LocalPlanData | null
  clearLocalData(): void
}

export const LOCAL_STORAGE_KEY = 'rp_local_plan'

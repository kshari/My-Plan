import type { Account, Expense, OtherIncome, CalculatorSettings, ProjectionDetail } from '@/lib/utils/retirement-projections'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'
import type { DataService, Plan, LocalPlanData } from './types'
import { LOCAL_STORAGE_KEY } from './types'

function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function readStore(): LocalPlanData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalPlanData
  } catch {
    return null
  }
}

function writeStore(data: LocalPlanData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
}

function emptyStore(): LocalPlanData {
  return {
    version: 1,
    plan: {
      id: 'local',
      plan_name: 'My Plan',
      birth_year: new Date().getFullYear() - 40,
      life_expectancy: 90,
      filing_status: 'Single',
      include_spouse: false,
    },
    accounts: [],
    expenses: [],
    otherIncome: [],
    settings: {},
    projections: [],
    calculatorDefaults: {},
  }
}

function getOrInit(): LocalPlanData {
  return readStore() ?? emptyStore()
}

export class LocalDataService implements DataService {
  readonly mode = 'local' as const

  async getPlan(): Promise<Plan | null> {
    return getOrInit().plan
  }

  async savePlan(data: Partial<Plan>): Promise<Plan> {
    const store = getOrInit()
    store.plan = { ...store.plan, ...data }
    writeStore(store)
    return store.plan
  }

  // ── Accounts ──

  async getAccounts(): Promise<Account[]> {
    return getOrInit().accounts
  }

  async saveAccount(account: Account): Promise<Account> {
    const store = getOrInit()
    const localId = (account as any)._localId || (account.id ? String(account.id) : null)
    const idx = localId ? store.accounts.findIndex(a => (a as any)._localId === localId || String(a.id) === localId) : -1
    if (idx >= 0) {
      store.accounts[idx] = { ...store.accounts[idx], ...account }
      writeStore(store)
      return store.accounts[idx]
    }
    const newAccount = { ...account, _localId: generateLocalId() }
    store.accounts.push(newAccount)
    writeStore(store)
    return newAccount
  }

  async deleteAccount(id: number | string): Promise<void> {
    const store = getOrInit()
    store.accounts = store.accounts.filter(a => (a as any)._localId !== String(id) && String(a.id) !== String(id))
    writeStore(store)
  }

  // ── Expenses ──

  async getExpenses(): Promise<Expense[]> {
    return getOrInit().expenses
  }

  async saveExpense(expense: Expense): Promise<Expense> {
    const store = getOrInit()
    const localId = (expense as any)._localId || (expense.id ? String(expense.id) : null)
    const idx = localId ? store.expenses.findIndex(e => (e as any)._localId === localId || String(e.id) === localId) : -1
    if (idx >= 0) {
      store.expenses[idx] = { ...store.expenses[idx], ...expense }
      writeStore(store)
      return store.expenses[idx]
    }
    const newExpense = { ...expense, _localId: generateLocalId() }
    store.expenses.push(newExpense)
    writeStore(store)
    return newExpense
  }

  async deleteExpense(id: number | string): Promise<void> {
    const store = getOrInit()
    store.expenses = store.expenses.filter(e => (e as any)._localId !== String(id) && String(e.id) !== String(id))
    writeStore(store)
  }

  // ── Other Income ──

  async getOtherIncome(): Promise<OtherIncome[]> {
    return getOrInit().otherIncome
  }

  async saveOtherIncome(income: OtherIncome): Promise<OtherIncome> {
    const store = getOrInit()
    const localId = (income as any)._localId || (income.id ? String(income.id) : null)
    const idx = localId ? store.otherIncome.findIndex(i => (i as any)._localId === localId || String(i.id) === localId) : -1
    if (idx >= 0) {
      store.otherIncome[idx] = { ...store.otherIncome[idx], ...income }
      writeStore(store)
      return store.otherIncome[idx]
    }
    const newIncome = { ...income, _localId: generateLocalId() }
    store.otherIncome.push(newIncome)
    writeStore(store)
    return newIncome
  }

  async deleteOtherIncome(id: number | string): Promise<void> {
    const store = getOrInit()
    store.otherIncome = store.otherIncome.filter(i => (i as any)._localId !== String(id) && String(i.id) !== String(id))
    writeStore(store)
  }

  // ── Settings ──

  async getSettings(): Promise<Partial<CalculatorSettings> | null> {
    return getOrInit().settings
  }

  async saveSettings(settings: Partial<CalculatorSettings>): Promise<void> {
    const store = getOrInit()
    store.settings = { ...store.settings, ...settings }
    writeStore(store)
  }

  // ── Projections ──

  async getProjections(): Promise<ProjectionDetail[]> {
    return getOrInit().projections
  }

  async saveProjections(projections: ProjectionDetail[]): Promise<void> {
    const store = getOrInit()
    store.projections = projections
    writeStore(store)
  }

  // ── Calculator Defaults ──

  async getCalculatorDefaults(): Promise<Partial<RetirementAssumptions> | null> {
    return getOrInit().calculatorDefaults
  }

  async saveCalculatorDefaults(defaults: Partial<RetirementAssumptions>): Promise<void> {
    const store = getOrInit()
    store.calculatorDefaults = { ...store.calculatorDefaults, ...defaults }
    writeStore(store)
  }

  // ── Local data helpers ──

  hasLocalData(): boolean {
    return readStore() !== null
  }

  exportLocalData(): LocalPlanData | null {
    return readStore()
  }

  clearLocalData(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(LOCAL_STORAGE_KEY)
  }
}

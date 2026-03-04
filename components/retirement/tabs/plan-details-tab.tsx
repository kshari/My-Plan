'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOptionalDataService } from '@/lib/storage'
import { useScenario } from '../scenario-context'
import ScenariosTable from '../scenarios-table'
import DefaultsPopup from '../defaults-popup'
import { CalculatorAssumptionsForm } from '../calculator-assumptions-form'
import {
  Copy, Plus, Trash2, Save, X, User, Wallet, ShoppingCart,
  Pencil, ChevronUp, ChevronDown, SlidersHorizontal,
} from 'lucide-react'
import { calculateAndSaveProjectionsForScenario } from '@/lib/utils/calculate-projections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
  DEFAULT_INFLATION_RATE,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  DEFAULT_INFLATION_RATE_PCT,
  DEFAULT_ENABLE_BORROWING,
  DEFAULT_SSA_START_AGE,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
  DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
  DEFAULT_PLANNER_SSA_INCOME,
  DEFAULT_SPOUSE_SSA_INCOME,
} from '@/lib/constants/retirement-defaults'
import { DEFAULT_PLAN_ACCOUNTS, DEFAULT_EXPENSE_CATEGORIES, ACCOUNT_TYPES } from '@/lib/constants/account-types'
import { TOAST_DURATION_SHORT } from '@/lib/constants/timing'

interface PlanDetailsTabProps {
  planId: number
}

interface Scenario {
  id: number
  scenario_name: string
  is_default: boolean
}

interface Account {
  id?: number
  account_name: string
  owner: string
  balance: number
  account_type?: string
  annual_contribution?: number
}

interface Expense {
  id?: number
  expense_name: string
  amount_after_65: number
  amount_before_65: number
}

const getDefaultAccounts = () => DEFAULT_PLAN_ACCOUNTS.map(a => ({ ...a, owner: '', annual_contribution: 0 }))

const getDefaultExpenses = () => DEFAULT_EXPENSE_CATEGORIES.map(e => ({
  expense_name: e.expense_name,
  amount_after_65: e.annual_amount / 12,
  amount_before_65: e.annual_amount / 12,
}))

const isEssentialExpense = (expenseName: string): boolean => {
  const essentialKeywords = ['rent', 'taxes', 'maint', 'groceries', 'utilities', 'medical', 'essential']
  const lowerName = expenseName.toLowerCase()
  return essentialKeywords.some(keyword => lowerName.includes(keyword))
}

export default function PlanDetailsTab({ planId }: PlanDetailsTabProps) {
  const supabase = createClient()
  const dataService = useOptionalDataService()
  const isLocal = dataService?.mode === 'local'
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const currentYear = new Date().getFullYear()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [showDefaultsPopup, setShowDefaultsPopup] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [scenariosTableRefreshKey, setScenariosTableRefreshKey] = useState(0)

  // Progressive disclosure
  const [accountsExpanded, setAccountsExpanded] = useState(false)
  const [expensesExpanded, setExpensesExpanded] = useState(false)
  const [additionalExpanded, setAdditionalExpanded] = useState(false)

  // Plan Basis
  const [planBasis, setPlanBasis] = useState({
    age: 50,
    birth_year: currentYear - 50,
    filing_status: 'Married Filing Jointly' as 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household',
    life_expectancy: 90,
    include_spouse: false,
    spouse_birth_year: currentYear - 50,
    spouse_life_expectancy: 90,
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])

  // Scenario Variables (extended with SSA amounts + healthcare)
  const [scenarioVars, setScenarioVars] = useState({
    retirement_age: DEFAULT_RETIREMENT_AGE,
    growth_rate_before_retirement: DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
    growth_rate_during_retirement: DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
    inflation_rate: DEFAULT_INFLATION_RATE_PCT,
    enable_borrowing: DEFAULT_ENABLE_BORROWING,
    ssa_start_age: DEFAULT_SSA_START_AGE,
    planner_ssa_income: DEFAULT_PLANNER_SSA_INCOME,
    spouse_ssa_income: DEFAULT_SPOUSE_SSA_INCOME,
    planner_ssa_annual_benefit: null as number | null,
    spouse_ssa_annual_benefit: null as number | null,
    pre_medicare_annual_premium: null as number | null,
    post_medicare_annual_premium: null as number | null,
  })

  // --- Data loading ---

  useEffect(() => {
    loadAll()
  }, [planId])

  useEffect(() => {
    if (selectedScenarioId) loadScenarioVars()
  }, [selectedScenarioId])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadPlanBasis(), loadAccounts(), loadExpenses(), loadScenarios()])
    setLoading(false)
  }

  const loadPlanBasis = async () => {
    try {
      if (isLocal && dataService) {
        const plan = await dataService.getPlan()
        if (plan && (plan as any).birth_year) {
          const d = plan as any
          const age = currentYear - d.birth_year
          setPlanBasis({
            age,
            birth_year: d.birth_year,
            filing_status: d.filing_status || 'Married Filing Jointly',
            life_expectancy: d.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
            include_spouse: d.include_spouse || false,
            spouse_birth_year: d.spouse_birth_year || d.birth_year,
            spouse_life_expectancy: d.spouse_life_expectancy || DEFAULT_LIFE_EXPECTANCY,
          })
        }
        return
      }

      const { data } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year, filing_status, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy')
        .eq('id', planId)
        .single()

      if (data?.birth_year) {
        const age = currentYear - data.birth_year
        setPlanBasis({
          age,
          birth_year: data.birth_year,
          filing_status: data.filing_status || 'Married Filing Jointly',
          life_expectancy: data.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
          include_spouse: data.include_spouse || false,
          spouse_birth_year: data.spouse_birth_year || data.birth_year,
          spouse_life_expectancy: data.spouse_life_expectancy || DEFAULT_LIFE_EXPECTANCY,
        })
      }
    } catch (error) {
      console.error('Error loading plan basis:', error)
    }
  }

  const loadAccounts = async () => {
    try {
      if (isLocal && dataService) {
        const accts = await dataService.getAccounts()
        setAccounts(accts.length > 0 ? accts : getDefaultAccounts())
        return
      }

      const { data, error } = await supabase.from('rp_accounts').select('*').eq('plan_id', planId).order('id')
      if (error) throw error
      if (!data || data.length === 0) {
        setAccounts(getDefaultAccounts())
      } else {
        setAccounts(data.map(acc => ({ ...acc, annual_contribution: acc.annual_contribution || 0 })))
      }
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  const loadExpenses = async () => {
    try {
      if (isLocal && dataService) {
        const exps = await dataService.getExpenses()
        setExpenses(exps.length > 0 ? exps : getDefaultExpenses())
        return
      }

      const { data, error } = await supabase.from('rp_expenses').select('*').eq('plan_id', planId).order('id')
      if (error) throw error
      if (!data || data.length === 0) {
        setExpenses(getDefaultExpenses())
      } else {
        setExpenses(data)
      }
    } catch (error) {
      console.error('Error loading expenses:', error)
    }
  }

  const loadScenarios = async () => {
    if (isLocal) {
      const localScenario = { id: 0, scenario_name: 'Base Scenario', is_default: true }
      setScenarios([localScenario])
      if (!selectedScenarioId) setSelectedScenarioId(0)
      return
    }
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('*')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      setScenarios(data || [])
      if (data && data.length > 0) {
        const defaultScenario = data.find(s => s.is_default) || data[0]
        setSelectedScenarioId(defaultScenario.id)
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const loadScenarioVars = async () => {
    if (!isLocal && !selectedScenarioId) return
    try {
      if (isLocal && dataService) {
        const stg = await dataService.getSettings()
        if (stg) {
          const d = stg as any
          setScenarioVars({
            retirement_age: d.retirement_age || DEFAULT_RETIREMENT_AGE,
            ssa_start_age: d.ssa_start_age || d.retirement_age || DEFAULT_SSA_START_AGE,
            growth_rate_before_retirement: parseFloat(d.growth_rate_before_retirement?.toString() || String(DEFAULT_GROWTH_RATE_PRE_RETIREMENT)) * 100,
            growth_rate_during_retirement: parseFloat(d.growth_rate_during_retirement?.toString() || String(DEFAULT_GROWTH_RATE_DURING_RETIREMENT)) * 100,
            inflation_rate: parseFloat(d.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE)) * 100,
            enable_borrowing: d.enable_borrowing ?? DEFAULT_ENABLE_BORROWING,
            planner_ssa_income: d.planner_ssa_income ?? DEFAULT_PLANNER_SSA_INCOME,
            spouse_ssa_income: d.spouse_ssa_income ?? DEFAULT_SPOUSE_SSA_INCOME,
            planner_ssa_annual_benefit: d.planner_ssa_annual_benefit ?? null,
            spouse_ssa_annual_benefit: d.spouse_ssa_annual_benefit ?? null,
            pre_medicare_annual_premium: d.pre_medicare_annual_premium ?? null,
            post_medicare_annual_premium: d.post_medicare_annual_premium ?? null,
          })
        }
        return
      }

      const { data } = await supabase
        .from('rp_calculator_settings')
        .select('*')
        .eq('scenario_id', selectedScenarioId)
        .single()

      if (data) {
        setScenarioVars({
          retirement_age: data.retirement_age || DEFAULT_RETIREMENT_AGE,
          ssa_start_age: data.ssa_start_age || data.retirement_age || DEFAULT_SSA_START_AGE,
          growth_rate_before_retirement: parseFloat(data.growth_rate_before_retirement?.toString() || String(DEFAULT_GROWTH_RATE_PRE_RETIREMENT)) * 100,
          growth_rate_during_retirement: parseFloat(data.growth_rate_during_retirement?.toString() || String(DEFAULT_GROWTH_RATE_DURING_RETIREMENT)) * 100,
          inflation_rate: parseFloat(data.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE)) * 100,
          enable_borrowing: data.enable_borrowing ?? DEFAULT_ENABLE_BORROWING,
          planner_ssa_income: data.planner_ssa_income ?? DEFAULT_PLANNER_SSA_INCOME,
          spouse_ssa_income: data.spouse_ssa_income ?? DEFAULT_SPOUSE_SSA_INCOME,
          planner_ssa_annual_benefit: data.planner_ssa_annual_benefit ?? null,
          spouse_ssa_annual_benefit: data.spouse_ssa_annual_benefit ?? null,
          pre_medicare_annual_premium: data.pre_medicare_annual_premium ?? null,
          post_medicare_annual_premium: data.post_medicare_annual_premium ?? null,
        })
      }
    } catch (error) {
      console.error('Error loading scenario vars:', error)
    }
  }

  const loadDefaultsToScenarioVars = async () => {
    try {
      const { data: defaultSettingsData } = await supabase
        .from('rp_default_settings')
        .select('*')
        .eq('plan_id', planId)

      const defaults = defaultSettingsData || []
      const getDefault = (name: string, fallback: number) => {
        const setting = defaults.find((d: any) => d.setting_name === name)
        return setting ? setting.setting_value : fallback
      }

      setScenarioVars({
        retirement_age: DEFAULT_RETIREMENT_AGE,
        growth_rate_before_retirement: getDefault('Growth rate (return) before retirement', DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT),
        growth_rate_during_retirement: getDefault('Growth rate (return) during retirement', DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT),
        inflation_rate: getDefault('Inflation', DEFAULT_INFLATION_RATE_PCT),
        enable_borrowing: DEFAULT_ENABLE_BORROWING,
        ssa_start_age: DEFAULT_SSA_START_AGE,
        planner_ssa_income: DEFAULT_PLANNER_SSA_INCOME,
        spouse_ssa_income: DEFAULT_SPOUSE_SSA_INCOME,
        planner_ssa_annual_benefit: null,
        spouse_ssa_annual_benefit: null,
        pre_medicare_annual_premium: null,
        post_medicare_annual_premium: null,
      })
    } catch (error) {
      console.error('Error loading defaults:', error)
      setScenarioVars(prev => ({
        ...prev,
        retirement_age: DEFAULT_RETIREMENT_AGE,
        growth_rate_before_retirement: DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
        growth_rate_during_retirement: DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
        inflation_rate: DEFAULT_INFLATION_RATE_PCT,
        enable_borrowing: DEFAULT_ENABLE_BORROWING,
      }))
    }
  }

  // --- Derived assumptions (bidirectional sync with CalculatorAssumptionsForm) ---

  const assumptions: RetirementAssumptions = useMemo(() => ({
    age: planBasis.age,
    retirementAge: scenarioVars.retirement_age,
    lifeExpectancy: planBasis.life_expectancy,
    currentSavings: accounts.reduce((s, a) => s + (a.balance || 0), 0),
    annualContribution: accounts.reduce((s, a) => s + (a.annual_contribution || 0), 0),
    monthlyExpenses: expenses.reduce((s, e) => {
      const amt = scenarioVars.retirement_age >= 65 ? e.amount_after_65 : e.amount_before_65
      return s + (amt || 0)
    }, 0),
    growthRatePreRetirement: scenarioVars.growth_rate_before_retirement,
    growthRateDuringRetirement: scenarioVars.growth_rate_during_retirement,
    inflationRate: scenarioVars.inflation_rate,
    includeSsa: scenarioVars.planner_ssa_income,
    ssaStartAge: scenarioVars.ssa_start_age,
    ssaAnnualBenefit: scenarioVars.planner_ssa_annual_benefit ?? DEFAULT_SSA_ANNUAL_BENEFIT,
    includeSpouse: planBasis.include_spouse,
    spouseAge: planBasis.include_spouse ? currentYear - planBasis.spouse_birth_year : planBasis.age,
    spouseSsaBenefit: scenarioVars.spouse_ssa_annual_benefit ?? DEFAULT_SPOUSE_SSA_BENEFIT,
    preMedicareAnnualPremium: scenarioVars.pre_medicare_annual_premium ?? DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
    postMedicareAnnualPremium: scenarioVars.post_medicare_annual_premium ?? DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
  }), [planBasis, scenarioVars, accounts, expenses, currentYear])

  const handleAssumptionsChange = (next: RetirementAssumptions) => {
    // Plan basis fields
    if (next.age !== assumptions.age) {
      setPlanBasis(b => ({ ...b, age: next.age, birth_year: currentYear - next.age }))
    }
    if (next.lifeExpectancy !== assumptions.lifeExpectancy) {
      setPlanBasis(b => ({ ...b, life_expectancy: next.lifeExpectancy }))
    }
    if (next.includeSpouse !== assumptions.includeSpouse) {
      setPlanBasis(b => ({ ...b, include_spouse: next.includeSpouse }))
    }
    if (next.spouseAge !== assumptions.spouseAge) {
      setPlanBasis(b => ({ ...b, spouse_birth_year: currentYear - next.spouseAge }))
    }

    // Aggregate fields: proportional distribution
    if (next.currentSavings !== assumptions.currentSavings) {
      const total = assumptions.currentSavings
      if (accounts.length <= 1) {
        setAccounts(accts => accts.map(a => ({ ...a, balance: next.currentSavings })))
      } else if (total > 0) {
        const ratio = next.currentSavings / total
        setAccounts(accts => accts.map(a => ({ ...a, balance: Math.round(a.balance * ratio) })))
      }
    }
    if (next.annualContribution !== assumptions.annualContribution) {
      const total = assumptions.annualContribution
      if (accounts.length <= 1) {
        setAccounts(accts => accts.map(a => ({ ...a, annual_contribution: next.annualContribution })))
      } else if (total > 0) {
        const ratio = next.annualContribution / total
        setAccounts(accts => accts.map(a => ({ ...a, annual_contribution: Math.round((a.annual_contribution || 0) * ratio) })))
      }
    }
    if (next.monthlyExpenses !== assumptions.monthlyExpenses) {
      const total = assumptions.monthlyExpenses
      if (expenses.length <= 1) {
        setExpenses(exps => exps.map(e => ({
          ...e, amount_before_65: next.monthlyExpenses, amount_after_65: next.monthlyExpenses,
        })))
      } else if (total > 0) {
        const ratio = next.monthlyExpenses / total
        setExpenses(exps => exps.map(e => ({
          ...e,
          amount_before_65: Math.round(e.amount_before_65 * ratio),
          amount_after_65: Math.round(e.amount_after_65 * ratio),
        })))
      }
    }

    // Scenario variables
    const sv: Partial<typeof scenarioVars> = {}
    if (next.retirementAge !== assumptions.retirementAge) sv.retirement_age = next.retirementAge
    if (next.growthRatePreRetirement !== assumptions.growthRatePreRetirement) sv.growth_rate_before_retirement = next.growthRatePreRetirement
    if (next.growthRateDuringRetirement !== assumptions.growthRateDuringRetirement) sv.growth_rate_during_retirement = next.growthRateDuringRetirement
    if (next.inflationRate !== assumptions.inflationRate) sv.inflation_rate = next.inflationRate
    if (next.includeSsa !== assumptions.includeSsa) sv.planner_ssa_income = next.includeSsa
    if (next.ssaStartAge !== assumptions.ssaStartAge) sv.ssa_start_age = next.ssaStartAge
    if (next.ssaAnnualBenefit !== assumptions.ssaAnnualBenefit) sv.planner_ssa_annual_benefit = next.ssaAnnualBenefit
    if (next.spouseSsaBenefit !== assumptions.spouseSsaBenefit) sv.spouse_ssa_annual_benefit = next.spouseSsaBenefit
    if (next.preMedicareAnnualPremium !== assumptions.preMedicareAnnualPremium) sv.pre_medicare_annual_premium = next.preMedicareAnnualPremium
    if (next.postMedicareAnnualPremium !== assumptions.postMedicareAnnualPremium) sv.post_medicare_annual_premium = next.postMedicareAnnualPremium
    if (Object.keys(sv).length > 0) setScenarioVars(v => ({ ...v, ...sv }))
  }

  // --- Save (unified) ---

  const handleSaveAll = async () => {
    if (!isLocal && !selectedScenarioId) {
      setMessage({ type: 'error', text: 'Please select or create a scenario first.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      if (isLocal && dataService) {
        // Save everything to localStorage via DataService
        await dataService.savePlan({
          plan_name: 'My Plan',
          birth_year: planBasis.birth_year,
          filing_status: planBasis.filing_status,
          life_expectancy: planBasis.life_expectancy,
          include_spouse: planBasis.include_spouse,
          spouse_birth_year: planBasis.include_spouse ? planBasis.spouse_birth_year : undefined,
          spouse_life_expectancy: planBasis.include_spouse ? planBasis.spouse_life_expectancy : undefined,
        })
        for (const account of accounts) await dataService.saveAccount(account)
        for (const expense of expenses) await dataService.saveExpense(expense)

        const yearsToRet = scenarioVars.retirement_age - planBasis.age
        const totalMonthly = expenses.reduce((sum, exp) => {
          const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
          return sum + (amount || 0)
        }, 0)
        const annualExpensesToday = totalMonthly * 12
        const inflationMult = Math.pow(1 + (scenarioVars.inflation_rate / 100), Math.max(yearsToRet, 0))

        await dataService.saveSettings({
          current_year: currentYear,
          retirement_age: scenarioVars.retirement_age,
          retirement_start_year: currentYear + yearsToRet,
          years_to_retirement: yearsToRet,
          annual_retirement_expenses: annualExpensesToday * inflationMult,
          growth_rate_before_retirement: scenarioVars.growth_rate_before_retirement / 100,
          growth_rate_during_retirement: scenarioVars.growth_rate_during_retirement / 100,
          inflation_rate: scenarioVars.inflation_rate / 100,
          enable_borrowing: scenarioVars.enable_borrowing,
          ssa_start_age: scenarioVars.ssa_start_age || scenarioVars.retirement_age,
        } as any)

        await Promise.all([loadAccounts(), loadExpenses(), loadScenarioVars()])
        setMessage({ type: 'success', text: 'Plan saved locally!' })
        setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
        window.dispatchEvent(new CustomEvent('switchTab', { detail: 'quick-analysis' }))
        return
      }

      // 1. Plan basis
      const { error: planError } = await supabase
        .from('rp_retirement_plans')
        .update({
          birth_year: planBasis.birth_year,
          filing_status: planBasis.filing_status,
          life_expectancy: planBasis.life_expectancy,
          include_spouse: planBasis.include_spouse,
          spouse_birth_year: planBasis.include_spouse ? planBasis.spouse_birth_year : null,
          spouse_life_expectancy: planBasis.include_spouse ? planBasis.spouse_life_expectancy : null,
        })
        .eq('id', planId)
      if (planError) throw planError

      // 2. Accounts
      for (const account of accounts) {
        if (account.id) {
          const { error } = await supabase.from('rp_accounts').update({
            account_name: account.account_name, owner: account.owner,
            balance: account.balance, account_type: account.account_type,
            annual_contribution: account.annual_contribution || 0,
          }).eq('id', account.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('rp_accounts').insert([{
            plan_id: planId, account_name: account.account_name, owner: account.owner,
            balance: account.balance, account_type: account.account_type,
            annual_contribution: account.annual_contribution || 0,
          }])
          if (error) throw error
        }
      }

      // 3. Expenses
      for (const expense of expenses) {
        if (expense.id) {
          const { error } = await supabase.from('rp_expenses').update({
            expense_name: expense.expense_name,
            amount_after_65: expense.amount_after_65, amount_before_65: expense.amount_before_65,
          }).eq('id', expense.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('rp_expenses').insert([{
            plan_id: planId, expense_name: expense.expense_name,
            amount_after_65: expense.amount_after_65, amount_before_65: expense.amount_before_65,
          }])
          if (error) throw error
        }
      }

      // 4. Scenario settings (upsert)
      const yearsToRet = scenarioVars.retirement_age - planBasis.age
      const totalMonthly = expenses.reduce((sum, exp) => {
        const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
        return sum + (amount || 0)
      }, 0)
      const annualExpensesToday = totalMonthly * 12
      const inflationMult = Math.pow(1 + (scenarioVars.inflation_rate / 100), Math.max(yearsToRet, 0))

      const { error: settingsError } = await supabase
        .from('rp_calculator_settings')
        .upsert({
          plan_id: planId,
          scenario_id: selectedScenarioId,
          current_year: currentYear,
          retirement_age: scenarioVars.retirement_age,
          retirement_start_year: currentYear + yearsToRet,
          years_to_retirement: yearsToRet,
          annual_retirement_expenses: annualExpensesToday * inflationMult,
          growth_rate_before_retirement: scenarioVars.growth_rate_before_retirement / 100,
          growth_rate_during_retirement: scenarioVars.growth_rate_during_retirement / 100,
          loan_rate: 0.1,
          inflation_rate: scenarioVars.inflation_rate / 100,
          enable_borrowing: scenarioVars.enable_borrowing,
          ssa_start_age: scenarioVars.ssa_start_age || scenarioVars.retirement_age,
          planner_ssa_income: scenarioVars.planner_ssa_income,
          spouse_ssa_income: scenarioVars.spouse_ssa_income,
          planner_ssa_annual_benefit: scenarioVars.planner_ssa_annual_benefit,
          spouse_ssa_annual_benefit: scenarioVars.spouse_ssa_annual_benefit,
          pre_medicare_annual_premium: scenarioVars.pre_medicare_annual_premium,
          post_medicare_annual_premium: scenarioVars.post_medicare_annual_premium,
        }, { onConflict: 'scenario_id' })
      if (settingsError) throw settingsError

      // 5. Recalculate projections for all scenarios
      const { data: allScenarios } = await supabase
        .from('rp_scenarios').select('id').eq('plan_id', planId)
      if (allScenarios) {
        for (const s of allScenarios) {
          try {
            await calculateAndSaveProjectionsForScenario(planId, s.id, planBasis.life_expectancy || 100)
          } catch (e) {
            console.error(`Projection calc failed for scenario ${s.id}:`, e)
          }
        }
      }

      // 6. Reload
      await Promise.all([loadAccounts(), loadExpenses(), loadScenarioVars()])

      setMessage({ type: 'success', text: 'Plan saved! Projections updated for all scenarios.' })
      setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
      window.dispatchEvent(new CustomEvent('switchTab', { detail: 'quick-analysis' }))
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsNewScenario = async (name?: string) => {
    setSaving(true)
    setMessage(null)
    try {
      const finalName = (name || '').trim() || suggestScenarioName()
      const { data: newScenario, error: scenarioError } = await supabase
        .from('rp_scenarios')
        .insert([{ plan_id: planId, scenario_name: finalName, is_default: scenarios.length === 0 }])
        .select().single()
      if (scenarioError) throw scenarioError

      setSelectedScenarioId(newScenario.id)
      await loadScenarios()

      // Now save everything with the new scenario id
      // Temporarily set the scenario so handleSaveAll picks it up
      // We need to save directly since state hasn't updated yet
      const yearsToRet = scenarioVars.retirement_age - planBasis.age
      const totalMonthly = expenses.reduce((sum, exp) => {
        const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
        return sum + (amount || 0)
      }, 0)
      const inflationMult = Math.pow(1 + (scenarioVars.inflation_rate / 100), Math.max(yearsToRet, 0))

      const { error: settingsError } = await supabase
        .from('rp_calculator_settings')
        .upsert({
          plan_id: planId,
          scenario_id: newScenario.id,
          current_year: currentYear,
          retirement_age: scenarioVars.retirement_age,
          retirement_start_year: currentYear + yearsToRet,
          years_to_retirement: yearsToRet,
          annual_retirement_expenses: totalMonthly * 12 * inflationMult,
          growth_rate_before_retirement: scenarioVars.growth_rate_before_retirement / 100,
          growth_rate_during_retirement: scenarioVars.growth_rate_during_retirement / 100,
          loan_rate: 0.1,
          inflation_rate: scenarioVars.inflation_rate / 100,
          enable_borrowing: scenarioVars.enable_borrowing,
          ssa_start_age: scenarioVars.ssa_start_age || scenarioVars.retirement_age,
          planner_ssa_income: scenarioVars.planner_ssa_income,
          spouse_ssa_income: scenarioVars.spouse_ssa_income,
          planner_ssa_annual_benefit: scenarioVars.planner_ssa_annual_benefit,
          spouse_ssa_annual_benefit: scenarioVars.spouse_ssa_annual_benefit,
          pre_medicare_annual_premium: scenarioVars.pre_medicare_annual_premium,
          post_medicare_annual_premium: scenarioVars.post_medicare_annual_premium,
        }, { onConflict: 'scenario_id' })
      if (settingsError) throw settingsError

      try {
        await calculateAndSaveProjectionsForScenario(planId, newScenario.id, planBasis.life_expectancy || 100)
      } catch (e) {
        console.error('Projection calc failed:', e)
      }

      setShowSaveDialog(false)
      setNewScenarioName('')
      setScenariosTableRefreshKey((k) => k + 1)
      setMessage({ type: 'success', text: `Saved as "${finalName}". Projections updated.` })
      setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
    } finally {
      setSaving(false)
    }
  }

  // --- Account / expense helpers ---

  const handleAddAccountRow = () => {
    setAccounts([...accounts, { account_name: '', owner: '', balance: 0, account_type: '', annual_contribution: 0 }])
  }

  const handleDeleteAccount = async (index: number) => {
    const account = accounts[index]
    if (account.id) {
      try {
        const { error } = await supabase.from('rp_accounts').delete().eq('id', account.id)
        if (error) throw error
        await loadAccounts()
        setMessage({ type: 'success', text: 'Account deleted' })
        setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
      } catch (error: any) {
        setMessage({ type: 'error', text: `Failed to delete: ${error.message}` })
      }
    } else {
      setAccounts(accounts.filter((_, i) => i !== index))
    }
  }

  const handleAddExpenseRow = () => {
    setExpenses([...expenses, { expense_name: '', amount_after_65: 0, amount_before_65: 0 }])
  }

  const handleDeleteExpense = async (index: number) => {
    const expense = expenses[index]
    if (expense.id) {
      try {
        const { error } = await supabase.from('rp_expenses').delete().eq('id', expense.id)
        if (error) throw error
        await loadExpenses()
        setMessage({ type: 'success', text: 'Expense deleted' })
        setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
      } catch (error: any) {
        setMessage({ type: 'error', text: `Failed to delete: ${error.message}` })
      }
    } else {
      setExpenses(expenses.filter((_, i) => i !== index))
    }
  }

  const handleAddScenario = async () => {
    setSelectedScenarioId(null)
    await loadDefaultsToScenarioVars()
    setShowSaveDialog(true)
  }

  const suggestScenarioName = () => {
    const retAge = scenarioVars.retirement_age
    const g1 = scenarioVars.growth_rate_before_retirement
    const g2 = scenarioVars.growth_rate_during_retirement
    const borrow = scenarioVars.enable_borrowing ? '-Borrow' : ''
    return `Ret${retAge}-Grow${g1}/${g2}${borrow}`
  }

  // --- Computed values ---

  const totalAssets = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalAnnualContrib = accounts.reduce((sum, acc) => sum + (acc.annual_contribution || 0), 0)
  const totalMonthlyExpenses = expenses.reduce((s, e) => {
    const amt = scenarioVars.retirement_age >= 65 ? e.amount_after_65 : e.amount_before_65
    return s + (amt || 0)
  }, 0)
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)
  const yearsToRetirement = scenarioVars.retirement_age - planBasis.age
  const spouseAge = planBasis.include_spouse ? currentYear - planBasis.spouse_birth_year : null

  const accountTypeDot = (type?: string) => {
    switch (type) {
      case '401k': case 'IRA': case 'Traditional IRA': return 'bg-blue-400'
      case 'Roth IRA': return 'bg-emerald-400'
      case 'HSA': return 'bg-teal-400'
      case 'Taxable': return 'bg-amber-400'
      case 'ESPP': return 'bg-violet-400'
      default: return 'bg-muted-foreground/30'
    }
  }

  // --- Render ---

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="space-y-6">
      {/* Inline message */}
      {message && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
            : message.type === 'error'
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-primary/20 bg-primary/5 text-primary'
        }`}>
          <span className="flex-1">{message.text}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {message.type === 'error' && (
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(message.text) } catch {} }}
                className="text-muted-foreground hover:text-foreground"
                title="Copy error"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setMessage(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── PLAN SETUP (Calculator Form) ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">Plan Setup</h3>
          <div className="flex items-center gap-2">
            {selectedScenario && (
              <Badge variant="secondary" className="text-xs">{selectedScenario.scenario_name}</Badge>
            )}
            <Select
              value={selectedScenarioId?.toString() || ''}
              onValueChange={(v) => setSelectedScenarioId(parseInt(v))}
            >
              <SelectTrigger className="h-8 text-sm w-44">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.scenario_name}{s.is_default ? ' (Default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="px-6 py-5">
          <CalculatorAssumptionsForm
            value={assumptions}
            onChange={handleAssumptionsChange}
            defaultExpanded={true}
            formId="plan-details"
          />
        </div>
      </div>

      {/* ── DETAILED BREAKDOWNS (Progressive Disclosure) ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Accounts */}
        <button
          type="button"
          onClick={() => setAccountsExpanded(!accountsExpanded)}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span>Accounts</span>
            <Badge variant="outline" className="text-xs font-normal">
              {accounts.length} account{accounts.length !== 1 ? 's' : ''} · ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Badge>
          </div>
          {accountsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {accountsExpanded && (
          <div className="border-t">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Edit individual accounts below. Changes to totals in the form above are distributed proportionally.
                </p>
                <Button variant="outline" size="sm" onClick={handleAddAccountRow}>
                  <Plus className="h-3.5 w-3.5" /> Add Account
                </Button>
              </div>
              <div className="rounded-xl border overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account Name</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Owner</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Balance</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Annual Contribution</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accounts.map((account, index) => (
                      <tr key={account.id || index} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${accountTypeDot(account.account_type)}`} />
                            <Select
                              value={account.account_type || ''}
                              onValueChange={(v) => { const n = [...accounts]; n[index].account_type = v; setAccounts(n) }}
                            >
                              <SelectTrigger className="h-7 text-xs w-28 px-2"><SelectValue placeholder="Type" /></SelectTrigger>
                              <SelectContent>
                                {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input type="text" value={account.account_name}
                            onChange={(e) => { const n = [...accounts]; n[index].account_name = e.target.value; setAccounts(n) }}
                            className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 min-w-[120px]"
                            placeholder="Account name" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="text" value={account.owner}
                            onChange={(e) => { const n = [...accounts]; n[index].owner = e.target.value; setAccounts(n) }}
                            className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-24"
                            placeholder="Owner" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={account.balance}
                            onChange={(e) => { const n = [...accounts]; n[index].balance = parseFloat(e.target.value) || 0; setAccounts(n) }}
                            className="h-8 text-sm text-right w-32" />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="number" value={account.annual_contribution || 0}
                            onChange={(e) => { const n = [...accounts]; n[index].annual_contribution = parseFloat(e.target.value) || 0; setAccounts(n) }}
                            className="h-8 text-sm text-right w-32" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(index)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {accounts.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/20 border-t">
                        <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold">
                          ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold">
                          ${totalAnnualContrib.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Expenses */}
        <button
          type="button"
          onClick={() => setExpensesExpanded(!expensesExpanded)}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span>Living Expenses</span>
            <Badge variant="outline" className="text-xs font-normal">
              {expenses.length} categor{expenses.length !== 1 ? 'ies' : 'y'} · ${totalMonthlyExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
            </Badge>
            <span className="text-[10px] text-muted-foreground/70 font-normal">Excludes healthcare</span>
          </div>
          {expensesExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {expensesExpanded && (
          <div className="border-t">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">
                  Edit individual expense categories. Changes to the total in the form above are distributed proportionally.
                </p>
                <Button variant="outline" size="sm" onClick={handleAddExpenseRow}>
                  <Plus className="h-3.5 w-3.5" /> Add Expense
                </Button>
              </div>
              <div className="rounded-xl border overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expense</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Working years <span className="font-normal normal-case text-muted-foreground/60">(before 65)</span>
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Retirement years <span className="font-normal normal-case text-muted-foreground/60">(after 65)</span>
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {expenses.map((expense, index) => {
                      const essential = isEssentialExpense(expense.expense_name)
                      return (
                        <tr key={expense.id || index} className="hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${essential ? 'bg-blue-400' : 'bg-amber-400'}`} />
                              <Input type="text" value={expense.expense_name}
                                onChange={(e) => { const n = [...expenses]; n[index].expense_name = e.target.value; setExpenses(n) }}
                                className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 min-w-[160px]"
                                placeholder="Expense name" />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" value={expense.amount_before_65}
                              onChange={(e) => {
                                const n = [...expenses]; const v = parseFloat(e.target.value) || 0
                                n[index].amount_before_65 = v
                                if (n[index].amount_after_65 === 0 || n[index].amount_after_65 === expense.amount_before_65) n[index].amount_after_65 = v
                                setExpenses(n)
                              }}
                              className="h-8 text-sm text-right w-32 ml-auto block" />
                          </td>
                          <td className="px-3 py-2">
                            <Input type="number" value={expense.amount_after_65}
                              onChange={(e) => {
                                const n = [...expenses]; const v = parseFloat(e.target.value) || 0
                                n[index].amount_after_65 = v
                                if (n[index].amount_before_65 === 0 || n[index].amount_before_65 === expense.amount_after_65) n[index].amount_before_65 = v
                                setExpenses(n)
                              }}
                              className="h-8 text-sm text-right w-32 ml-auto block" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(index)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {expenses.length > 0 && (
                    <tfoot className="border-t bg-muted/20">
                      <tr>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Essential</span>
                            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Discretionary</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">
                          ${expenses.reduce((s, e) => s + (e.amount_before_65 || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold">
                          ${expenses.reduce((s, e) => s + (e.amount_after_65 || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ADDITIONAL SETTINGS ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setAdditionalExpanded(!additionalExpanded)}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <span>Additional Settings</span>
          </div>
          {additionalExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {additionalExpanded && (
          <div className="border-t px-6 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filing Status</Label>
                <Select
                  value={planBasis.filing_status}
                  onValueChange={(v) => setPlanBasis({ ...planBasis, filing_status: v as any })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married Filing Jointly">Married Filing Jointly</SelectItem>
                    <SelectItem value="Married Filing Separately">Married Filing Separately</SelectItem>
                    <SelectItem value="Head of Household">Head of Household</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {planBasis.include_spouse && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Spouse Life Expectancy</Label>
                  <Input
                    type="number"
                    value={planBasis.spouse_life_expectancy}
                    onChange={(e) => setPlanBasis({ ...planBasis, spouse_life_expectancy: parseInt(e.target.value) || DEFAULT_LIFE_EXPECTANCY })}
                    className="h-9 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2.5 mb-1">
                <Checkbox
                  id="enable-borrowing"
                  checked={scenarioVars.enable_borrowing}
                  onCheckedChange={(v) => setScenarioVars({ ...scenarioVars, enable_borrowing: !!v })}
                />
                <Label htmlFor="enable-borrowing" className="text-sm font-medium cursor-pointer">
                  Enable borrowing to cover shortfalls
                </Label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Borrows to cover negative cash flow; repays when surplus is available.
              </p>
            </div>

            {planBasis.include_spouse && (
              <div className="rounded-lg border bg-muted/20 px-4 py-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Spouse SSA</p>
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="spouse-ssa"
                    checked={scenarioVars.spouse_ssa_income ?? true}
                    onCheckedChange={(v) => setScenarioVars({ ...scenarioVars, spouse_ssa_income: !!v })}
                  />
                  <Label htmlFor="spouse-ssa" className="text-sm cursor-pointer">Include spouse SSA income</Label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SAVE ACTIONS ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowDefaultsPopup(true)} className="text-muted-foreground">
          View Defaults
        </Button>
        <Button variant="outline" size="sm" onClick={async () => { await loadDefaultsToScenarioVars() }} className="text-muted-foreground">
          <X className="h-3.5 w-3.5" /> Reset to Defaults
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={saving}>
            <Plus className="h-3.5 w-3.5" /> Save as New Scenario
          </Button>
          {selectedScenarioId && (
            <Button size="sm" onClick={handleSaveAll} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save Plan'}
            </Button>
          )}
        </div>
      </div>

      {/* Save as New Scenario inline */}
      {showSaveDialog && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <h4 className="text-sm font-semibold mb-3">Save as New Scenario</h4>
          <div className="flex gap-2">
            <Input
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder={suggestScenarioName()}
              className="flex-1 h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveAsNewScenario(newScenarioName.trim() || suggestScenarioName())}
            />
            <Button variant="outline" size="sm" onClick={() => setNewScenarioName(suggestScenarioName())}>Suggest</Button>
            <Button size="sm" onClick={() => handleSaveAsNewScenario(newScenarioName.trim() || suggestScenarioName())} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowSaveDialog(false); setNewScenarioName('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Empty scenarios nudge */}
      {scenarios.length === 0 && !showSaveDialog && (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No scenarios yet. Configure your plan above and save your first scenario.
          </p>
          <Button size="sm" onClick={() => setShowSaveDialog(true)}>
            <Save className="h-3.5 w-3.5" /> Save as New Scenario
          </Button>
        </div>
      )}

      {/* Scenarios Table */}
      <ScenariosTable
        planId={planId}
        refreshTrigger={scenariosTableRefreshKey}
        onAddScenario={handleAddScenario}
        onModelScenarios={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'scenario-modeling' }))}
      />

      <DefaultsPopup
        planId={planId}
        isOpen={showDefaultsPopup}
        onClose={() => setShowDefaultsPopup(false)}
      />
    </div>
  )
}

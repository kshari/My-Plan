'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import ScenariosTable from '../scenarios-table'
import DefaultsPopup from '../defaults-popup'
import { Copy, Plus, Trash2, Save, Check, X, User, Wallet, ShoppingCart, Pencil, ChevronUp } from 'lucide-react'
import { calculateAndSaveProjectionsForScenario } from '@/lib/utils/calculate-projections'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

// Default accounts from Excel
const DEFAULT_ACCOUNTS: Omit<Account, 'id'>[] = [
  { account_name: 'IRA', owner: '', balance: 0, account_type: 'IRA', annual_contribution: 0 },
  { account_name: '401k', owner: '', balance: 0, account_type: '401k', annual_contribution: 0 },
  { account_name: 'Roth IRA', owner: '', balance: 0, account_type: 'Roth IRA', annual_contribution: 0 },
  { account_name: 'HSA', owner: '', balance: 0, account_type: 'HSA', annual_contribution: 0 },
  { account_name: 'Taxable', owner: '', balance: 0, account_type: 'Taxable', annual_contribution: 0 },
]

// Default expenses from Excel
const DEFAULT_EXPENSES: Omit<Expense, 'id'>[] = [
  { expense_name: 'Rent / Taxes-Maint', amount_after_65: 3000, amount_before_65: 4000 },
  { expense_name: 'Groceries', amount_after_65: 800, amount_before_65: 1000 },
  { expense_name: 'Dining out / Entertainment', amount_after_65: 500, amount_before_65: 500 },
  { expense_name: 'Utilities', amount_after_65: 500, amount_before_65: 500 },
  { expense_name: 'Medical', amount_after_65: 2500, amount_before_65: 2500 },
  { expense_name: 'Other Essential Expenses', amount_after_65: 0, amount_before_65: 0 },
  { expense_name: 'Travel', amount_after_65: 0, amount_before_65: 0 },
  { expense_name: 'Other Discretionary Expenses', amount_after_65: 0, amount_before_65: 0 },
]

// Categorize expenses as essential or discretionary
const isEssentialExpense = (expenseName: string): boolean => {
  const essentialKeywords = ['rent', 'taxes', 'maint', 'groceries', 'utilities', 'medical', 'essential']
  const lowerName = expenseName.toLowerCase()
  return essentialKeywords.some(keyword => lowerName.includes(keyword))
}

export default function PlanDetailsTab({ planId }: PlanDetailsTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState('')
  const [planBasisExpanded, setPlanBasisExpanded] = useState(false)
  const [accountsExpanded, setAccountsExpanded] = useState(false)
  const [expensesExpanded, setExpensesExpanded] = useState(false)
  const [scenarioVarsExpanded, setScenarioVarsExpanded] = useState(false)
  const [showDefaultsPopup, setShowDefaultsPopup] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  
  // Plan Basis (plan-level)
  const [planBasis, setPlanBasis] = useState({
    birth_year: new Date().getFullYear() - 50,
    age: 50,
    filing_status: 'Married Filing Jointly' as 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household',
    life_expectancy: 90,
    include_spouse: false,
    spouse_birth_year: new Date().getFullYear() - 50,
    spouse_life_expectancy: 90,
  })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  
  // Scenario Variables (scenario-level)
  const [scenarioVars, setScenarioVars] = useState({
    retirement_age: 65,
    growth_rate_before_retirement: 10, // Percentage
    growth_rate_during_retirement: 5, // Percentage
    inflation_rate: 4, // Percentage
    enable_borrowing: false, // Enable borrowing to cover negative cashflow
    ssa_start_age: 65, // Age to start SSA income (defaults to retirement age)
    planner_ssa_income: true, // Include planner SSA income
    spouse_ssa_income: true, // Include spouse SSA income
  })

  useEffect(() => {
    loadPlanBasis()
    loadAccounts()
    loadExpenses()
    loadScenarios()
  }, [planId])

  useEffect(() => {
    if (selectedScenarioId) {
      loadScenarioVars()
      setScenarioVarsExpanded(false) // Keep collapsed when scenario changes
    }
  }, [selectedScenarioId])

  const loadPlanBasis = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year, filing_status, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy')
        .eq('id', planId)
        .single()

      if (data && data.birth_year) {
        const currentYear = new Date().getFullYear()
        const age = currentYear - data.birth_year
        setPlanBasis({
          birth_year: data.birth_year,
          age: age,
          filing_status: data.filing_status || 'Married Filing Jointly',
          life_expectancy: data.life_expectancy || 90,
          include_spouse: data.include_spouse || false,
          spouse_birth_year: data.spouse_birth_year || data.birth_year, // Default to planner's birth year
          spouse_life_expectancy: data.spouse_life_expectancy || 90,
        })
      }
    } catch (error) {
      console.error('Error loading plan basis:', error)
    }
  }

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_accounts')
        .select('*')
        .eq('plan_id', planId)
        .order('id')

      if (error) throw error
      
      // If no accounts exist, initialize with defaults
      if (!data || data.length === 0) {
        setAccounts(DEFAULT_ACCOUNTS.map(acc => ({ ...acc })))
      } else {
        setAccounts(data.map(acc => ({
          ...acc,
          annual_contribution: acc.annual_contribution || 0
        })))
      }
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_expenses')
        .select('*')
        .eq('plan_id', planId)
        .order('id')

      if (error) throw error
      
      // If no expenses exist, initialize with defaults
      if (!data || data.length === 0) {
        setExpenses(DEFAULT_EXPENSES.map(exp => ({ ...exp })))
      } else {
        setExpenses(data)
      }
    } catch (error) {
      console.error('Error loading expenses:', error)
    }
  }

  const loadScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('*')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setScenarios(data || [])
      
      // Auto-select default scenario if exists
      if (data && data.length > 0) {
        const defaultScenario = data.find(s => s.is_default) || data[0]
        setSelectedScenarioId(defaultScenario.id)
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const loadScenarioVars = async () => {
    if (!selectedScenarioId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rp_calculator_settings')
        .select('*')
        .eq('scenario_id', selectedScenarioId)
        .single()

      if (data) {
        setScenarioVars({
          retirement_age: data.retirement_age || 65,
          ssa_start_age: data.ssa_start_age || data.retirement_age || 65,
          growth_rate_before_retirement: parseFloat(data.growth_rate_before_retirement?.toString() || '0.1') * 100,
          growth_rate_during_retirement: parseFloat(data.growth_rate_during_retirement?.toString() || '0.05') * 100,
          inflation_rate: parseFloat(data.inflation_rate?.toString() || '0.04') * 100,
          enable_borrowing: data.enable_borrowing ?? false,
          planner_ssa_income: data.planner_ssa_income ?? true,
          spouse_ssa_income: data.spouse_ssa_income ?? true,
        })
      } else {
        // If no data, ensure we still have default values for SSA income flags
        setScenarioVars(prev => ({
          ...prev,
          planner_ssa_income: prev.planner_ssa_income ?? true,
          spouse_ssa_income: prev.spouse_ssa_income ?? true,
        }))
      }
    } catch (error) {
      console.error('Error loading scenario vars:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadDefaultsToScenarioVars = async () => {
    try {
      // Load default settings
      const { data: defaultSettingsData, error: defaultsError } = await supabase
        .from('rp_default_settings')
        .select('*')
        .eq('plan_id', planId)

      if (defaultsError) throw defaultsError

      // Map defaults to scenario vars
      const defaults = defaultSettingsData || []
      const getDefault = (name: string, fallback: number) => {
        const setting = defaults.find((d: any) => d.setting_name === name)
        return setting ? setting.setting_value : fallback
      }

      setScenarioVars({
        retirement_age: 65,
        growth_rate_before_retirement: getDefault('Growth rate (return) before retirement', 10),
        growth_rate_during_retirement: getDefault('Growth rate (return) during retirement', 5),
        inflation_rate: getDefault('Inflation', 4),
        enable_borrowing: false,
        ssa_start_age: scenarioVars.retirement_age || 65, // Default to retirement age
        planner_ssa_income: true,
        spouse_ssa_income: true,
      })
    } catch (error) {
      console.error('Error loading defaults:', error)
      // Fallback to hardcoded defaults
      setScenarioVars({
        retirement_age: 65,
        growth_rate_before_retirement: 10,
        growth_rate_during_retirement: 5,
        inflation_rate: 4,
        enable_borrowing: false,
        ssa_start_age: scenarioVars.retirement_age || 65, // Default to retirement age
        planner_ssa_income: true,
        spouse_ssa_income: true,
      })
    }
  }

  const handleResetToDefaults = async () => {
    await loadDefaultsToScenarioVars()
  }

  const handleAddScenario = async () => {
    // Clear selected scenario
    setSelectedScenarioId(null)
    // Load defaults
    await loadDefaultsToScenarioVars()
    // Expand the scenario variables section
    setScenarioVarsExpanded(true)
    // Scroll to scenario variables section (optional, but helpful)
    setTimeout(() => {
      const element = document.getElementById('scenario-variables-section')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleSavePlanBasis = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const { error } = await supabase
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

      if (error) throw error
      
      // Save accounts
      for (const account of accounts) {
        if (account.id) {
          const { error } = await supabase
            .from('rp_accounts')
            .update({
              account_name: account.account_name,
              owner: account.owner,
              balance: account.balance,
              account_type: account.account_type,
              annual_contribution: account.annual_contribution || 0,
            })
            .eq('id', account.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('rp_accounts')
            .insert([{
              plan_id: planId,
              account_name: account.account_name,
              owner: account.owner,
              balance: account.balance,
              account_type: account.account_type,
              annual_contribution: account.annual_contribution || 0,
            }])
          if (error) throw error
        }
      }
      
      // Save expenses
      for (const expense of expenses) {
        if (expense.id) {
          const { error } = await supabase
            .from('rp_expenses')
            .update({
              expense_name: expense.expense_name,
              amount_after_65: expense.amount_after_65,
              amount_before_65: expense.amount_before_65,
            })
            .eq('id', expense.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('rp_expenses')
            .insert([{
              plan_id: planId,
              expense_name: expense.expense_name,
              amount_after_65: expense.amount_after_65,
              amount_before_65: expense.amount_before_65,
            }])
          if (error) throw error
        }
      }
      
      await loadAccounts()
      await loadExpenses()
      
      // Recalculate projections for all scenarios
      const { data: allScenarios } = await supabase
        .from('rp_scenarios')
        .select('id')
        .eq('plan_id', planId)
      
      if (allScenarios && allScenarios.length > 0) {
        const { data: planData } = await supabase
          .from('rp_retirement_plans')
          .select('life_expectancy')
          .eq('id', planId)
          .single()
        
        const lifeExpectancy = planData?.life_expectancy || 100
        
        // Recalculate projections for each scenario
        for (const scenario of allScenarios) {
          try {
            await calculateAndSaveProjectionsForScenario(planId, scenario.id, lifeExpectancy)
          } catch (error) {
            console.error(`Error recalculating projections for scenario ${scenario.id}:`, error)
            // Continue with other scenarios even if one fails
          }
        }
      }
      
      setMessage({ type: 'success', text: 'Plan basis saved successfully! Projections updated for all scenarios.' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
      // Don't auto-close error messages
    } finally {
      setSaving(false)
    }
  }

  const handleAddAccountRow = () => {
    setAccounts([...accounts, { account_name: '', owner: '', balance: 0, account_type: '', annual_contribution: 0 }])
  }

  const handleDeleteAccount = async (index: number) => {
    const account = accounts[index]
    if (account.id) {
      try {
        const { error } = await supabase
          .from('rp_accounts')
          .delete()
          .eq('id', account.id)
        if (error) throw error
        await loadAccounts()
        setMessage({ type: 'success', text: 'Account deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } catch (error: any) {
        setMessage({ type: 'error', text: `Failed to delete account: ${error.message}` })
        // Don't auto-close error messages
      }
    } else {
      setAccounts(accounts.filter((_, i) => i !== index))
      setMessage({ type: 'success', text: 'Account removed' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleAddExpenseRow = () => {
    setExpenses([...expenses, { expense_name: '', amount_after_65: 0, amount_before_65: 0 }])
  }

  const handleDeleteExpense = async (index: number) => {
    const expense = expenses[index]
    if (expense.id) {
      try {
        const { error } = await supabase
          .from('rp_expenses')
          .delete()
          .eq('id', expense.id)
        if (error) throw error
        await loadExpenses()
        setMessage({ type: 'success', text: 'Expense deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } catch (error: any) {
        setMessage({ type: 'error', text: `Failed to delete expense: ${error.message}` })
        // Don't auto-close error messages
      }
    } else {
      setExpenses(expenses.filter((_, i) => i !== index))
      setMessage({ type: 'success', text: 'Expense removed' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveScenarioVars = async (scenarioId?: number, scenarioName?: string) => {
    setSaving(true)
    setMessage(null)
    try {
      let targetScenarioId = scenarioId

      // If scenarioName is provided, always create a new scenario (don't use selectedScenarioId)
      if (scenarioName) {
        const finalScenarioName = scenarioName.trim() || suggestScenarioName()
        const { data: newScenario, error: scenarioError } = await supabase
          .from('rp_scenarios')
          .insert([{
            plan_id: planId,
            scenario_name: finalScenarioName,
            is_default: scenarios.length === 0
          }])
          .select()
          .single()

        if (scenarioError) throw scenarioError
        targetScenarioId = newScenario.id
        setSelectedScenarioId(newScenario.id)
        await loadScenarios()
      } else {
        // If no scenarioName provided, use the provided scenarioId or selectedScenarioId
        targetScenarioId = scenarioId || selectedScenarioId || undefined
      }

      if (!targetScenarioId) {
        setMessage({ type: 'error', text: 'Please select a scenario or enter a name to save as new scenario' })
        // Don't auto-close error messages
        setSaving(false)
        return
      }

      const currentYear = new Date().getFullYear()
      const calculatedAge = currentYear - planBasis.birth_year
      const yearsToRetirement = scenarioVars.retirement_age - calculatedAge
      const retirementStartYear = currentYear + yearsToRetirement

      // Calculate annual retirement expenses from expenses table
      const totalMonthlyExpenses = expenses.reduce((sum, exp) => {
        // Use amount_after_65 if retirement age >= 65, otherwise amount_before_65
        const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
        return sum + (amount || 0)
      }, 0)
      
      const annualExpensesToday = totalMonthlyExpenses * 12
      
      // Adjust for inflation until retirement age
      const inflationMultiplier = Math.pow(1 + (scenarioVars.inflation_rate / 100), yearsToRetirement)
      const annualRetirementExpenses = annualExpensesToday * inflationMultiplier

      const settingsToSave = {
        plan_id: planId,
        scenario_id: targetScenarioId,
        current_year: currentYear,
        retirement_age: scenarioVars.retirement_age,
        retirement_start_year: retirementStartYear,
        years_to_retirement: yearsToRetirement,
        annual_retirement_expenses: annualRetirementExpenses,
        growth_rate_before_retirement: scenarioVars.growth_rate_before_retirement / 100,
        growth_rate_during_retirement: scenarioVars.growth_rate_during_retirement / 100,
        loan_rate: 0.1, // Keep for backward compatibility but not shown
        inflation_rate: scenarioVars.inflation_rate / 100,
        enable_borrowing: scenarioVars.enable_borrowing || false,
        ssa_start_age: scenarioVars.ssa_start_age || scenarioVars.retirement_age || 65,
        planner_ssa_income: scenarioVars.planner_ssa_income !== undefined ? scenarioVars.planner_ssa_income : true,
        spouse_ssa_income: scenarioVars.spouse_ssa_income !== undefined ? scenarioVars.spouse_ssa_income : true,
      }

      // If spouse_ssa_income is true, ensure include_spouse is also true
      if (settingsToSave.spouse_ssa_income) {
        const { error: planUpdateError } = await supabase
          .from('rp_retirement_plans')
          .update({ include_spouse: true })
          .eq('id', planId)
        
        if (planUpdateError) {
          console.error('Error updating include_spouse:', planUpdateError)
          // Don't throw - continue with settings save
        }
      }

      const { error } = await supabase
        .from('rp_calculator_settings')
        .upsert(settingsToSave, {
          onConflict: 'scenario_id'
        })

      if (error) throw error
      
      // Load scenario variables for the selected scenario
      await loadScenarioVars()
      
      // Recalculate projections for this scenario
      const { data: planData } = await supabase
        .from('rp_retirement_plans')
        .select('life_expectancy')
        .eq('id', planId)
        .single()
      
      const lifeExpectancy = planData?.life_expectancy || 100
      
      try {
        await calculateAndSaveProjectionsForScenario(planId, targetScenarioId, lifeExpectancy)
      } catch (calcError) {
        console.error('Error recalculating projections:', calcError)
        // Don't fail the save if calculation fails, but log it
      }
      
      setShowSaveDialog(false)
      setNewScenarioName('')
      setMessage({ type: 'success', text: 'Scenario variables saved successfully! Projections updated.' })
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
      // Don't auto-close error messages
    } finally {
      setSaving(false)
    }
  }

  const suggestScenarioName = () => {
    const retAge = scenarioVars.retirement_age
    const growthBefore = scenarioVars.growth_rate_before_retirement
    const growthDuring = scenarioVars.growth_rate_during_retirement
    const borrowing = scenarioVars.enable_borrowing ? '-Borrow' : ''
    return `Ret${retAge}-Grow${growthBefore}${growthDuring}${borrowing}`
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading…</div>
  }

  const currentYear = new Date().getFullYear()
  const calculatedAge = planBasis.birth_year ? currentYear - planBasis.birth_year : planBasis.age
  const yearsToRetirement = scenarioVars.retirement_age - calculatedAge
  const retirementStartYear = currentYear + yearsToRetirement
  const spouseAge = planBasis.include_spouse ? currentYear - planBasis.spouse_birth_year : null

  const totalAssets = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)

  const essentialMonthly = expenses.filter(e => isEssentialExpense(e.expense_name))
    .reduce((s, e) => s + ((scenarioVars.retirement_age >= 65 ? e.amount_after_65 : e.amount_before_65) || 0), 0)
  const discretionaryMonthly = expenses.filter(e => !isEssentialExpense(e.expense_name))
    .reduce((s, e) => s + ((scenarioVars.retirement_age >= 65 ? e.amount_after_65 : e.amount_before_65) || 0), 0)
  const totalMonthlyExpenses = essentialMonthly + discretionaryMonthly
  const totalAnnualExpenses  = totalMonthlyExpenses * 12

  const inflationMultiplier = yearsToRetirement > 0
    ? Math.pow(1 + scenarioVars.inflation_rate / 100, yearsToRetirement) : 1
  const annualRetirementExpensesAdjusted = totalAnnualExpenses * inflationMultiplier

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)

  // Color dot per account type
  const accountTypeDot = (type?: string) => {
    switch (type) {
      case '401k': case 'IRA': case 'Traditional IRA': return 'bg-blue-400'
      case 'Roth IRA':  return 'bg-emerald-400'
      case 'HSA':       return 'bg-teal-400'
      case 'Taxable':   return 'bg-amber-400'
      case 'ESPP':      return 'bg-violet-400'
      default:          return 'bg-muted-foreground/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Inline message ── */}
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

      {/* ── Plan at a glance (scenario-agnostic) ── */}
      <div className="rounded-xl border bg-muted/30 px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Age</span>
            <span className="ml-2 font-semibold">{calculatedAge}</span>
          </div>
          {planBasis.include_spouse && spouseAge !== null && (
            <div>
              <span className="text-muted-foreground">Spouse age</span>
              <span className="ml-2 font-semibold">{spouseAge}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Filing</span>
            <span className="ml-2 font-semibold">{planBasis.filing_status}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Total saved</span>
            <span className="ml-2 font-semibold">${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Monthly spend</span>
            <span className="ml-2 font-semibold">${totalMonthlyExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
          </div>
          <div>
            <span className="text-muted-foreground">Plan through age</span>
            <span className="ml-2 font-semibold">{planBasis.life_expectancy}</span>
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlanBasisExpanded(!planBasisExpanded)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              {planBasisExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Collapse
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit plan basis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── PLAN BASIS CARD (collapsible) ── */}
      {planBasisExpanded && (
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-base font-semibold">Plan Basis</h3>
          <div className="flex items-center gap-2">
            <Button onClick={handleSavePlanBasis} disabled={saving} size="sm">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save Plan Basis'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setPlanBasisExpanded(false)} className="text-muted-foreground">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Who You Are ── */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Who You Are</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Filing Status</Label>
              <Select
                value={planBasis.filing_status}
                onValueChange={(v) => setPlanBasis({ ...planBasis, filing_status: v as any })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married Filing Jointly">Married Filing Jointly</SelectItem>
                  <SelectItem value="Married Filing Separately">Married Filing Separately</SelectItem>
                  <SelectItem value="Head of Household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="include-spouse"
                  checked={planBasis.include_spouse}
                  onCheckedChange={(v) => setPlanBasis({ ...planBasis, include_spouse: !!v })}
                />
                <Label htmlFor="include-spouse" className="text-sm font-medium cursor-pointer">
                  Include spouse in plan
                </Label>
              </div>
            </div>
          </div>

          <div className={`grid gap-4 ${planBasis.include_spouse ? 'md:grid-cols-2' : 'sm:grid-cols-2'}`}>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Planner</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Birth Year</Label>
                  <Input
                    type="number"
                    value={planBasis.birth_year}
                    onChange={(e) => {
                      const birthYear = parseInt(e.target.value) || new Date().getFullYear() - 50
                      setPlanBasis({ ...planBasis, birth_year: birthYear, age: currentYear - birthYear })
                    }}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Age: {calculatedAge}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Life Expectancy</Label>
                  <Input
                    type="number"
                    value={planBasis.life_expectancy}
                    onChange={(e) => setPlanBasis({ ...planBasis, life_expectancy: parseInt(e.target.value) || 90 })}
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Plan ends at {planBasis.life_expectancy}</p>
                </div>
              </div>
            </div>

            {planBasis.include_spouse && (
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Spouse</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Birth Year</Label>
                    <Input
                      type="number"
                      value={planBasis.spouse_birth_year}
                      onChange={(e) => setPlanBasis({ ...planBasis, spouse_birth_year: parseInt(e.target.value) || planBasis.birth_year })}
                      className="h-9 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Age: {spouseAge ?? '—'}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Life Expectancy</Label>
                    <Input
                      type="number"
                      value={planBasis.spouse_life_expectancy}
                      onChange={(e) => setPlanBasis({ ...planBasis, spouse_life_expectancy: parseInt(e.target.value) || 90 })}
                      className="h-9 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Plan ends at {planBasis.spouse_life_expectancy}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* ── What You Have ── */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">What You Have</h4>
              <Badge variant="outline" className="text-xs">
                ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddAccountRow}>
              <Plus className="h-3.5 w-3.5" />
              Add Account
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
                          onValueChange={(v) => {
                            const n = [...accounts]; n[index].account_type = v; setAccounts(n)
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-28 px-2">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IRA">IRA</SelectItem>
                            <SelectItem value="401k">401k</SelectItem>
                            <SelectItem value="Roth IRA">Roth IRA</SelectItem>
                            <SelectItem value="HSA">HSA</SelectItem>
                            <SelectItem value="Taxable">Taxable</SelectItem>
                            <SelectItem value="ESPP">ESPP</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={account.account_name}
                        onChange={(e) => {
                          const n = [...accounts]; n[index].account_name = e.target.value; setAccounts(n)
                        }}
                        className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 min-w-[120px]"
                        placeholder="Account name"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={account.owner}
                        onChange={(e) => {
                          const n = [...accounts]; n[index].owner = e.target.value; setAccounts(n)
                        }}
                        className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-24"
                        placeholder="Owner"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={account.balance}
                        onChange={(e) => {
                          const n = [...accounts]; n[index].balance = parseFloat(e.target.value) || 0; setAccounts(n)
                        }}
                        className="h-8 text-sm text-right w-32"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        value={account.annual_contribution || 0}
                        onChange={(e) => {
                          const n = [...accounts]; n[index].annual_contribution = parseFloat(e.target.value) || 0; setAccounts(n)
                        }}
                        className="h-8 text-sm text-right w-32"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAccount(index)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {accounts.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/20 border-t">
                    <td colSpan={3} className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold">
                      ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <Separator />

        {/* ── What You Spend ── */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">What You Spend</h4>
              <Badge variant="outline" className="text-xs">
                ${totalMonthlyExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddExpenseRow}>
              <Plus className="h-3.5 w-3.5" />
              Add Expense
            </Button>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Expense
                  </th>
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
                          <Input
                            type="text"
                            value={expense.expense_name}
                            onChange={(e) => {
                              const n = [...expenses]; n[index].expense_name = e.target.value; setExpenses(n)
                            }}
                            className="h-8 text-sm border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 min-w-[160px]"
                            placeholder="Expense name"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={expense.amount_before_65}
                          onChange={(e) => {
                            const n = [...expenses]
                            const v = parseFloat(e.target.value) || 0
                            n[index].amount_before_65 = v
                            if (n[index].amount_after_65 === 0 || n[index].amount_after_65 === expense.amount_before_65) {
                              n[index].amount_after_65 = v
                            }
                            setExpenses(n)
                          }}
                          className="h-8 text-sm text-right w-32 ml-auto block"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={expense.amount_after_65}
                          onChange={(e) => {
                            const n = [...expenses]
                            const v = parseFloat(e.target.value) || 0
                            n[index].amount_after_65 = v
                            if (n[index].amount_before_65 === 0 || n[index].amount_before_65 === expense.amount_after_65) {
                              n[index].amount_before_65 = v
                            }
                            setExpenses(n)
                          }}
                          className="h-8 text-sm text-right w-32 ml-auto block"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExpense(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
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
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Essential
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Discretionary
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      <div className="font-semibold">
                        ${expenses.reduce((s, e) => s + (e.amount_before_65 || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      <div className="font-semibold">
                        ${expenses.reduce((s, e) => s + (e.amount_after_65 || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                      </div>
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

      {/* ── SCENARIOS TABLE ── */}
      <ScenariosTable
        planId={planId}
        onAddScenario={handleAddScenario}
        onModelScenarios={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'scenario-modeling' }))}
      />

      {/* ── SCENARIO ASSUMPTIONS ── */}
      <div id="scenario-variables-section" className="rounded-xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Scenario Assumptions</h3>
            {selectedScenario && (
              <Badge variant="secondary" className="text-xs">{selectedScenario.scenario_name}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="sm" onClick={handleAddScenario}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Retirement Age</Label>
              <Input
                type="number"
                value={scenarioVars.retirement_age}
                onChange={(e) => setScenarioVars({ ...scenarioVars, retirement_age: parseInt(e.target.value) || 65 })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">SSA Income Start Age</Label>
              <Input
                type="number"
                value={scenarioVars.ssa_start_age}
                onChange={(e) => setScenarioVars({ ...scenarioVars, ssa_start_age: parseInt(e.target.value) || 62 })}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Typically 62–70</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Growth Rate — Pre-retirement</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={scenarioVars.growth_rate_before_retirement}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, growth_rate_before_retirement: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Growth Rate — In retirement</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={scenarioVars.growth_rate_during_retirement}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, growth_rate_during_retirement: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inflation Rate</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={scenarioVars.inflation_rate}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, inflation_rate: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm pr-7"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Computed summary chips */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Years to retirement', value: yearsToRetirement.toString() },
              { label: 'Retirement year',     value: retirementStartYear.toString() },
              { label: 'Expenses at retirement (inflation-adj.)', value: `$${Math.round(annualRetirementExpensesAdjusted).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr` },
              { label: 'Plan ends (age)',     value: planBasis.life_expectancy.toString() },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">SSA Income</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="planner-ssa"
                  checked={scenarioVars.planner_ssa_income ?? true}
                  onCheckedChange={(v) => setScenarioVars({ ...scenarioVars, planner_ssa_income: !!v })}
                />
                <Label htmlFor="planner-ssa" className="text-sm cursor-pointer">Include planner SSA</Label>
              </div>
              {planBasis.include_spouse && (
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id="spouse-ssa"
                    checked={scenarioVars.spouse_ssa_income ?? true}
                    onCheckedChange={(v) => setScenarioVars({ ...scenarioVars, spouse_ssa_income: !!v })}
                  />
                  <Label htmlFor="spouse-ssa" className="text-sm cursor-pointer">Include spouse SSA</Label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save actions */}
        <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4 bg-muted/10">
          <Button variant="ghost" size="sm" onClick={() => setShowDefaultsPopup(true)} className="text-muted-foreground">
            View Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetToDefaults} className="text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Reset to Defaults
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)} disabled={saving}>
              <Plus className="h-3.5 w-3.5" />
              Save as New Scenario
            </Button>
            {selectedScenarioId && (
              <Button size="sm" onClick={() => handleSaveScenarioVars()} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save to Current Scenario'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Save as New Scenario inline form ── */}
      {showSaveDialog && (
        <div className="rounded-xl border bg-card px-5 py-4">
          <h4 className="text-sm font-semibold mb-3">Save as New Scenario</h4>
          <div className="flex gap-2">
            <Input
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder={suggestScenarioName()}
              className="flex-1 h-9 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveScenarioVars(undefined, newScenarioName.trim() || suggestScenarioName())}
            />
            <Button variant="outline" size="sm" onClick={() => setNewScenarioName(suggestScenarioName())}>
              Suggest
            </Button>
            <Button size="sm" onClick={() => handleSaveScenarioVars(undefined, newScenarioName.trim() || suggestScenarioName())} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowSaveDialog(false); setNewScenarioName('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty scenarios nudge ── */}
      {scenarios.length === 0 && !showSaveDialog && (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No scenarios yet. Configure your assumptions above and save your first scenario.
          </p>
          <Button size="sm" onClick={() => setShowSaveDialog(true)} disabled={saving}>
            <Save className="h-3.5 w-3.5" />
            Save as New Scenario
          </Button>
        </div>
      )}

      <DefaultsPopup
        planId={planId}
        isOpen={showDefaultsPopup}
        onClose={() => setShowDefaultsPopup(false)}
      />
    </div>
  )
}

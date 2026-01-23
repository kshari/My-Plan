'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import ScenariosTable from '../scenarios-table'
import DefaultsPopup from '../defaults-popup'
import { Copy } from 'lucide-react'

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
    capital_gains_tax_rate: 20, // Percentage
    income_tax_rate_retirement: 25, // Percentage
    inflation_rate: 4, // Percentage
    enable_borrowing: false, // Enable borrowing to cover negative cashflow
    ssa_start_age: 62, // Age to start SSA income
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
          spouse_birth_year: data.spouse_birth_year || new Date().getFullYear() - 50,
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
          ssa_start_age: data.ssa_start_age || 62,
          growth_rate_before_retirement: parseFloat(data.growth_rate_before_retirement?.toString() || '0.1') * 100,
          growth_rate_during_retirement: parseFloat(data.growth_rate_during_retirement?.toString() || '0.05') * 100,
          capital_gains_tax_rate: parseFloat(data.capital_gains_tax_rate?.toString() || '0.2') * 100,
          income_tax_rate_retirement: parseFloat(data.income_tax_rate_retirement?.toString() || '0.25') * 100,
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
        capital_gains_tax_rate: getDefault('Capital gains & dividends blended tax rate', 20),
        income_tax_rate_retirement: getDefault('Tax rate during retirement', 25),
        inflation_rate: getDefault('Inflation', 4),
        enable_borrowing: false,
        ssa_start_age: 62,
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
        capital_gains_tax_rate: 20,
        income_tax_rate_retirement: 25,
        inflation_rate: 4,
        enable_borrowing: false,
        ssa_start_age: 62,
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
      setMessage({ type: 'success', text: 'Plan basis saved successfully!' })
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
        capital_gains_tax_rate: scenarioVars.capital_gains_tax_rate / 100,
        income_tax_rate_retirement: scenarioVars.income_tax_rate_retirement / 100,
        inflation_rate: scenarioVars.inflation_rate / 100,
        enable_borrowing: scenarioVars.enable_borrowing || false,
        ssa_start_age: scenarioVars.ssa_start_age || 62,
        planner_ssa_income: scenarioVars.planner_ssa_income !== undefined ? scenarioVars.planner_ssa_income : true,
        spouse_ssa_income: scenarioVars.spouse_ssa_income !== undefined ? scenarioVars.spouse_ssa_income : true,
      }

      const { error } = await supabase
        .from('rp_calculator_settings')
        .upsert(settingsToSave, {
          onConflict: 'scenario_id'
        })

      if (error) throw error
      
      // Load scenario variables for the selected scenario
      await loadScenarioVars()
      
      setShowSaveDialog(false)
      setNewScenarioName('')
      setMessage({ type: 'success', text: 'Scenario variables saved successfully!' })
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
    return <div className="text-center py-8 text-gray-600">Loading...</div>
  }

  const currentYear = new Date().getFullYear()
  const calculatedAge = planBasis.birth_year ? currentYear - planBasis.birth_year : planBasis.age
  const yearsToRetirement = scenarioVars.retirement_age - calculatedAge
  const retirementStartYear = currentYear + yearsToRetirement

  // Calculate totals
  const totalAssets = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  // Calculate expenses by category
  const essentialExpenses = expenses.filter(exp => isEssentialExpense(exp.expense_name))
  const discretionaryExpenses = expenses.filter(exp => !isEssentialExpense(exp.expense_name))
  
  const essentialMonthly = essentialExpenses.reduce((sum, exp) => {
    const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
    return sum + (amount || 0)
  }, 0)
  
  const discretionaryMonthly = discretionaryExpenses.reduce((sum, exp) => {
    const amount = scenarioVars.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
    return sum + (amount || 0)
  }, 0)
  
  const totalMonthlyExpenses = essentialMonthly + discretionaryMonthly
  const totalAnnualExpenses = totalMonthlyExpenses * 12
  const essentialAnnual = essentialMonthly * 12
  const discretionaryAnnual = discretionaryMonthly * 12

  // Calculate annual retirement expenses with inflation adjustment
  const inflationMultiplier = yearsToRetirement > 0 ? Math.pow(1 + (scenarioVars.inflation_rate / 100), yearsToRetirement) : 1
  const annualRetirementExpensesAdjusted = totalAnnualExpenses * inflationMultiplier

  // Calculate estimated SSA income
  const calculateEstimatedSSA = (birthYear: number, ssaStartAge: number, isPlanner: boolean = true) => {
    const age = currentYear - birthYear
    if (age < ssaStartAge) return 0
    const ssaMultiplier = age < 67 ? Math.max(0.7, 1.0 - (67 - age) * 0.05) : 1.0
    const baseAmount = isPlanner ? 20000 : 15000
    return baseAmount * ssaMultiplier
  }

  const estimatedPlannerSSA = scenarioVars.planner_ssa_income 
    ? calculateEstimatedSSA(planBasis.birth_year, scenarioVars.ssa_start_age, true)
    : 0
  const estimatedSpouseSSA = planBasis.include_spouse && scenarioVars.spouse_ssa_income
    ? calculateEstimatedSSA(planBasis.spouse_birth_year, scenarioVars.ssa_start_age, false)
    : 0

  // Calculate summary for plan basis
  const spouseAge = planBasis.include_spouse ? currentYear - planBasis.spouse_birth_year : null
  const planBasisSummary = planBasis.include_spouse
    ? `Age: ${calculatedAge} | Spouse Age: ${spouseAge} | Filing: ${planBasis.filing_status} | Life Expectancy: ${planBasis.life_expectancy} | Spouse Life Expectancy: ${planBasis.spouse_life_expectancy}`
    : `Age: ${calculatedAge} | Filing: ${planBasis.filing_status} | Life Expectancy: ${planBasis.life_expectancy}`

  // Get selected scenario name
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)
  const scenarioName = selectedScenario?.scenario_name || 'No scenario selected'

  return (
    <div className="space-y-8">
      {/* Inline Message Display */}
      {message && (
        <div className={`rounded-lg border p-4 ${
          message.type === 'success' 
            ? 'border-green-200 bg-green-50 text-green-800' 
            : message.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-blue-200 bg-blue-50 text-blue-800'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex-1">{message.text}</span>
            <div className="flex items-center gap-2">
              {message.type === 'error' && (
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.text)
                      // Show brief feedback (optional)
                    } catch (err) {
                      console.error('Failed to copy:', err)
                    }
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  title="Copy error message"
                >
                  <Copy className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setMessage(null)}
                className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Section 1: Plan Basis - Expandable Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Plan Basis</h3>
          <button
            onClick={handleSavePlanBasis}
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Plan Basis'}
          </button>
        </div>

        {/* Plan Basis Collapsible Section */}
        <div>
          <div 
            className="mb-3 flex items-center justify-between cursor-pointer"
            onClick={() => setPlanBasisExpanded(!planBasisExpanded)}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">Retirement Profile</h4>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {planBasisSummary}
                {(estimatedPlannerSSA > 0 || estimatedSpouseSSA > 0) && (
                  <span className="ml-2">
                    | SSA: {estimatedPlannerSSA > 0 ? `$${estimatedPlannerSSA.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                    {estimatedPlannerSSA > 0 && estimatedSpouseSSA > 0 ? ' / ' : ''}
                    {estimatedSpouseSSA > 0 ? `$${estimatedSpouseSSA.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                  </span>
                )}
              </div>
              <span className="text-gray-400">{planBasisExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {planBasisExpanded && (
            <div className="space-y-4">
              {/* Filing Status and Include Spouse - Same Line */}
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filing Status</label>
                  <select
                    value={planBasis.filing_status}
                    onChange={(e) => setPlanBasis({ ...planBasis, filing_status: e.target.value as any })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="Single">Single</option>
                    <option value="Married Filing Jointly">Married Filing Jointly</option>
                    <option value="Married Filing Separately">Married Filing Separately</option>
                    <option value="Head of Household">Head of Household</option>
                  </select>
                </div>
                <div className="pb-0.5">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={planBasis.include_spouse}
                      onChange={(e) => setPlanBasis({ ...planBasis, include_spouse: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Include Spouse in Plan</span>
                  </label>
                </div>
              </div>

              {/* Planner Section - Sub Card */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h5 className="mb-3 text-sm font-semibold text-gray-900">Planner</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Birth Year
                      {planBasis.birth_year && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          (Age: {calculatedAge})
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={planBasis.birth_year}
                      onChange={(e) => {
                        const birthYear = parseInt(e.target.value) || new Date().getFullYear() - 50
                        const age = currentYear - birthYear
                        setPlanBasis({ ...planBasis, birth_year: birthYear, age })
                      }}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Life Expectancy (Age)</label>
                    <input
                      type="number"
                      value={planBasis.life_expectancy}
                      onChange={(e) => setPlanBasis({ ...planBasis, life_expectancy: parseInt(e.target.value) || 90 })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Projections will run until this age</p>
                  </div>
                </div>
              </div>

              {/* Spouse Section - Sub Card (only shown if include_spouse is true) */}
              {planBasis.include_spouse && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h5 className="mb-3 text-sm font-semibold text-gray-900">Spouse</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Spouse Birth Year
                        {planBasis.spouse_birth_year && spouseAge !== null && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            (Age: {spouseAge})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        value={planBasis.spouse_birth_year}
                        onChange={(e) => {
                          const spouseBirthYear = parseInt(e.target.value) || new Date().getFullYear() - 50
                          setPlanBasis({ ...planBasis, spouse_birth_year: spouseBirthYear })
                        }}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Spouse Life Expectancy (Age)</label>
                      <input
                        type="number"
                        value={planBasis.spouse_life_expectancy}
                        onChange={(e) => setPlanBasis({ ...planBasis, spouse_life_expectancy: parseInt(e.target.value) || 90 })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accounts Section - Collapsible */}
        <div className="mb-6">
          <div 
            className="mb-3 flex items-center justify-between cursor-pointer"
            onClick={() => setAccountsExpanded(!accountsExpanded)}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">Retirement Accounts</h4>
              <span className="text-sm text-gray-500">({accounts.length} accounts)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-gray-900">
                Total Assets: ${totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddAccountRow()
                }}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                + Add Row
              </button>
              <span className="text-gray-400">{accountsExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {accountsExpanded && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Annual Contribution</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {accounts.map((account, index) => (
                    <tr key={account.id || index}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={account.account_name}
                          onChange={(e) => {
                            const newAccounts = [...accounts]
                            newAccounts[index].account_name = e.target.value
                            setAccounts(newAccounts)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Account Name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={account.owner}
                          onChange={(e) => {
                            const newAccounts = [...accounts]
                            newAccounts[index].owner = e.target.value
                            setAccounts(newAccounts)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Owner"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={account.balance}
                          onChange={(e) => {
                            const newAccounts = [...accounts]
                            newAccounts[index].balance = parseFloat(e.target.value) || 0
                            setAccounts(newAccounts)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={account.account_type || ''}
                          onChange={(e) => {
                            const newAccounts = [...accounts]
                            newAccounts[index].account_type = e.target.value
                            setAccounts(newAccounts)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">Select type</option>
                          <option value="IRA">IRA</option>
                          <option value="401k">401k</option>
                          <option value="Roth IRA">Roth IRA</option>
                          <option value="HSA">HSA</option>
                          <option value="Taxable">Taxable</option>
                          <option value="ESPP">ESPP</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={account.annual_contribution || 0}
                          onChange={(e) => {
                            const newAccounts = [...accounts]
                            newAccounts[index].annual_contribution = parseFloat(e.target.value) || 0
                            setAccounts(newAccounts)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteAccount(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expenses Section - Collapsible */}
        <div>
          <div 
            className="mb-3 flex items-center justify-between cursor-pointer"
            onClick={() => setExpensesExpanded(!expensesExpanded)}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-900">Monthly Expenses</h4>
              <span className="text-sm text-gray-500">({expenses.length} expenses)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <div className="flex gap-4">
                  <div>
                    <span className="font-semibold text-gray-900">Essential:</span>
                    <span className="ml-1">${essentialMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
                    <span className="ml-1">(${essentialAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-900">Discretionary:</span>
                    <span className="ml-1">${discretionaryMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
                    <span className="ml-1">(${discretionaryAnnual.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr)</span>
                  </div>
                  <div>
                    <span className="font-semibold text-blue-600">Total:</span>
                    <span className="ml-1">${totalMonthlyExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
                    <span className="ml-1">(${totalAnnualExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr)</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddExpenseRow()
                }}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
              >
                + Add Row
              </button>
              <span className="text-gray-400">{expensesExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {expensesExpanded && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expense</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">After 65</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Before 65</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {expenses.map((expense, index) => (
                    <tr key={expense.id || index}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={expense.expense_name}
                          onChange={(e) => {
                            const newExpenses = [...expenses]
                            newExpenses[index].expense_name = e.target.value
                            setExpenses(newExpenses)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Expense Name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={expense.amount_after_65}
                          onChange={(e) => {
                            const newExpenses = [...expenses]
                            const value = parseFloat(e.target.value) || 0
                            newExpenses[index].amount_after_65 = value
                            // Auto-copy to before_65 if it's currently 0 or same value
                            if (newExpenses[index].amount_before_65 === 0 || 
                                newExpenses[index].amount_before_65 === expense.amount_after_65) {
                              newExpenses[index].amount_before_65 = value
                            }
                            setExpenses(newExpenses)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          value={expense.amount_before_65}
                          onChange={(e) => {
                            const newExpenses = [...expenses]
                            const value = parseFloat(e.target.value) || 0
                            newExpenses[index].amount_before_65 = value
                            // Auto-copy to after_65 if it's currently 0 or same value
                            if (newExpenses[index].amount_after_65 === 0 || 
                                newExpenses[index].amount_after_65 === expense.amount_before_65) {
                              newExpenses[index].amount_after_65 = value
                            }
                            setExpenses(newExpenses)
                          }}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-right"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteExpense(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Scenarios Table */}
      <ScenariosTable planId={planId} onAddScenario={handleAddScenario} />

      {showSaveDialog && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="font-medium text-gray-900 mb-3">Save as New Scenario</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder={suggestScenarioName()}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              onKeyPress={(e) => e.key === 'Enter' && (newScenarioName.trim() || suggestScenarioName()) && handleSaveScenarioVars(undefined, newScenarioName.trim() || suggestScenarioName())}
            />
            <button
              onClick={() => setNewScenarioName(suggestScenarioName())}
              className="rounded-md bg-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-300"
              title="Use suggested name"
            >
              Suggest
            </button>
            <button
              onClick={() => handleSaveScenarioVars(undefined, newScenarioName.trim() || suggestScenarioName())}
              disabled={saving || (!newScenarioName.trim() && !suggestScenarioName())}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false)
                setNewScenarioName('')
              }}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {scenarios.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">No scenarios yet. Configure your scenario variables and save as your first scenario.</p>
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={saving}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Save as New Scenario
            </button>
          </div>
        </div>
      )}

      {/* Section 2: Scenario Variables - Expandable */}
      <div id="scenario-variables-section" className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Scenario Variables</h3>
        </div>

        {/* Summary Card - Always Visible */}
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{scenarioName}</h4>
            <button
              onClick={() => setScenarioVarsExpanded(!scenarioVarsExpanded)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {scenarioVarsExpanded ? 'Done' : 'Edit / Add'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {(estimatedPlannerSSA > 0 || estimatedSpouseSSA > 0) && (
              <>
                {estimatedPlannerSSA > 0 && (
                  <div>
                    <span className="text-gray-600">Estimated Planner SSA Income:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      ${estimatedPlannerSSA.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                    </span>
                  </div>
                )}
                {estimatedSpouseSSA > 0 && (
                  <div>
                    <span className="text-gray-600">Estimated Spouse SSA Income:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      ${estimatedSpouseSSA.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr
                    </span>
                  </div>
                )}
              </>
            )}
            <div>
              <span className="text-gray-600">Years to Retirement:</span>
              <span className="ml-2 font-semibold text-gray-900">{yearsToRetirement}</span>
            </div>
            <div>
              <span className="text-gray-600">Retirement Start Year:</span>
              <span className="ml-2 font-semibold text-gray-900">{retirementStartYear}</span>
            </div>
            <div>
              <span className="text-gray-600">Annual Retirement Expenses (adjusted for inflation):</span>
              <span className="ml-2 font-semibold text-gray-900">
                ${annualRetirementExpensesAdjusted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Retirement Age:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.retirement_age}</span>
            </div>
            <div>
              <span className="text-gray-600">SSA Income Start Age:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.ssa_start_age}</span>
            </div>
            <div>
              <span className="text-gray-600">Growth Rate Before Retirement:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.growth_rate_before_retirement}%</span>
            </div>
            <div>
              <span className="text-gray-600">Growth Rate During Retirement:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.growth_rate_during_retirement}%</span>
            </div>
            <div>
              <span className="text-gray-600">Capital Gains Tax Rate:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.capital_gains_tax_rate}%</span>
            </div>
            <div>
              <span className="text-gray-600">Income Tax Rate During Retirement:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.income_tax_rate_retirement}%</span>
            </div>
            <div>
              <span className="text-gray-600">Inflation Rate:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.inflation_rate}%</span>
            </div>
            <div>
              <span className="text-gray-600">Enable Borrowing:</span>
              <span className="ml-2 font-semibold text-gray-900">{scenarioVars.enable_borrowing ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Scenario Variables Collapsible Section - Editable Fields and Buttons */}
        {scenarioVarsExpanded && (
          <div className="space-y-4">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowDefaultsPopup(true)}
                className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Defaults
              </button>
              <button
                onClick={handleResetToDefaults}
                className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
              >
                Reset to Defaults
              </button>
              {selectedScenarioId && (
                <button
                  onClick={() => handleSaveScenarioVars()}
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save to Current Scenario'}
                </button>
              )}
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={saving}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save as New Scenario
              </button>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Retirement Age</label>
                <input
                  type="number"
                  value={scenarioVars.retirement_age}
                  onChange={(e) => {
                    const age = parseInt(e.target.value) || 65
                    setScenarioVars({ 
                      ...scenarioVars, 
                      retirement_age: age,
                    })
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">SSA Income Start Age</label>
                <input
                  type="number"
                  value={scenarioVars.ssa_start_age}
                  onChange={(e) => {
                    const age = parseInt(e.target.value) || 62
                    setScenarioVars({ ...scenarioVars, ssa_start_age: age })
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
                <p className="mt-1 text-xs text-gray-500">Age when Social Security benefits begin (typically 62-70)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Growth Rate Before Retirement (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scenarioVars.growth_rate_before_retirement}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, growth_rate_before_retirement: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Growth Rate During Retirement (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scenarioVars.growth_rate_during_retirement}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, growth_rate_during_retirement: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Capital Gains & Dividends Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scenarioVars.capital_gains_tax_rate}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, capital_gains_tax_rate: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Income Tax Rate During Retirement (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scenarioVars.income_tax_rate_retirement}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, income_tax_rate_retirement: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Inflation Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={scenarioVars.inflation_rate}
                  onChange={(e) => setScenarioVars({ ...scenarioVars, inflation_rate: parseFloat(e.target.value) || 0 })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scenarioVars.enable_borrowing}
                      onChange={(e) => setScenarioVars({ ...scenarioVars, enable_borrowing: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Enable Borrowing to Cover Negative Cashflow</span>
                  </label>
                  <p className="text-xs text-gray-600 mt-1 ml-6">
                    When enabled, the plan will borrow money to cover shortfalls and pay down debt when surplus income is available.
                  </p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h6 className="text-sm font-semibold text-gray-900 mb-3">SSA Income Settings</h6>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scenarioVars.planner_ssa_income ?? true}
                        onChange={(e) => setScenarioVars({ ...scenarioVars, planner_ssa_income: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">Include Planner SSA Income</span>
                    </label>
                    {planBasis.include_spouse && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scenarioVars.spouse_ssa_income ?? true}
                          onChange={(e) => setScenarioVars({ ...scenarioVars, spouse_ssa_income: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">Include Spouse SSA Income</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Defaults Popup */}
      <DefaultsPopup
        planId={planId}
        isOpen={showDefaultsPopup}
        onClose={() => setShowDefaultsPopup(false)}
      />
    </div>
  )
}

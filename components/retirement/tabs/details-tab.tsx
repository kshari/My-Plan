'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/property/ui/tooltip'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { 
  calculateRetirementProjections,
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'

interface DetailsTabProps {
  planId: number
}

export default function DetailsTab({ planId }: DetailsTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [projections, setProjections] = useState<ProjectionDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [hasAutoCalculated, setHasAutoCalculated] = useState(false)
  const [retirementAge, setRetirementAge] = useState<number | null>(null)
  const [settings, setSettings] = useState<CalculatorSettings | null>(null)
  const [lifeExpectancy, setLifeExpectancy] = useState<number>(90)
  const [showPreRetirement, setShowPreRetirement] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table')
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [incomeGroupExpanded, setIncomeGroupExpanded] = useState(false)
  const [balanceGroupExpanded, setBalanceGroupExpanded] = useState(false)
  const [scenarios, setScenarios] = useState<Array<{ id: number; scenario_name: string; is_default: boolean }>>([])
  const [modelingWithdrawalPriority, setModelingWithdrawalPriority] = useState<'default' | 'longevity' | 'legacy' | 'tax_optimization' | 'stable_income' | 'sequence_risk' | 'liquidity'>('default')
  const [modelingWithdrawalSecondary, setModelingWithdrawalSecondary] = useState<'default' | 'longevity' | 'legacy' | 'tax_optimization' | 'stable_income' | 'sequence_risk' | 'liquidity'>('tax_optimization')
  const [strategyModelerExpanded, setStrategyModelerExpanded] = useState(false)
  const [modelingStrategyType, setModelingStrategyType] = useState<'goal_based' | 'amount_based_4_percent' | 'amount_based_fixed_percentage' | 'amount_based_fixed_dollar' | 'amount_based_swp' | 'sequence_proportional' | 'sequence_bracket_topping' | 'market_bucket' | 'market_guardrails' | 'market_floor_upside' | 'tax_roth_conversion' | 'tax_qcd'>('goal_based')
  const [strategyParams, setStrategyParams] = useState({
    fixed_percentage_rate: 4, // 4%
    fixed_dollar_amount: 50000,
    guardrails_ceiling: 6, // 6%
    guardrails_floor: 3, // 3%
    bracket_topping_threshold: 12, // 12% tax bracket
  })
  const [comparingStrategies, setComparingStrategies] = useState(false)
  const [strategyComparison, setStrategyComparison] = useState<Array<{
    strategyName: string
    strategyType: string
    legacyValue: number
    longevity: number
    totalTax: number
    avgAnnualTax: number
    taxEfficiency: number
    negativeYears: number
    negativeYearsPercentage: number
    lifetimeIncome: number
    lifetimeExpenses: number
    totalWithdrawals: number
  }>>([])
  const [activeSubTab, setActiveSubTab] = useState<'projections' | 'strategy-modeling'>('projections')
  const [visibleColumns, setVisibleColumns] = useState({
    year: true,
    age: true,
    event: true,
    ssa: false, // Hidden by default, shown when income group expanded
    dist401k: false,
    distRoth: false,
    distTaxable: false,
    distHsa: false,
    distIra: false,
    distOther: false,
    otherIncome: false,
    totalIncome: true, // Shown by default
    tax: true,
    expenses: true,
    gapExcess: true,
    networth: true, // Shown by default
    balance401k: false, // Hidden by default, shown when balance group expanded
    balanceRoth: false,
    balanceTaxable: false,
    balanceHsa: false,
    balanceIra: false,
    balanceOther: false,
  })

  useEffect(() => {
    loadScenarios()
  }, [planId])

  useEffect(() => {
    if (selectedScenarioId) {
      loadProjections(selectedScenarioId)
    } else {
      setProjections([])
      setRetirementAge(null)
    }
  }, [selectedScenarioId])

  const loadScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('id, scenario_name, is_default')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setScenarios(data || [])
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  // Auto-calculate on first load if no projections exist
  useEffect(() => {
    if (selectedScenarioId && !hasAutoCalculated && projections.length === 0) {
      calculateAndSaveProjections()
      setHasAutoCalculated(true)
    }
  }, [selectedScenarioId, hasAutoCalculated, projections.length])

  // Recalculate projections when strategy type or parameters change
  useEffect(() => {
    if (selectedScenarioId && hasAutoCalculated && projections.length > 0) {
      // Debounce to avoid too many recalculations
      const timeoutId = setTimeout(() => {
        calculateAndSaveProjections()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelingStrategyType, modelingWithdrawalPriority, modelingWithdrawalSecondary, strategyParams.fixed_percentage_rate, strategyParams.fixed_dollar_amount, strategyParams.guardrails_ceiling, strategyParams.guardrails_floor, strategyParams.bracket_topping_threshold, selectedScenarioId])

  const loadProjections = async (scenarioId?: number) => {
    const targetScenarioId = scenarioId || selectedScenarioId
    if (!targetScenarioId) return
    
    setLoading(true)
    try {
      // Load retirement age from settings and life expectancy from plan
      const [settingsResult, planResult] = await Promise.all([
        supabase
        .from('rp_calculator_settings')
        .select('retirement_age')
        .eq('scenario_id', targetScenarioId)
          .single(),
        supabase
          .from('rp_retirement_plans')
          .select('life_expectancy')
          .eq('id', planId)
        .single()
      ])
      
      if (!settingsResult.error && settingsResult.data?.retirement_age) {
        setRetirementAge(settingsResult.data.retirement_age)
      }
      
      if (!planResult.error && planResult.data?.life_expectancy) {
        setLifeExpectancy(planResult.data.life_expectancy)
      }

      const { data, error } = await supabase
        .from('rp_projection_details')
        .select('*')
        .eq('scenario_id', targetScenarioId)
        .order('year')

      if (error) throw error
      setProjections(data || [])
    } catch (error) {
      console.error('Error loading projections:', error)
    } finally {
      setLoading(false)
    }
  }

  const compareAllStrategies = async () => {
    if (!selectedScenarioId) return

    try {
      // Get all the data needed for calculations
      const [planData, accountsData, expensesData, otherIncomeData, settingsData] = await Promise.all([
        supabase.from('rp_retirement_plans').select('*').eq('id', planId).single(),
        supabase.from('rp_accounts').select('*').eq('plan_id', planId).order('id'),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId).order('id'),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId).order('id'),
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
      ])

      if (planData.error || accountsData.error || expensesData.error || otherIncomeData.error || settingsData.error) {
        console.error('Error loading data for comparison:', { planData, accountsData, expensesData, otherIncomeData, settingsData })
        return
      }

      const accounts: Account[] = (accountsData.data || []).map(acc => ({
        id: acc.id,
        account_name: acc.account_name || '',
        owner: acc.owner || 'planner',
        account_type: acc.account_type || 'Other',
        balance: acc.balance || 0,
        annual_contribution: acc.annual_contribution || 0,
      }))

      const expenses: Expense[] = (expensesData.data || []).map(exp => ({
        id: exp.id,
        expense_name: exp.expense_name || '',
        amount_before_65: exp.amount_before_65 || 0,
        amount_after_65: exp.amount_after_65 || 0,
      }))

      const otherIncome: OtherIncome[] = (otherIncomeData.data || []).map(inc => ({
        id: inc.id,
        income_name: inc.income_source || '',
        amount: inc.annual_amount || 0,
        start_year: inc.start_year || undefined,
        end_year: inc.end_year || undefined,
        inflation_adjusted: inc.inflation_adjusted || false,
      }))

      const lifeExpectancy = planData.data?.life_expectancy || 90

      // Base settings
      const baseSettings: CalculatorSettings = {
        current_year: settingsData.data.current_year || new Date().getFullYear(),
        retirement_age: settingsData.data.retirement_age || 65,
        retirement_start_year: settingsData.data.retirement_start_year || 0,
        years_to_retirement: settingsData.data.years_to_retirement || 0,
        annual_retirement_expenses: settingsData.data.annual_retirement_expenses || 0,
        growth_rate_before_retirement: parseFloat(settingsData.data.growth_rate_before_retirement?.toString() || '0.1'),
        growth_rate_during_retirement: parseFloat(settingsData.data.growth_rate_during_retirement?.toString() || '0.05'),
        capital_gains_tax_rate: parseFloat(settingsData.data.capital_gains_tax_rate?.toString() || '0.2'),
        income_tax_rate_retirement: parseFloat(settingsData.data.income_tax_rate_retirement?.toString() || '0.25'),
        inflation_rate: parseFloat(settingsData.data.inflation_rate?.toString() || '0.04'),
        enable_borrowing: settingsData.data.enable_borrowing || false,
        ssa_start_age: settingsData.data.ssa_start_age || 62,
        withdrawal_priority: 'default',
        withdrawal_secondary_priority: 'tax_optimization',
      }

      // Define all strategies to compare
      const strategiesToCompare: Array<{
        name: string
        type: typeof modelingStrategyType
        settings: CalculatorSettings
      }> = [
        {
          name: 'Goal-Based: Default',
          type: 'goal_based',
          settings: { ...baseSettings, withdrawal_priority: 'default', withdrawal_secondary_priority: 'tax_optimization' },
        },
        {
          name: 'Goal-Based: Longevity',
          type: 'goal_based',
          settings: { ...baseSettings, withdrawal_priority: 'longevity', withdrawal_secondary_priority: 'tax_optimization' },
        },
        {
          name: 'Goal-Based: Legacy',
          type: 'goal_based',
          settings: { ...baseSettings, withdrawal_priority: 'legacy', withdrawal_secondary_priority: 'tax_optimization' },
        },
        {
          name: '4% Rule',
          type: 'amount_based_4_percent',
          settings: { ...baseSettings, withdrawal_strategy_type: 'amount_based_4_percent' },
        },
        {
          name: `Fixed Percentage (${strategyParams.fixed_percentage_rate}%)`,
          type: 'amount_based_fixed_percentage',
          settings: {
            ...baseSettings,
            withdrawal_strategy_type: 'amount_based_fixed_percentage',
            fixed_percentage_rate: strategyParams.fixed_percentage_rate / 100,
          },
        },
        {
          name: `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString()})`,
          type: 'amount_based_fixed_dollar',
          settings: {
            ...baseSettings,
            withdrawal_strategy_type: 'amount_based_fixed_dollar',
            fixed_dollar_amount: strategyParams.fixed_dollar_amount,
          },
        },
        {
          name: 'SWP (Earnings Only)',
          type: 'amount_based_swp',
          settings: { ...baseSettings, withdrawal_strategy_type: 'amount_based_swp' },
        },
        {
          name: 'Proportional Withdrawals',
          type: 'sequence_proportional',
          settings: { ...baseSettings, withdrawal_strategy_type: 'sequence_proportional' },
        },
        {
          name: `Bracket-Topping (${strategyParams.bracket_topping_threshold}%)`,
          type: 'sequence_bracket_topping',
          settings: {
            ...baseSettings,
            withdrawal_strategy_type: 'sequence_bracket_topping',
            bracket_topping_threshold: strategyParams.bracket_topping_threshold,
          },
        },
        {
          name: 'Bucket Strategy',
          type: 'market_bucket',
          settings: { ...baseSettings, withdrawal_strategy_type: 'market_bucket' },
        },
        {
          name: `Guardrails (${strategyParams.guardrails_floor}%-${strategyParams.guardrails_ceiling}%)`,
          type: 'market_guardrails',
          settings: {
            ...baseSettings,
            withdrawal_strategy_type: 'market_guardrails',
            guardrails_ceiling: strategyParams.guardrails_ceiling / 100,
            guardrails_floor: strategyParams.guardrails_floor / 100,
          },
        },
        {
          name: 'Floor-and-Upside',
          type: 'market_floor_upside',
          settings: { ...baseSettings, withdrawal_strategy_type: 'market_floor_upside' },
        },
        {
          name: 'Roth Conversion Bridge',
          type: 'tax_roth_conversion',
          settings: { ...baseSettings, withdrawal_strategy_type: 'tax_roth_conversion' },
        },
        {
          name: 'QCDs',
          type: 'tax_qcd',
          settings: { ...baseSettings, withdrawal_strategy_type: 'tax_qcd' },
        },
      ]

      // Calculate projections for each strategy
      const comparisonResults = strategiesToCompare.map(strategy => {
        const calculatedProjections = calculateRetirementProjections(
          planData.data.birth_year,
          accounts,
          expenses,
          otherIncome,
          strategy.settings,
          lifeExpectancy,
          planData.data.spouse_birth_year || undefined,
          planData.data.spouse_life_expectancy || undefined,
          settingsData.data?.planner_ssa_income !== undefined ? settingsData.data.planner_ssa_income : true,
          planData.data.include_spouse && (settingsData.data?.spouse_ssa_income !== undefined ? settingsData.data.spouse_ssa_income : true) || false
        )

        // Calculate metrics
        const retirementAge = strategy.settings.retirement_age || 65
        const retirementProjections = calculatedProjections.filter(p => {
          const age = p.age || 0
          return age >= retirementAge
        })

        const finalProjection = calculatedProjections[calculatedProjections.length - 1]
        const legacyValue = finalProjection?.networth || 0

        const totalTax = retirementProjections.reduce((sum, p) => sum + (p.tax || 0), 0)
        const avgAnnualTax = retirementProjections.length > 0 ? totalTax / retirementProjections.length : 0

        const zeroNetworthYear = calculatedProjections.findIndex(p => (p.networth || 0) <= 0)
        const finalAge = finalProjection?.age || 0
        const longevityBeyondLifeExpectancy = zeroNetworthYear >= 0
          ? (calculatedProjections[zeroNetworthYear]?.age || 0) - lifeExpectancy
          : finalAge - lifeExpectancy

        const totalIncome = retirementProjections.reduce((sum, p) => sum + (p.total_income || 0), 0)
        const lifetimeExpenses = retirementProjections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
        const taxEfficiency = totalIncome > 0 ? ((totalTax / totalIncome) * 100) : 0

        // Only count as negative if gap_excess is significantly negative (more than -$1 to avoid rounding errors)
        const negativeYears = retirementProjections.filter(p => (p.gap_excess || 0) < -1).length
        const negativeYearsPercentage = retirementProjections.length > 0 ? (negativeYears / retirementProjections.length) * 100 : 0

        const totalWithdrawals = retirementProjections.reduce((sum, p) => {
          return sum + (p.distribution_401k || 0) + (p.distribution_roth || 0) + (p.distribution_taxable || 0) +
                 (p.distribution_hsa || 0) + (p.distribution_ira || 0) + (p.distribution_other || 0)
        }, 0)

        return {
          strategyName: strategy.name,
          strategyType: strategy.type,
          legacyValue,
          longevity: longevityBeyondLifeExpectancy,
          totalTax,
          avgAnnualTax,
          taxEfficiency,
          negativeYears,
          negativeYearsPercentage,
          lifetimeIncome: totalIncome,
          lifetimeExpenses,
          totalWithdrawals,
        }
      })

      setStrategyComparison(comparisonResults)
    } catch (error) {
      console.error('Error comparing strategies:', error)
    }
  }

  const calculateAndSaveProjections = async () => {
    if (!selectedScenarioId) {
      console.warn('Please select a scenario first')
      return
    }

    try {
      setCalculating(true)
      // Load life expectancy from plan
      const { data: planData } = await supabase
        .from('rp_retirement_plans')
        .select('life_expectancy')
        .eq('id', planId)
        .single()

      const lifeExpectancy = planData?.life_expectancy || 100
      await calculateAndSaveProjectionsInternal(selectedScenarioId, lifeExpectancy)
    } catch (error: any) {
      console.error('Error in calculateAndSaveProjections:', error)
      // Silently handle error - no alerts
    } finally {
      setCalculating(false)
    }
  }

  const calculateAndSaveProjectionsInternal = async (scenarioId: number, lifeExpectancy: number = 100) => {
    try {
      // Load all necessary data
      const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
        supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy').eq('id', planId).single(),
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', scenarioId).single(),
      ])

      if (planData.error) throw planData.error
      if (accountsData.error) throw accountsData.error
      if (expensesData.error) throw expensesData.error
      if (incomeData.error) throw incomeData.error
      if (settingsData.error) throw settingsData.error

      if (!planData.data?.birth_year) {
        console.warn('Please set birth year in Plan Details')
        return
      }

      if (!settingsData.data) {
        console.warn('Please configure scenario settings in Plan Details')
        return
      }

      const accounts: Account[] = (accountsData.data || []).map(acc => ({
        id: acc.id,
        account_name: acc.account_name,
        owner: acc.owner || '',
        balance: acc.balance || 0,
        account_type: acc.account_type,
        annual_contribution: acc.annual_contribution || 0,
      }))

      const expenses: Expense[] = (expensesData.data || []).map(exp => ({
        id: exp.id,
        expense_name: exp.expense_name,
        amount_after_65: exp.amount_after_65 || 0,
        amount_before_65: exp.amount_before_65 || 0,
      }))

      const otherIncome: OtherIncome[] = (incomeData.data || []).map(inc => ({
        id: inc.id,
        income_name: inc.income_source || '',
        amount: inc.annual_amount || 0,
        start_year: inc.start_year || undefined,
        end_year: inc.end_year || undefined,
        inflation_adjusted: inc.inflation_adjusted || false,
      }))

      // For saved projections, always use default strategy
      // For display/modeling, use the selected modeling strategy
      const baseSettings: CalculatorSettings = {
        current_year: settingsData.data.current_year || new Date().getFullYear(),
        retirement_age: settingsData.data.retirement_age || 65,
        retirement_start_year: settingsData.data.retirement_start_year || 0,
        years_to_retirement: settingsData.data.years_to_retirement || 0,
        annual_retirement_expenses: settingsData.data.annual_retirement_expenses || 0,
        growth_rate_before_retirement: parseFloat(settingsData.data.growth_rate_before_retirement?.toString() || '0.1'),
        growth_rate_during_retirement: parseFloat(settingsData.data.growth_rate_during_retirement?.toString() || '0.05'),
        capital_gains_tax_rate: parseFloat(settingsData.data.capital_gains_tax_rate?.toString() || '0.2'),
        income_tax_rate_retirement: parseFloat(settingsData.data.income_tax_rate_retirement?.toString() || '0.25'),
        inflation_rate: parseFloat(settingsData.data.inflation_rate?.toString() || '0.04'),
        enable_borrowing: settingsData.data.enable_borrowing || false,
        ssa_start_age: settingsData.data.ssa_start_age || 62,
        withdrawal_priority: 'default', // Always use default for saved projections
        withdrawal_secondary_priority: 'tax_optimization', // Always use default for saved projections
      }
      
      // For display only, use modeling strategy
      // Note: This uses the current state values, which may not be updated yet if called synchronously
      // We'll use the latest state by reading it directly
      const currentStrategyType = modelingStrategyType
      const currentPriority = modelingWithdrawalPriority
      const currentSecondary = modelingWithdrawalSecondary
      const currentParams = strategyParams
      
      const settings: CalculatorSettings = {
        ...baseSettings,
        withdrawal_priority: currentPriority, // Use modeling selection for display
        withdrawal_secondary_priority: currentSecondary, // Use modeling selection for display
        withdrawal_strategy_type: currentStrategyType, // Strategy type selection
        fixed_percentage_rate: currentParams.fixed_percentage_rate ? currentParams.fixed_percentage_rate / 100 : undefined,
        fixed_dollar_amount: currentParams.fixed_dollar_amount,
        guardrails_ceiling: currentParams.guardrails_ceiling ? currentParams.guardrails_ceiling / 100 : undefined,
        guardrails_floor: currentParams.guardrails_floor ? currentParams.guardrails_floor / 100 : undefined,
        bracket_topping_threshold: currentParams.bracket_topping_threshold,
      }
      
      // Set retirement age for display filtering
      if (settings.retirement_age) {
        setRetirementAge(settings.retirement_age)
      }
      // Set life expectancy
      if (planData.data?.life_expectancy) {
        setLifeExpectancy(planData.data.life_expectancy)
      }
      setSettings(settings)

      // Calculate projections - use life expectancy parameter
      const calculatedProjections = calculateRetirementProjections(
        planData.data.birth_year,
        accounts,
        expenses,
        otherIncome,
        settings,
        lifeExpectancy, // Project to life expectancy age
        planData.data.spouse_birth_year || undefined,
        planData.data.spouse_life_expectancy || undefined,
        settingsData.data?.planner_ssa_income !== undefined ? settingsData.data.planner_ssa_income : true,
        planData.data.include_spouse && (settingsData.data?.spouse_ssa_income !== undefined ? settingsData.data.spouse_ssa_income : true) || false
      )
      
      // For saving, recalculate with default strategy
      const projectionsForSaving = calculateRetirementProjections(
        planData.data.birth_year,
        accounts,
        expenses,
        otherIncome,
        baseSettings, // Always use default strategy for saved projections
        lifeExpectancy,
        planData.data.spouse_birth_year || undefined,
        planData.data.spouse_life_expectancy || undefined,
        settingsData.data?.planner_ssa_income !== undefined ? settingsData.data.planner_ssa_income : true,
        planData.data.include_spouse && (settingsData.data?.spouse_ssa_income !== undefined ? settingsData.data.spouse_ssa_income : true) || false
      )

      // Delete existing projections for this scenario
      const { error: deleteError } = await supabase
        .from('rp_projection_details')
        .delete()
        .eq('scenario_id', scenarioId)

      if (deleteError) {
        console.error('Error deleting existing projections:', deleteError)
        throw deleteError
      }

      // Insert new projections (always use default strategy for saved data)
      const projectionsToInsert = projectionsForSaving.map(proj => ({
        plan_id: planId,
        scenario_id: scenarioId,
        year: proj.year,
        age: proj.age,
        event: proj.event,
        ssa_income: proj.ssa_income || 0,
        distribution_401k: proj.distribution_401k || 0,
        distribution_roth: proj.distribution_roth || 0,
        distribution_taxable: proj.distribution_taxable || 0,
        distribution_hsa: proj.distribution_hsa || 0,
        distribution_ira: proj.distribution_ira || 0,
        distribution_other: proj.distribution_other || 0,
        investment_income: proj.investment_income || 0,
        other_recurring_income: proj.other_recurring_income || 0,
        total_income: proj.total_income || 0,
        after_tax_income: proj.after_tax_income || 0,
        living_expenses: proj.living_expenses || 0,
        special_expenses: proj.special_expenses || 0,
        total_expenses: proj.total_expenses || 0,
        gap_excess: proj.gap_excess || 0,
        cumulative_liability: proj.cumulative_liability || 0,
        debt_balance: proj.debt_balance || 0,
        debt_interest_paid: proj.debt_interest_paid || 0,
        debt_principal_paid: proj.debt_principal_paid || 0,
        assets_remaining: proj.assets_remaining || 0,
        networth: proj.networth || 0,
        balance_401k: proj.balance_401k || 0,
        balance_roth: proj.balance_roth || 0,
        balance_investment: proj.balance_investment || 0,
        balance_other_investments: proj.balance_other_investments || 0,
        balance_hsa: proj.balance_hsa || 0,
        balance_ira: proj.balance_ira || 0,
        taxable_income: proj.taxable_income || 0,
        tax: proj.tax || 0,
      }))

      // Use upsert to handle any remaining duplicates (in case delete didn't catch everything)
      const { error: insertError } = await supabase
        .from('rp_projection_details')
        .upsert(projectionsToInsert, {
          onConflict: 'scenario_id,year',
          ignoreDuplicates: false
        })

      if (insertError) throw insertError

      // Reload projections
      await loadProjections(scenarioId)
    } catch (error: any) {
      console.error('Error calculating projections:', error)
      throw error // Re-throw to let the UI handle it
    }
  }

  if (loading && projections.length === 0) {
    return <div className="p-6 text-center text-gray-600">Loading projections...</div>
  }

  // Filter projections based on toggle
  const filteredProjections = showPreRetirement 
    ? projections 
    : projections.filter(proj => retirementAge === null || (proj.age || 0) >= retirementAge)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Projections</h2>
          {/* Scenario Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Scenario:</label>
            <select
              value={selectedScenarioId || ''}
              onChange={(e) => setSelectedScenarioId(parseInt(e.target.value))}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {scenarios.length === 0 ? (
                <option value="">No scenarios available</option>
              ) : (
                scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.scenario_name}
                    {scenario.is_default ? ' (Default)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={calculateAndSaveProjections}
            disabled={calculating || !selectedScenarioId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {calculating ? 'Calculating...' : 'Calculate Projections'}
          </button>
          <button
            onClick={() => setActiveSubTab('strategy-modeling')}
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Strategy Modeling
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSubTab('projections')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeSubTab === 'projections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Projections
          </button>
          <button
            onClick={() => setActiveSubTab('strategy-modeling')}
            className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
              activeSubTab === 'strategy-modeling'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Strategy Modeling
          </button>
        </nav>
      </div>

      {/* Projections Sub-tab */}
      {activeSubTab === 'projections' && (
        <div>


      {viewMode === 'graph' ? (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={600}>
            {graphType === 'line' ? (
              <LineChart data={filteredProjections.map(proj => ({
                age: proj.age || 0,
                ssa: proj.ssa_income || 0,
                dist401k: proj.distribution_401k || 0,
                distRoth: proj.distribution_roth || 0,
                distTaxable: proj.distribution_taxable || 0,
                distHsa: proj.distribution_hsa || 0,
                distIra: proj.distribution_ira || 0,
                distOther: proj.distribution_other || 0,
                otherIncome: proj.other_recurring_income || 0,
                totalIncome: proj.total_income || 0,
                tax: proj.tax || 0,
                expenses: proj.total_expenses || 0,
                gapExcess: proj.gap_excess || 0,
                networth: proj.networth || 0,
                balance401k: proj.balance_401k || 0,
                balanceRoth: proj.balance_roth || 0,
                balanceTaxable: proj.balance_investment || 0,
                balanceHsa: proj.balance_hsa || 0,
                balanceIra: proj.balance_ira || 0,
                balanceOther: proj.balance_other_investments || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <Legend />
                {visibleColumns.networth && <Line type="monotone" dataKey="networth" stroke="#0ea5e9" strokeWidth={3} name="Networth" />}
                {visibleColumns.balance401k && <Line type="monotone" dataKey="balance401k" stackId="balances" stroke="#22c55e" strokeWidth={2} name="401k Balance" />}
                {visibleColumns.balanceRoth && <Line type="monotone" dataKey="balanceRoth" stackId="balances" stroke="#eab308" strokeWidth={2} name="Roth Balance" />}
                {visibleColumns.balanceTaxable && <Line type="monotone" dataKey="balanceTaxable" stackId="balances" stroke="#f43f5e" strokeWidth={2} name="Taxable Balance" />}
                {visibleColumns.balanceHsa && <Line type="monotone" dataKey="balanceHsa" stackId="balances" stroke="#a855f7" strokeWidth={2} name="HSA Balance" />}
                {visibleColumns.balanceIra && <Line type="monotone" dataKey="balanceIra" stackId="balances" stroke="#06b6d4" strokeWidth={2} name="IRA Balance" />}
                {visibleColumns.balanceOther && <Line type="monotone" dataKey="balanceOther" stackId="balances" stroke="#ec4899" strokeWidth={2} name="Other Balance" />}
              </LineChart>
            ) : graphType === 'area' ? (
              <AreaChart data={filteredProjections.map(proj => ({
                age: proj.age || 0,
                ssa: proj.ssa_income || 0,
                dist401k: proj.distribution_401k || 0,
                distRoth: proj.distribution_roth || 0,
                distTaxable: proj.distribution_taxable || 0,
                distHsa: proj.distribution_hsa || 0,
                distIra: proj.distribution_ira || 0,
                distOther: proj.distribution_other || 0,
                otherIncome: proj.other_recurring_income || 0,
                totalIncome: proj.total_income || 0,
                tax: proj.tax || 0,
                expenses: proj.total_expenses || 0,
                gapExcess: proj.gap_excess || 0,
                networth: proj.networth || 0,
                balance401k: proj.balance_401k || 0,
                balanceRoth: proj.balance_roth || 0,
                balanceTaxable: proj.balance_investment || 0,
                balanceHsa: proj.balance_hsa || 0,
                balanceIra: proj.balance_ira || 0,
                balanceOther: proj.balance_other_investments || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <Legend />
                {visibleColumns.networth && <Area type="monotone" dataKey="networth" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} name="Networth" />}
                {visibleColumns.balance401k && <Area type="monotone" dataKey="balance401k" stackId="balances" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="401k Balance" />}
                {visibleColumns.balanceRoth && <Area type="monotone" dataKey="balanceRoth" stackId="balances" stroke="#eab308" fill="#eab308" fillOpacity={0.6} name="Roth Balance" />}
                {visibleColumns.balanceTaxable && <Area type="monotone" dataKey="balanceTaxable" stackId="balances" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.6} name="Taxable Balance" />}
                {visibleColumns.balanceHsa && <Area type="monotone" dataKey="balanceHsa" stackId="balances" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} name="HSA Balance" />}
                {visibleColumns.balanceIra && <Area type="monotone" dataKey="balanceIra" stackId="balances" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} name="IRA Balance" />}
                {visibleColumns.balanceOther && <Area type="monotone" dataKey="balanceOther" stackId="balances" stroke="#ec4899" fill="#ec4899" fillOpacity={0.6} name="Other Balance" />}
              </AreaChart>
            ) : (
              <BarChart data={filteredProjections.map(proj => ({
                age: proj.age || 0,
                ssa: proj.ssa_income || 0,
                dist401k: proj.distribution_401k || 0,
                distRoth: proj.distribution_roth || 0,
                distTaxable: proj.distribution_taxable || 0,
                distHsa: proj.distribution_hsa || 0,
                distIra: proj.distribution_ira || 0,
                distOther: proj.distribution_other || 0,
                otherIncome: proj.other_recurring_income || 0,
                totalIncome: proj.total_income || 0,
                tax: proj.tax || 0,
                expenses: proj.total_expenses || 0,
                gapExcess: proj.gap_excess || 0,
                networth: proj.networth || 0,
                balance401k: proj.balance_401k || 0,
                balanceRoth: proj.balance_roth || 0,
                balanceTaxable: proj.balance_investment || 0,
                balanceHsa: proj.balance_hsa || 0,
                balanceIra: proj.balance_ira || 0,
                balanceOther: proj.balance_other_investments || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="age" label={{ value: 'Age', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }} />
                <RechartsTooltip formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <Legend />
                {visibleColumns.networth && <Bar dataKey="networth" fill="#0ea5e9" name="Networth" />}
                {visibleColumns.balance401k && <Bar dataKey="balance401k" stackId="balances" fill="#22c55e" name="401k Balance" />}
                {visibleColumns.balanceRoth && <Bar dataKey="balanceRoth" stackId="balances" fill="#eab308" name="Roth Balance" />}
                {visibleColumns.balanceTaxable && <Bar dataKey="balanceTaxable" stackId="balances" fill="#f43f5e" name="Taxable Balance" />}
                {visibleColumns.balanceHsa && <Bar dataKey="balanceHsa" stackId="balances" fill="#a855f7" name="HSA Balance" />}
                {visibleColumns.balanceIra && <Bar dataKey="balanceIra" stackId="balances" fill="#06b6d4" name="IRA Balance" />}
                {visibleColumns.balanceOther && <Bar dataKey="balanceOther" stackId="balances" fill="#ec4899" name="Other Balance" />}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-4">
        {/* Strategy Metrics Summary */}
        {projections.length > 0 && (() => {
          // Calculate metrics from projections
          const retirementProjections = projections.filter(p => {
            const age = p.age || 0
            return retirementAge !== null && age >= retirementAge
          })
          
          const finalProjection = projections[projections.length - 1]
          const initialProjection = projections[0]
          const finalNetworth = finalProjection?.networth || 0
          const initialNetworth = initialProjection?.networth || 0
          
          // Legacy Value: Final net worth at end of projection
          const legacyValue = finalNetworth
          
          // Total Tax: Sum of all taxes paid during retirement
          const totalTax = retirementProjections.reduce((sum, p) => sum + (p.tax || 0), 0)
          
          // Average Annual Tax
          const avgAnnualTax = retirementProjections.length > 0 ? totalTax / retirementProjections.length : 0
          
          // Find when networth goes to zero or negative
          const zeroNetworthYear = projections.findIndex(p => (p.networth || 0) <= 0)
          const finalAge = finalProjection?.age || 0
          const longevityBeyondLifeExpectancy = zeroNetworthYear >= 0 
            ? (projections[zeroNetworthYear]?.age || 0) - lifeExpectancy
            : finalAge - lifeExpectancy
          
          // Total withdrawals by account type
          const total401kWithdrawals = retirementProjections.reduce((sum, p) => sum + (p.distribution_401k || 0), 0)
          const totalRothWithdrawals = retirementProjections.reduce((sum, p) => sum + (p.distribution_roth || 0), 0)
          const totalTaxableWithdrawals = retirementProjections.reduce((sum, p) => sum + (p.distribution_taxable || 0), 0)
          const totalIraWithdrawals = retirementProjections.reduce((sum, p) => sum + (p.distribution_ira || 0), 0)
          const totalHsaWithdrawals = retirementProjections.reduce((sum, p) => sum + (p.distribution_hsa || 0), 0)
          
          // Total income during retirement
          const totalIncome = retirementProjections.reduce((sum, p) => sum + (p.total_income || 0), 0)
          
          // Tax efficiency: percentage of income that goes to taxes
          const taxEfficiency = totalIncome > 0 ? ((totalTax / totalIncome) * 100) : 0
          
          // Years with negative gap/excess
          // Only count as negative if gap_excess is significantly negative (more than -$1 to avoid rounding errors)
        const negativeYears = retirementProjections.filter(p => (p.gap_excess || 0) < -1).length
          const negativeYearsPercentage = retirementProjections.length > 0 ? (negativeYears / retirementProjections.length) * 100 : 0
          
          // Remaining balances for each account type
          const remaining401k = finalProjection?.balance_401k || 0
          const remainingRoth = finalProjection?.balance_roth || 0
          const remainingTaxable = finalProjection?.balance_investment || 0
          const remainingIra = finalProjection?.balance_ira || 0
          const remainingHsa = finalProjection?.balance_hsa || 0
          const remainingOther = finalProjection?.balance_other_investments || 0
          
          // Lifetime expenses
          const lifetimeExpenses = retirementProjections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
          
          return (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <button
                onClick={() => setStrategyModelerExpanded(!strategyModelerExpanded)}
                className="w-full flex items-center justify-between mb-4 text-left"
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  Withdrawal Strategy: {
                    modelingStrategyType === 'goal_based' ? (
                      modelingWithdrawalPriority === 'default' ? 'Default (Tax-Efficient)' :
                      modelingWithdrawalPriority === 'longevity' ? 'Longevity (Preserve Assets)' :
                      modelingWithdrawalPriority === 'legacy' ? 'Legacy Value (Maximize Inheritance)' :
                      modelingWithdrawalPriority === 'tax_optimization' ? 'Tax Optimization' :
                      modelingWithdrawalPriority === 'stable_income' ? 'Stable Income' :
                      modelingWithdrawalPriority === 'sequence_risk' ? 'Sequence of Returns Risk Mitigation' :
                      modelingWithdrawalPriority === 'liquidity' ? 'Liquidity (Easy Access)' :
                      'Default'
                    ) : modelingStrategyType === 'amount_based_4_percent' ? '4% Rule' :
                    modelingStrategyType === 'amount_based_fixed_percentage' ? `Fixed Percentage (${strategyParams.fixed_percentage_rate}%)` :
                    modelingStrategyType === 'amount_based_fixed_dollar' ? `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString()})` :
                    modelingStrategyType === 'amount_based_swp' ? 'Systematic Withdrawal Plan (Earnings Only)' :
                    modelingStrategyType === 'sequence_proportional' ? 'Proportional Withdrawals' :
                    modelingStrategyType === 'sequence_bracket_topping' ? `Bracket-Topping (${strategyParams.bracket_topping_threshold}% bracket)` :
                    modelingStrategyType === 'market_bucket' ? 'Bucket Strategy' :
                    modelingStrategyType === 'market_guardrails' ? `Guardrails (${strategyParams.guardrails_floor}%-${strategyParams.guardrails_ceiling}%)` :
                    modelingStrategyType === 'market_floor_upside' ? 'Floor-and-Upside' :
                    modelingStrategyType === 'tax_roth_conversion' ? 'Roth Conversion Bridge' :
                    modelingStrategyType === 'tax_qcd' ? 'Qualified Charitable Distributions (QCDs)' :
                    'Default'
                  }
                </h3>
                <span className="text-gray-500">{strategyModelerExpanded ? '▼' : '▶'}</span>
              </button>
              
              {/* Collapsible Strategy Modeler */}
              {strategyModelerExpanded && (
                <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <p className="mb-4 text-xs text-purple-700">
                    <strong>Model different strategies:</strong> Select a withdrawal strategy to see how it affects your projections. 
                    This is for illustration only and does not save to your scenario. The default strategy is used for saved projections.
                  </p>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-purple-900 mb-2">Strategy Type</label>
                    <select
                      value={modelingStrategyType}
                      onChange={(e) => {
                        setModelingStrategyType(e.target.value as any)
                        if (selectedScenarioId) {
                          calculateAndSaveProjections()
                        }
                      }}
                      className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <optgroup label="Goal-Based (Priority Selection)">
                        <option value="goal_based">Goal-Based Strategy</option>
                      </optgroup>
                      <optgroup label="Amount-Based Strategies">
                        <option value="amount_based_4_percent">4% Rule</option>
                        <option value="amount_based_fixed_percentage">Fixed Percentage</option>
                        <option value="amount_based_fixed_dollar">Fixed Dollar Amount</option>
                        <option value="amount_based_swp">Systematic Withdrawal Plan (Earnings Only)</option>
                      </optgroup>
                      <optgroup label="Sequence-Based Strategies">
                        <option value="sequence_proportional">Proportional Withdrawals</option>
                        <option value="sequence_bracket_topping">Bracket-Topping Strategy</option>
                      </optgroup>
                      <optgroup label="Market & Risk-Responsive">
                        <option value="market_bucket">Bucket Strategy</option>
                        <option value="market_guardrails">Guardrails Strategy (Guyton-Klinger)</option>
                        <option value="market_floor_upside">Floor-and-Upside Strategy</option>
                      </optgroup>
                      <optgroup label="Tax-Optimization Tactics">
                        <option value="tax_roth_conversion">Roth Conversion Bridge</option>
                        <option value="tax_qcd">Qualified Charitable Distributions (QCDs)</option>
                      </optgroup>
                    </select>
                    <p className="mt-1 text-xs text-purple-600">
                      {modelingStrategyType === 'goal_based' && 'Select goals/priorities to determine withdrawal order'}
                      {modelingStrategyType === 'amount_based_4_percent' && 'Withdraw 4% of portfolio in year 1, then adjust for inflation'}
                      {modelingStrategyType === 'amount_based_fixed_percentage' && 'Withdraw a fixed percentage of portfolio value each year'}
                      {modelingStrategyType === 'amount_based_fixed_dollar' && 'Withdraw a fixed dollar amount regardless of market performance'}
                      {modelingStrategyType === 'amount_based_swp' && 'Withdraw only investment earnings (dividends/interest), preserve principal'}
                      {modelingStrategyType === 'sequence_proportional' && 'Withdraw proportionally from all account types'}
                      {modelingStrategyType === 'sequence_bracket_topping' && 'Fill low tax bracket with tax-deferred, then use taxable/Roth'}
                      {modelingStrategyType === 'market_bucket' && 'Divide assets by time horizon: Cash (1-3y), Fixed Income (3-10y), Equities (10+y)'}
                      {modelingStrategyType === 'market_guardrails' && 'Set ceiling and floor for withdrawal rate based on market performance'}
                      {modelingStrategyType === 'market_floor_upside' && 'Use guaranteed income for essentials, portfolio for discretionary'}
                      {modelingStrategyType === 'tax_roth_conversion' && 'Convert Traditional IRA to Roth before RMD age to lower future distributions'}
                      {modelingStrategyType === 'tax_qcd' && 'Send IRA distributions directly to charity after age 70½ to satisfy RMDs tax-free'}
                    </p>
                  </div>

                  {/* Goal-Based Strategy Options (only show if goal_based selected) */}
                  {modelingStrategyType === 'goal_based' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">Primary Goal</label>
                        <select
                          value={modelingWithdrawalPriority}
                          onChange={(e) => {
                            setModelingWithdrawalPriority(e.target.value as any)
                            if (selectedScenarioId) {
                              calculateAndSaveProjections()
                            }
                          }}
                          className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="default">Default (Tax-Efficient)</option>
                          <option value="longevity">Longevity (Preserve Assets)</option>
                          <option value="legacy">Legacy Value (Maximize Inheritance)</option>
                          <option value="tax_optimization">Tax Optimization</option>
                          <option value="stable_income">Stable Income</option>
                          <option value="sequence_risk">Sequence of Returns Risk Mitigation</option>
                          <option value="liquidity">Liquidity (Easy Access)</option>
                        </select>
                        <p className="mt-1 text-xs text-purple-600">
                          {modelingWithdrawalPriority === 'default' && 'Balanced tax-efficient strategy (default)'}
                          {modelingWithdrawalPriority === 'longevity' && 'Prioritizes preserving assets for long retirement'}
                          {modelingWithdrawalPriority === 'legacy' && 'Maximizes inheritance value for heirs'}
                          {modelingWithdrawalPriority === 'tax_optimization' && 'Minimizes taxes over retirement'}
                          {modelingWithdrawalPriority === 'stable_income' && 'Maintains consistent income levels'}
                          {modelingWithdrawalPriority === 'sequence_risk' && 'Protects against early market downturns'}
                          {modelingWithdrawalPriority === 'liquidity' && 'Keeps funds easily accessible'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">Secondary Goal</label>
                        <select
                          value={modelingWithdrawalSecondary}
                          onChange={(e) => {
                            setModelingWithdrawalSecondary(e.target.value as any)
                            // Recalculation will be triggered by useEffect when state updates
                          }}
                          className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        >
                          <option value="tax_optimization">Tax Optimization</option>
                          <option value="longevity">Longevity</option>
                          <option value="legacy">Legacy Value</option>
                          <option value="stable_income">Stable Income</option>
                          <option value="sequence_risk">Sequence Risk Mitigation</option>
                          <option value="liquidity">Liquidity</option>
                          <option value="default">Default</option>
                        </select>
                        <p className="mt-1 text-xs text-purple-600">Used for tie-breaking when primary goal doesn't clearly determine the best choice</p>
                      </div>
                    </div>
                  )}

                  {/* Strategy-Specific Parameters */}
                  {modelingStrategyType === 'amount_based_fixed_percentage' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-purple-900 mb-2">Withdrawal Percentage (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={strategyParams.fixed_percentage_rate}
                        onChange={(e) => {
                          setStrategyParams({ ...strategyParams, fixed_percentage_rate: parseFloat(e.target.value) || 4 })
                          // Recalculation will be triggered by useEffect when state updates
                        }}
                        className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="mt-1 text-xs text-purple-600">Percentage of portfolio value to withdraw each year (e.g., 4 for 4%)</p>
                    </div>
                  )}

                  {modelingStrategyType === 'amount_based_fixed_dollar' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-purple-900 mb-2">Annual Withdrawal Amount ($)</label>
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={strategyParams.fixed_dollar_amount}
                        onChange={(e) => {
                          setStrategyParams({ ...strategyParams, fixed_dollar_amount: parseFloat(e.target.value) || 50000 })
                          // Recalculation will be triggered by useEffect when state updates
                        }}
                        className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="mt-1 text-xs text-purple-600">Fixed dollar amount to withdraw each year regardless of market performance</p>
                    </div>
                  )}

                  {modelingStrategyType === 'market_guardrails' && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">Ceiling (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="20"
                          value={strategyParams.guardrails_ceiling}
                          onChange={(e) => {
                            setStrategyParams({ ...strategyParams, guardrails_ceiling: parseFloat(e.target.value) || 6 })
                            // Recalculation will be triggered by useEffect when state updates
                          }}
                          className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                        />
                        <p className="mt-1 text-xs text-purple-600">Maximum withdrawal rate when market performs well</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">Floor (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="20"
                          value={strategyParams.guardrails_floor}
                          onChange={(e) => {
                            setStrategyParams({ ...strategyParams, guardrails_floor: parseFloat(e.target.value) || 3 })
                            // Recalculation will be triggered by useEffect when state updates
                          }}
                          className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                        />
                        <p className="mt-1 text-xs text-purple-600">Minimum withdrawal rate to protect principal</p>
                      </div>
                    </div>
                  )}

                  {modelingStrategyType === 'sequence_bracket_topping' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-purple-900 mb-2">Tax Bracket Threshold (%)</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="37"
                        value={strategyParams.bracket_topping_threshold}
                        onChange={(e) => {
                          setStrategyParams({ ...strategyParams, bracket_topping_threshold: parseFloat(e.target.value) || 12 })
                          // Recalculation will be triggered by useEffect when state updates
                        }}
                        className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="mt-1 text-xs text-purple-600">Fill this tax bracket with tax-deferred withdrawals, then use taxable/Roth</p>
                    </div>
                  )}

                  <div className="rounded-md border border-purple-200 bg-white p-3">
                    <p className="text-xs font-medium text-purple-900 mb-2">Current Modeling Strategy:</p>
                    <p className="text-sm text-purple-800">
                      <strong>Primary:</strong> {
                        modelingWithdrawalPriority === 'default' ? 'Default (Tax-Efficient)' :
                        modelingWithdrawalPriority === 'longevity' ? 'Longevity (Preserve Assets)' :
                        modelingWithdrawalPriority === 'legacy' ? 'Legacy Value (Maximize Inheritance)' :
                        modelingWithdrawalPriority === 'tax_optimization' ? 'Tax Optimization' :
                        modelingWithdrawalPriority === 'stable_income' ? 'Stable Income' :
                        modelingWithdrawalPriority === 'sequence_risk' ? 'Sequence of Returns Risk Mitigation' :
                        modelingWithdrawalPriority === 'liquidity' ? 'Liquidity (Easy Access)' :
                        'Default'
                      }
                      {modelingWithdrawalSecondary && modelingWithdrawalSecondary !== 'default' && (
                        <span className="ml-2">
                          • <strong>Secondary:</strong> {
                            modelingWithdrawalSecondary === 'tax_optimization' ? 'Tax Optimization' :
                            modelingWithdrawalSecondary === 'longevity' ? 'Longevity' :
                            modelingWithdrawalSecondary === 'legacy' ? 'Legacy Value' :
                            modelingWithdrawalSecondary === 'stable_income' ? 'Stable Income' :
                            modelingWithdrawalSecondary === 'sequence_risk' ? 'Sequence Risk Mitigation' :
                            modelingWithdrawalSecondary === 'liquidity' ? 'Liquidity' :
                            modelingWithdrawalSecondary
                          }
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-purple-600 mt-2">
                      The system dynamically evaluates your situation each year (account balances, age, years remaining, etc.) and adjusts the withdrawal order based on the selected strategy.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-1">Legacy Value</p>
                  <p className="text-lg font-semibold text-blue-900">
                    ${legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Final net worth</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs font-medium text-green-900 mb-1">Longevity</p>
                  <p className="text-lg font-semibold text-green-900">
                    {longevityBeyondLifeExpectancy > 0 ? `+${longevityBeyondLifeExpectancy.toFixed(1)}` : longevityBeyondLifeExpectancy.toFixed(1)} years
                  </p>
                  <p className="text-xs text-green-700 mt-1">Beyond life expectancy</p>
                </div>
                
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-xs font-medium text-red-900 mb-1">Total Tax</p>
                  <p className="text-lg font-semibold text-red-900">
                    ${totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-red-700 mt-1">Lifetime taxes paid</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs font-medium text-purple-900 mb-1">Avg Annual Tax</p>
                  <p className="text-lg font-semibold text-purple-900">
                    ${avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">Per year average</p>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                  <p className="text-xs font-medium text-yellow-900 mb-1">Tax Efficiency</p>
                  <p className="text-lg font-semibold text-yellow-900">
                    {taxEfficiency.toFixed(1)}%
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">Tax as % of income</p>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs font-medium text-orange-900 mb-1">Negative Years</p>
                  <p className="text-lg font-semibold text-orange-900">
                    {negativeYears} ({negativeYearsPercentage.toFixed(1)}%)
                  </p>
                  <p className="text-xs text-orange-700 mt-1">Years with shortfall</p>
                </div>
              </div>
              
              {/* Lifetime Income and Expenses */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                    <p className="text-xs font-medium text-indigo-900 mb-1">Lifetime Income</p>
                    <p className="text-lg font-semibold text-indigo-900">
                      ${totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">Total income during retirement</p>
                  </div>
                  
                  <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                    <p className="text-xs font-medium text-pink-900 mb-1">Lifetime Expenses</p>
                    <p className="text-lg font-semibold text-pink-900">
                      ${lifetimeExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-pink-700 mt-1">Total expenses during retirement</p>
                  </div>
                </div>
              </div>
              
              {/* Remaining Balances */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Remaining Account Balances:</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <span className="text-gray-600">401k:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remaining401k.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">IRA:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remainingIra.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Roth:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remainingRoth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Taxable:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remainingTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">HSA:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remainingHsa.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Other:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${remainingOther.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Withdrawal Breakdown */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Total Withdrawals by Account Type:</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-gray-600">401k:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${total401kWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">IRA:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${totalIraWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Roth:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${totalRothWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Taxable:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${totalTaxableWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">HSA:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      ${totalHsaWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

          {/* Show current strategy metrics in Strategy Modeling tab */}
          {projections.length > 0 && settings && (() => {
            const retirementProjections = projections.filter(p => {
              const age = p.age || 0
              return retirementAge !== null && age >= retirementAge
            })
            
            const finalProjection = projections[projections.length - 1]
            const legacyValue = finalProjection?.networth || 0
            const totalTax = retirementProjections.reduce((sum, p) => sum + (p.tax || 0), 0)
            const avgAnnualTax = retirementProjections.length > 0 ? totalTax / retirementProjections.length : 0
            const zeroNetworthYear = projections.findIndex(p => (p.networth || 0) <= 0)
            const finalAge = finalProjection?.age || 0
            const longevityBeyondLifeExpectancy = zeroNetworthYear >= 0 
              ? (projections[zeroNetworthYear]?.age || 0) - lifeExpectancy
              : finalAge - lifeExpectancy
            const totalIncome = retirementProjections.reduce((sum, p) => sum + (p.total_income || 0), 0)
            const lifetimeExpenses = retirementProjections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
            const taxEfficiency = totalIncome > 0 ? ((totalTax / totalIncome) * 100) : 0
            const negativeYears = retirementProjections.filter(p => (p.gap_excess || 0) < -1).length
            const negativeYearsPercentage = retirementProjections.length > 0 ? (negativeYears / retirementProjections.length) * 100 : 0

            return (
              <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">
                  Current Strategy Metrics: {
                    modelingStrategyType === 'goal_based' ? (
                      modelingWithdrawalPriority === 'default' ? 'Default (Tax-Efficient)' :
                      modelingWithdrawalPriority === 'longevity' ? 'Longevity (Preserve Assets)' :
                      modelingWithdrawalPriority === 'legacy' ? 'Legacy Value (Maximize Inheritance)' :
                      modelingWithdrawalPriority === 'tax_optimization' ? 'Tax Optimization' :
                      modelingWithdrawalPriority === 'stable_income' ? 'Stable Income' :
                      modelingWithdrawalPriority === 'sequence_risk' ? 'Sequence of Returns Risk Mitigation' :
                      modelingWithdrawalPriority === 'liquidity' ? 'Liquidity (Easy Access)' :
                      'Default'
                    ) : modelingStrategyType === 'amount_based_4_percent' ? '4% Rule' :
                    modelingStrategyType === 'amount_based_fixed_percentage' ? `Fixed Percentage (${strategyParams.fixed_percentage_rate}%)` :
                    modelingStrategyType === 'amount_based_fixed_dollar' ? `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString()})` :
                    modelingStrategyType === 'amount_based_swp' ? 'Systematic Withdrawal Plan (Earnings Only)' :
                    modelingStrategyType === 'sequence_proportional' ? 'Proportional Withdrawals' :
                    modelingStrategyType === 'sequence_bracket_topping' ? `Bracket-Topping (${strategyParams.bracket_topping_threshold}% bracket)` :
                    modelingStrategyType === 'market_bucket' ? 'Bucket Strategy' :
                    modelingStrategyType === 'market_guardrails' ? `Guardrails (${strategyParams.guardrails_floor}%-${strategyParams.guardrails_ceiling}%)` :
                    modelingStrategyType === 'market_floor_upside' ? 'Floor-and-Upside' :
                    modelingStrategyType === 'tax_roth_conversion' ? 'Roth Conversion Bridge' :
                    modelingStrategyType === 'tax_qcd' ? 'Qualified Charitable Distributions (QCDs)' :
                    'Default'
                  }
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-1">Legacy Value</p>
                    <p className="text-lg font-semibold text-blue-900">
                      ${legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <p className="text-xs font-medium text-green-900 mb-1">Longevity</p>
                    <p className="text-lg font-semibold text-green-900">
                      {longevityBeyondLifeExpectancy > 0 ? `+${longevityBeyondLifeExpectancy.toFixed(1)}` : longevityBeyondLifeExpectancy.toFixed(1)} years
                    </p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <p className="text-xs font-medium text-red-900 mb-1">Total Tax</p>
                    <p className="text-lg font-semibold text-red-900">
                      ${totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs font-medium text-purple-900 mb-1">Avg Annual Tax</p>
                    <p className="text-lg font-semibold text-purple-900">
                      ${avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <p className="text-xs font-medium text-yellow-900 mb-1">Tax Efficiency</p>
                    <p className="text-lg font-semibold text-yellow-900">
                      {taxEfficiency.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <p className="text-xs font-medium text-orange-900 mb-1">Negative Years</p>
                    <p className="text-lg font-semibold text-orange-900">
                      {negativeYears} ({negativeYearsPercentage.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Controls - Moved below metrics */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showPreRetirement}
              onChange={(e) => setShowPreRetirement(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Pre-Retirement Years</span>
          </label>
          <div className="relative">
            <button
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={(e) => {
                const menu = e.currentTarget.nextElementSibling as HTMLElement
                menu?.classList.toggle('hidden')
              }}
            >
              Show/Hide Columns
            </button>
            <div className="absolute right-0 mt-1 hidden w-64 rounded-md border border-gray-200 bg-white shadow-lg z-20 max-h-96 overflow-y-auto">
              <div className="p-2">
                <div className="mb-2 border-b pb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={Object.values(visibleColumns).every(v => v)}
                      onChange={(e) => {
                        const allVisible = e.target.checked
                        setVisibleColumns({
                          year: allVisible,
                          age: allVisible,
                          event: allVisible,
                          ssa: allVisible,
                          dist401k: allVisible,
                          distRoth: allVisible,
                          distTaxable: allVisible,
                          distHsa: allVisible,
                          distIra: allVisible,
                          distOther: allVisible,
                          otherIncome: allVisible,
                          totalIncome: allVisible,
                          tax: allVisible,
                          expenses: allVisible,
                          gapExcess: allVisible,
                          networth: allVisible,
                          balance401k: allVisible,
                          balanceRoth: allVisible,
                          balanceTaxable: allVisible,
                          balanceHsa: allVisible,
                          balanceIra: allVisible,
                          balanceOther: allVisible,
                        })
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span>Select All</span>
                  </label>
                </div>
                <div className="mb-2 border-b pb-2 space-y-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={incomeGroupExpanded}
                      onChange={(e) => {
                        const expanded = e.target.checked
                        setIncomeGroupExpanded(expanded)
                        if (expanded) {
                          setVisibleColumns({
                            ...visibleColumns,
                            ssa: visibleColumns.ssa || true,
                            dist401k: visibleColumns.dist401k || true,
                            distRoth: visibleColumns.distRoth || true,
                            distTaxable: visibleColumns.distTaxable || true,
                            distHsa: visibleColumns.distHsa || true,
                            distIra: visibleColumns.distIra || true,
                            distOther: visibleColumns.distOther || true,
                            otherIncome: visibleColumns.otherIncome || true,
                          })
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span>Expand Income Group</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      checked={balanceGroupExpanded}
                      onChange={(e) => {
                        const expanded = e.target.checked
                        setBalanceGroupExpanded(expanded)
                        if (expanded) {
                          setVisibleColumns({
                            ...visibleColumns,
                            balance401k: visibleColumns.balance401k || true,
                            balanceRoth: visibleColumns.balanceRoth || true,
                            balanceTaxable: visibleColumns.balanceTaxable || true,
                            balanceHsa: visibleColumns.balanceHsa || true,
                            balanceIra: visibleColumns.balanceIra || true,
                            balanceOther: visibleColumns.balanceOther || true,
                          })
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span>Expand Balance Group</span>
                  </label>
                </div>
                <div className="space-y-1">
                  {Object.entries(visibleColumns).map(([key, value]) => {
                    const isIncomeColumn = ['ssa', 'dist401k', 'distRoth', 'distTaxable', 'distHsa', 'distIra', 'distOther', 'otherIncome'].includes(key)
                    const isBalanceColumn = ['balance401k', 'balanceRoth', 'balanceTaxable', 'balanceHsa', 'balanceIra', 'balanceOther'].includes(key)
                    const shouldShow = key === 'event' || !((isIncomeColumn && !incomeGroupExpanded) || (isBalanceColumn && !balanceGroupExpanded))
                    
                    return (
                      <label key={key} className={`flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 px-2 py-1 rounded ${!shouldShow ? 'opacity-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={value}
                          disabled={!shouldShow}
                          onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 border border-gray-300 rounded-md">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm rounded-l-md ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 text-sm rounded-r-md ${
                viewMode === 'graph'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Graph
            </button>
          </div>
          {viewMode === 'graph' && (
            <div className="flex items-center space-x-2 border border-gray-300 rounded-md">
              <button
                onClick={() => setGraphType('line')}
                className={`px-3 py-1 text-sm rounded-l-md ${
                  graphType === 'line'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Line
              </button>
              <button
                onClick={() => setGraphType('area')}
                className={`px-3 py-1 text-sm ${
                  graphType === 'area'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Area
              </button>
              <button
                onClick={() => setGraphType('bar')}
                className={`px-3 py-1 text-sm rounded-r-md ${
                  graphType === 'bar'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Bar
              </button>
            </div>
          )}
          </div>
          
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {visibleColumns.year && <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Year</th>}
                    {visibleColumns.age && <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Age</th>}
                    {visibleColumns.event && <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Event</th>}
                    
                    {/* Individual Income Columns (shown when expanded) */}
                    {incomeGroupExpanded && visibleColumns.ssa && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">SSA</th>}
                    {incomeGroupExpanded && visibleColumns.dist401k && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">401k Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distRoth && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Roth Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distTaxable && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxable Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distHsa && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">HSA Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distIra && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">IRA Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distOther && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Other Dist</th>}
                    {incomeGroupExpanded && visibleColumns.otherIncome && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Other Income</th>}
                    
                    {/* Total Income - Clickable to expand/collapse income columns */}
                    {visibleColumns.totalIncome && (
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase bg-blue-50 cursor-pointer hover:bg-blue-100"
                        onClick={() => {
                          setIncomeGroupExpanded(!incomeGroupExpanded)
                          if (!incomeGroupExpanded) {
                            // When expanding, enable all income columns
                            setVisibleColumns({
                              ...visibleColumns,
                              ssa: true,
                              dist401k: true,
                              distRoth: true,
                              distTaxable: true,
                              distHsa: true,
                              distIra: true,
                              distOther: true,
                              otherIncome: true,
                            })
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <span>Total Income</span>
                          <span className="text-gray-600">{incomeGroupExpanded ? '▼' : '▶'}</span>
                        </div>
                      </th>
                    )}
                    
                    {visibleColumns.tax && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>}
                    {visibleColumns.expenses && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>}
                    {visibleColumns.gapExcess && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Gap/Excess</th>}
                    
                    {/* Networth - Clickable to expand/collapse balance columns */}
                    {visibleColumns.networth && (
                      <th 
                        className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setBalanceGroupExpanded(!balanceGroupExpanded)
                          if (!balanceGroupExpanded) {
                            // When expanding, enable all balance columns
                            setVisibleColumns({
                              ...visibleColumns,
                              balance401k: true,
                              balanceRoth: true,
                              balanceTaxable: true,
                              balanceHsa: true,
                              balanceIra: true,
                              balanceOther: true,
                            })
                          }
                        }}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <span>Networth</span>
                          <span className="text-gray-600">{balanceGroupExpanded ? '▼' : '▶'}</span>
                        </div>
                      </th>
                    )}
                    
                    {/* Individual Balance Columns (shown when expanded, to the right of Networth) */}
                    {balanceGroupExpanded && visibleColumns.balance401k && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">401k Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceRoth && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Roth Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceTaxable && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Taxable Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceHsa && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">HSA Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceIra && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">IRA Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceOther && <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase">Other Bal</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredProjections.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-4 py-8 text-center text-gray-500">
                        {projections.length === 0 
                          ? 'No projections yet. Configure your calculator settings, accounts, expenses, and income sources, then generate projections.'
                          : 'No projections match the current filter. Try enabling "Show Pre-Retirement Years".'}
                      </td>
                    </tr>
                  ) : (
                    <TooltipProvider>
                      {filteredProjections.map((proj, index) => {
                  const isRetired = retirementAge !== null && (proj.age || 0) >= retirementAge
                  const originalIndex = projections.findIndex(p => p.year === proj.year && p.age === proj.age)
                  const prevProj = originalIndex > 0 ? projections[originalIndex - 1] : null
                  
                  // Check if SSA is being collected (even before retirement)
                  const hasSsaIncome = (proj.ssa_income || 0) > 0
                  const showIncome = isRetired || hasSsaIncome // Show income if retired OR if SSA is being collected
                  
                  // Calculate YoY change percentages
                  const calculateYoYChange = (current: number, previous: number | null): number | null => {
                    if (previous === null || previous === 0) return null
                    return ((current - previous) / previous) * 100
                  }
                  
                  const ssaIncome = proj.ssa_income || 0
                  const dist401k = proj.distribution_401k || 0
                  const distRoth = proj.distribution_roth || 0
                  const distTaxable = proj.distribution_taxable || 0
                  const distHsa = proj.distribution_hsa || 0
                  const distIra = proj.distribution_ira || 0
                  const distOther = proj.distribution_other || 0
                  const otherIncome = proj.other_recurring_income || 0
                  const totalIncome = proj.total_income || 0
                  
                  // Verify total income calculation (should match: ssaIncome + all distributions + otherIncome)
                  const calculatedTotal = ssaIncome + dist401k + distRoth + distTaxable + distHsa + distIra + distOther + otherIncome
                  const totalIncomeMatch = Math.abs(totalIncome - calculatedTotal) < 0.01
                  
                  const ssaYoY = calculateYoYChange(ssaIncome, prevProj?.ssa_income || null)
                  const dist401kYoY = calculateYoYChange(dist401k, prevProj?.distribution_401k || null)
                  const distRothYoY = calculateYoYChange(distRoth, prevProj?.distribution_roth || null)
                  const distTaxableYoY = calculateYoYChange(distTaxable, prevProj?.distribution_taxable || null)
                  const distHsaYoY = calculateYoYChange(distHsa, prevProj?.distribution_hsa || null)
                  const distIraYoY = calculateYoYChange(distIra, prevProj?.distribution_ira || null)
                  const distOtherYoY = calculateYoYChange(distOther, prevProj?.distribution_other || null)
                  const otherIncomeYoY = calculateYoYChange(otherIncome, prevProj?.other_recurring_income || null)
                  const totalIncomeYoY = calculateYoYChange(totalIncome, prevProj?.total_income || null)
                  
                  // Calculate YoY changes for account balances
                  const balance401kYoY = calculateYoYChange(proj.balance_401k || 0, prevProj?.balance_401k || null)
                  const balanceRothYoY = calculateYoYChange(proj.balance_roth || 0, prevProj?.balance_roth || null)
                  const balanceInvestmentYoY = calculateYoYChange(proj.balance_investment || 0, prevProj?.balance_investment || null)
                  const balanceHsaYoY = calculateYoYChange(proj.balance_hsa || 0, prevProj?.balance_hsa || null)
                  const balanceIraYoY = calculateYoYChange(proj.balance_ira || 0, prevProj?.balance_ira || null)
                  const balanceOtherYoY = calculateYoYChange(proj.balance_other_investments || 0, prevProj?.balance_other_investments || null)
                  const networthYoY = calculateYoYChange(proj.networth || 0, prevProj?.networth || null)
                  
                  // Calculate balance changes for tooltips
                  const calculateBalanceChange = (current: number, previous: number | null, distribution: number, accountType: string) => {
                    if (previous === null) return null
                    const change = current - previous
                    const growthRate = isRetired 
                      ? (settings?.growth_rate_during_retirement || 0.05)
                      : (settings?.growth_rate_before_retirement || 0.1)
                    
                    // Growth: previous balance * growth rate (applied first)
                    const balanceAfterGrowth = previous * (1 + growthRate)
                    const estimatedGrowth = balanceAfterGrowth - previous
                    
                    // Withdrawals are negative (distributions reduce balance)
                    const withdrawals = -distribution
                    
                    // Contributions (only before retirement)
                    // Calculate as: change - growth - withdrawals
                    // This accounts for the fact that growth is applied first, then contributions, then withdrawals
                    let contributions = 0
                    if (!isRetired) {
                      // After growth: balanceAfterGrowth
                      // After contributions: balanceAfterGrowth + contributions = current + withdrawals
                      // So: contributions = current + withdrawals - balanceAfterGrowth
                      contributions = current + distribution - balanceAfterGrowth
                      if (contributions < 0) contributions = 0 // Can't have negative contributions
                    }
                    
                    // Surplus additions (for taxable account after debt cleared)
                    // Check if gap_excess was positive and debt was cleared, indicating surplus was added
                    // Surplus is added when: gapExcess > 0 AND debtBalance <= 0 (both current and previous)
                    // This applies both before and after retirement
                    const surplusAddition = accountType === 'Taxable' && 
                      (proj.gap_excess || 0) > 0 && 
                      (proj.debt_balance || 0) <= 0 &&
                      (prevProj?.debt_balance || 0) <= 0
                        ? Math.max(0, change - estimatedGrowth + distribution - (contributions || 0))
                        : 0
                    
                    return {
                      change,
                      growth: estimatedGrowth,
                      withdrawals,
                      contributions,
                      surplusAddition
                    }
                  }
                  
                  const balance401kChange = calculateBalanceChange(
                    proj.balance_401k || 0,
                    prevProj?.balance_401k || null,
                    dist401k,
                    '401k'
                  )
                  const balanceRothChange = calculateBalanceChange(
                    proj.balance_roth || 0,
                    prevProj?.balance_roth || null,
                    distRoth,
                    'Roth'
                  )
                  const balanceInvestmentChange = calculateBalanceChange(
                    proj.balance_investment || 0,
                    prevProj?.balance_investment || null,
                    distTaxable,
                    'Taxable'
                  )
                  const balanceHsaChange = calculateBalanceChange(
                    proj.balance_hsa || 0,
                    prevProj?.balance_hsa || null,
                    distHsa,
                    'HSA'
                  )
                  const balanceIraChange = calculateBalanceChange(
                    proj.balance_ira || 0,
                    prevProj?.balance_ira || null,
                    distIra,
                    'IRA'
                  )
                  const balanceOtherChange = calculateBalanceChange(
                    proj.balance_other_investments || 0,
                    prevProj?.balance_other_investments || null,
                    distOther,
                    'Other'
                  )
                  
                  // Calculate networth change breakdown
                  const calculateNetworthChange = () => {
                    if (!prevProj) return null
                    const change = (proj.networth || 0) - (prevProj.networth || 0)
                    const totalAssetsChange = 
                      ((proj.balance_401k || 0) - (prevProj.balance_401k || 0)) +
                      ((proj.balance_roth || 0) - (prevProj.balance_roth || 0)) +
                      ((proj.balance_investment || 0) - (prevProj.balance_investment || 0)) +
                      ((proj.balance_hsa || 0) - (prevProj.balance_hsa || 0)) +
                      ((proj.balance_ira || 0) - (prevProj.balance_ira || 0)) +
                      ((proj.balance_other_investments || 0) - (prevProj.balance_other_investments || 0))
                    const debtChange = ((proj.debt_balance || 0) - (prevProj.debt_balance || 0))
                    
                    return {
                      change,
                      assetsChange: totalAssetsChange,
                      debtChange: -debtChange, // Negative debt change increases networth
                      netChange: totalAssetsChange - debtChange
                    }
                  }
                  
                  const networthChange = calculateNetworthChange()
                  
                  return (
                  <tr key={proj.id || `${proj.year}-${proj.age}`}>
                    {visibleColumns.year && <td className="px-2 py-2 text-sm">{proj.year}</td>}
                    {visibleColumns.age && <td className="px-2 py-2 text-sm">{proj.age || '-'}</td>}
                    {visibleColumns.event && <td className="px-2 py-2 text-sm">{proj.event || '-'}</td>}
                    
                    {/* Individual Income Columns (shown when expanded) */}
                    {incomeGroupExpanded && visibleColumns.ssa && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {showIncome && ssaIncome > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${ssaIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {ssaYoY !== null && (
                                <div className={`text-xs ${ssaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {ssaYoY >= 0 ? '+' : ''}{ssaYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Social Security Income (Combined)</p>
                            <p className="text-xs text-gray-400">Includes primary and spouse SSA income</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                            {!isRetired && (
                              <p className="text-xs text-blue-400 mt-1">⚠ Collected before retirement</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.dist401k && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${dist401k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {dist401kYoY !== null && (
                                <div className={`text-xs ${dist401kYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {dist401kYoY >= 0 ? '+' : ''}{dist401kYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>401(k) Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.distRoth && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distRoth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distRothYoY !== null && (
                                <div className={`text-xs ${distRothYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distRothYoY >= 0 ? '+' : ''}{distRothYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Roth IRA Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.distTaxable && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distTaxableYoY !== null && (
                                <div className={`text-xs ${distTaxableYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distTaxableYoY >= 0 ? '+' : ''}{distTaxableYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Taxable Account Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.distHsa && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distHsa.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distHsaYoY !== null && (
                                <div className={`text-xs ${distHsaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distHsaYoY >= 0 ? '+' : ''}{distHsaYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>HSA Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.distIra && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distIra.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distIraYoY !== null && (
                                <div className={`text-xs ${distIraYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distIraYoY >= 0 ? '+' : ''}{distIraYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>IRA Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.distOther && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distOther.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distOtherYoY !== null && (
                                <div className={`text-xs ${distOtherYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distOtherYoY >= 0 ? '+' : ''}{distOtherYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Other Account Distribution</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {incomeGroupExpanded && visibleColumns.otherIncome && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${otherIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {otherIncomeYoY !== null && (
                                <div className={`text-xs ${otherIncomeYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {otherIncomeYoY >= 0 ? '+' : ''}{otherIncomeYoY.toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Other Recurring Income</p>
                            <p className="text-xs text-gray-400">Part of total income</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {visibleColumns.totalIncome && <td className="px-2 py-2 text-sm text-right font-semibold bg-blue-50">
                      {showIncome ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {totalIncomeYoY !== null && (
                                <div className={`text-xs ${totalIncomeYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {totalIncomeYoY >= 0 ? '+' : ''}{totalIncomeYoY.toFixed(1)}%
                                </div>
                              )}
                              {!totalIncomeMatch && (
                                <div className="text-xs text-orange-600">⚠</div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total Income Breakdown</p>
                            <p className="text-xs">SSA (Primary + Spouse): ${ssaIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">401k Distribution: ${dist401k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">Roth Distribution: ${distRoth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">Taxable Distribution: ${distTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">HSA Distribution: ${distHsa.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">IRA Distribution: ${distIra.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">Other Distribution: ${distOther.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">Other Recurring Income: ${otherIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs font-semibold mt-1">Sum: ${calculatedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            {!totalIncomeMatch && (
                              <p className="text-xs text-orange-600 mt-1">⚠ Calculation mismatch detected</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {visibleColumns.tax && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${(proj.tax || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold mb-2">Tax Calculation</p>
                            <p className="text-xs font-medium">Taxable Income Components:</p>
                            <p className="text-xs">- 401k Distribution: ${(proj.distribution_401k || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">- IRA Distribution: ${(proj.distribution_ira || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">- Taxable Distribution: ${(proj.distribution_taxable || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs">- Other Income: ${(proj.other_recurring_income || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs font-medium mt-2">Tax Calculations:</p>
                            <p className="text-xs">Capital Gains Tax: ${((proj.distribution_taxable || 0) * (settings?.capital_gains_tax_rate || 0.2)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-gray-400">(${(proj.distribution_taxable || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} × {((settings?.capital_gains_tax_rate || 0.2) * 100).toFixed(1)}%)</p>
                            <p className="text-xs">Income Tax: ${(((proj.distribution_401k || 0) + (proj.distribution_ira || 0) + (proj.other_recurring_income || 0)) * (settings?.income_tax_rate_retirement || 0.25)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-xs text-gray-400">(${((proj.distribution_401k || 0) + (proj.distribution_ira || 0) + (proj.other_recurring_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} × {((settings?.income_tax_rate_retirement || 0.25) * 100).toFixed(1)}%)</p>
                            <p className="text-xs font-semibold mt-2">Total Tax: ${(proj.tax || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {visibleColumns.expenses && <td className="px-2 py-2 text-sm text-right">
                      {isRetired ? `$${(proj.total_expenses || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </td>}
                    {visibleColumns.gapExcess && <td className={`px-2 py-2 text-sm text-right font-semibold ${
                      showIncome ? ((proj.gap_excess || 0) >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-400'
                    }`}>
                      {showIncome ? `$${(proj.gap_excess || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </td>}
                    {visibleColumns.networth && <td className="px-2 py-2 text-sm text-right font-semibold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.networth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {networthYoY !== null && (
                              <div className={`text-xs ${networthYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {networthYoY >= 0 ? '+' : ''}{networthYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">Networth Change Breakdown</p>
                          {networthChange ? (
                            <>
                              <p className="text-xs">Previous Networth: ${(prevProj?.networth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Total Assets Change: ${networthChange.assetsChange >= 0 ? '+' : ''}${networthChange.assetsChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- 401k: ${((proj.balance_401k || 0) - (prevProj?.balance_401k || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- Roth: ${((proj.balance_roth || 0) - (prevProj?.balance_roth || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- Taxable: ${((proj.balance_investment || 0) - (prevProj?.balance_investment || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- HSA: ${((proj.balance_hsa || 0) - (prevProj?.balance_hsa || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- IRA: ${((proj.balance_ira || 0) - (prevProj?.balance_ira || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs">- Other: ${((proj.balance_other_investments || 0) - (prevProj?.balance_other_investments || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              {(proj.debt_balance || 0) !== 0 && (
                                <p className="text-xs">Debt Change: ${networthChange.debtChange >= 0 ? '+' : ''}${networthChange.debtChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${networthChange.change >= 0 ? '+' : ''}${networthChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balance401k && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_401k || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balance401kYoY !== null && (
                              <div className={`text-xs ${balance401kYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balance401kYoY >= 0 ? '+' : ''}{balance401kYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">401k Balance Change</p>
                          {balance401kChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_401k || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balance401kChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balance401kChange.growth / (prevProj?.balance_401k || 1)) * 100).toFixed(1)}%)</p>
                              {balance401kChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balance401kChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balance401kChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balance401kChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balance401kChange.withdrawals / (prevProj?.balance_401k || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balance401kChange.change >= 0 ? '+' : ''}${balance401kChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceRoth && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_roth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceRothYoY !== null && (
                              <div className={`text-xs ${balanceRothYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceRothYoY >= 0 ? '+' : ''}{balanceRothYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">Roth Balance Change</p>
                          {balanceRothChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_roth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balanceRothChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceRothChange.growth / (prevProj?.balance_roth || 1)) * 100).toFixed(1)}%)</p>
                              {balanceRothChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceRothChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceRothChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceRothChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceRothChange.withdrawals / (prevProj?.balance_roth || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceRothChange.change >= 0 ? '+' : ''}${balanceRothChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceTaxable && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_investment || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceInvestmentYoY !== null && (
                              <div className={`text-xs ${balanceInvestmentYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceInvestmentYoY >= 0 ? '+' : ''}{balanceInvestmentYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">Taxable Balance Change</p>
                          {balanceInvestmentChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_investment || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balanceInvestmentChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceInvestmentChange.growth / (prevProj?.balance_investment || 1)) * 100).toFixed(1)}%)</p>
                              {balanceInvestmentChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceInvestmentChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceInvestmentChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceInvestmentChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceInvestmentChange.withdrawals / (prevProj?.balance_investment || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              {balanceInvestmentChange.surplusAddition > 0 && (
                                <p className="text-xs text-green-600">Surplus Addition: +${balanceInvestmentChange.surplusAddition.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceInvestmentChange.change >= 0 ? '+' : ''}${balanceInvestmentChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceHsa && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_hsa || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceHsaYoY !== null && (
                              <div className={`text-xs ${balanceHsaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceHsaYoY >= 0 ? '+' : ''}{balanceHsaYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">HSA Balance Change</p>
                          {balanceHsaChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_hsa || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balanceHsaChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceHsaChange.growth / (prevProj?.balance_hsa || 1)) * 100).toFixed(1)}%)</p>
                              {balanceHsaChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceHsaChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceHsaChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceHsaChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceHsaChange.withdrawals / (prevProj?.balance_hsa || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceHsaChange.change >= 0 ? '+' : ''}${balanceHsaChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceIra && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_ira || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceIraYoY !== null && (
                              <div className={`text-xs ${balanceIraYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceIraYoY >= 0 ? '+' : ''}{balanceIraYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">IRA Balance Change</p>
                          {balanceIraChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_ira || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balanceIraChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceIraChange.growth / (prevProj?.balance_ira || 1)) * 100).toFixed(1)}%)</p>
                              {balanceIraChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceIraChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceIraChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceIraChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceIraChange.withdrawals / (prevProj?.balance_ira || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceIraChange.change >= 0 ? '+' : ''}${balanceIraChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceOther && <td className="px-2 py-2 text-sm text-right text-gray-600">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_other_investments || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceOtherYoY !== null && (
                              <div className={`text-xs ${balanceOtherYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceOtherYoY >= 0 ? '+' : ''}{balanceOtherYoY.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold mb-2">Other Balance Change</p>
                          {balanceOtherChange ? (
                            <>
                              <p className="text-xs">Previous: ${(prevProj?.balance_other_investments || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              <p className="text-xs font-medium mt-2">Changes:</p>
                              <p className="text-xs">Growth: +${balanceOtherChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceOtherChange.growth / (prevProj?.balance_other_investments || 1)) * 100).toFixed(1)}%)</p>
                              {balanceOtherChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceOtherChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceOtherChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceOtherChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceOtherChange.withdrawals / (prevProj?.balance_other_investments || 1)) * 100).toFixed(1)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceOtherChange.change >= 0 ? '+' : ''}${balanceOtherChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                  </tr>
                  )
                })}
              </TooltipProvider>
            )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </div>
      )}

      {/* Strategy Modeling Sub-tab */}
      {activeSubTab === 'strategy-modeling' && (
        <div>
          {/* Strategy Modeler UI */}
          <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="mb-4 text-xs text-purple-700">
              <strong>Model different strategies:</strong> Select a withdrawal strategy to see how it affects your projections.
              This is for illustration only and does not save to your scenario. The default strategy is used for saved projections.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-purple-900 mb-2">Strategy Type</label>
              <select
                value={modelingStrategyType}
                onChange={(e) => {
                  setModelingStrategyType(e.target.value as any)
                  if (selectedScenarioId) {
                    calculateAndSaveProjections()
                  }
                }}
                className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <optgroup label="Goal-Based (Priority Selection)">
                  <option value="goal_based">Goal-Based Strategy</option>
                </optgroup>
                <optgroup label="Amount-Based Strategies">
                  <option value="amount_based_4_percent">4% Rule</option>
                  <option value="amount_based_fixed_percentage">Fixed Percentage</option>
                  <option value="amount_based_fixed_dollar">Fixed Dollar Amount</option>
                  <option value="amount_based_swp">Systematic Withdrawal Plan (Earnings Only)</option>
                </optgroup>
                <optgroup label="Sequence-Based Strategies">
                  <option value="sequence_proportional">Proportional Withdrawals</option>
                  <option value="sequence_bracket_topping">Bracket-Topping Strategy</option>
                </optgroup>
                <optgroup label="Market & Risk-Responsive">
                  <option value="market_bucket">Bucket Strategy</option>
                  <option value="market_guardrails">Guardrails Strategy (Guyton-Klinger)</option>
                  <option value="market_floor_upside">Floor-and-Upside Strategy</option>
                </optgroup>
                <optgroup label="Tax-Optimization Tactics">
                  <option value="tax_roth_conversion">Roth Conversion Bridge</option>
                  <option value="tax_qcd">Qualified Charitable Distributions (QCDs)</option>
                </optgroup>
              </select>
              <p className="mt-1 text-xs text-purple-600">
                {modelingStrategyType === 'goal_based' && 'Select goals/priorities to determine withdrawal order'}
                {modelingStrategyType === 'amount_based_4_percent' && 'Withdraw 4% of portfolio in year 1, then adjust for inflation'}
                {modelingStrategyType === 'amount_based_fixed_percentage' && 'Withdraw a fixed percentage of portfolio value each year'}
                {modelingStrategyType === 'amount_based_fixed_dollar' && 'Withdraw a fixed dollar amount regardless of market performance'}
                {modelingStrategyType === 'amount_based_swp' && 'Withdraw only investment earnings (dividends/interest), preserve principal'}
                {modelingStrategyType === 'sequence_proportional' && 'Withdraw proportionally from all account types'}
                {modelingStrategyType === 'sequence_bracket_topping' && 'Fill low tax bracket with tax-deferred, then use taxable/Roth'}
                {modelingStrategyType === 'market_bucket' && 'Divide assets by time horizon: Cash (1-3y), Fixed Income (3-10y), Equities (10+y)'}
                {modelingStrategyType === 'market_guardrails' && 'Set ceiling and floor for withdrawal rate based on market performance'}
                {modelingStrategyType === 'market_floor_upside' && 'Use guaranteed income for essentials, portfolio for discretionary'}
                {modelingStrategyType === 'tax_roth_conversion' && 'Convert Traditional IRA to Roth before RMD age to lower future distributions'}
                {modelingStrategyType === 'tax_qcd' && 'Send IRA distributions directly to charity after age 70½ to satisfy RMDs tax-free'}
              </p>
            </div>

            {/* Goal-Based Strategy Options (only show if goal_based selected) */}
            {modelingStrategyType === 'goal_based' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">Primary Goal</label>
                  <select
                    value={modelingWithdrawalPriority}
                    onChange={(e) => {
                      setModelingWithdrawalPriority(e.target.value as any)
                      if (selectedScenarioId) {
                        calculateAndSaveProjections()
                      }
                    }}
                    className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="default">Default (Tax-Efficient)</option>
                    <option value="longevity">Longevity (Preserve Assets)</option>
                    <option value="legacy">Legacy Value (Maximize Inheritance)</option>
                    <option value="tax_optimization">Tax Optimization</option>
                    <option value="stable_income">Stable Income</option>
                    <option value="sequence_risk">Sequence of Returns Risk Mitigation</option>
                    <option value="liquidity">Liquidity (Easy Access)</option>
                  </select>
                  <p className="mt-1 text-xs text-purple-600">
                    {modelingWithdrawalPriority === 'default' && 'Balanced tax-efficient strategy (default)'}
                    {modelingWithdrawalPriority === 'longevity' && 'Prioritizes preserving assets for long retirement'}
                    {modelingWithdrawalPriority === 'legacy' && 'Maximizes inheritance value for heirs'}
                    {modelingWithdrawalPriority === 'tax_optimization' && 'Minimizes taxes over retirement'}
                    {modelingWithdrawalPriority === 'stable_income' && 'Maintains consistent income levels'}
                    {modelingWithdrawalPriority === 'sequence_risk' && 'Protects against early market downturns'}
                    {modelingWithdrawalPriority === 'liquidity' && 'Keeps funds easily accessible'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">Secondary Goal</label>
                  <select
                    value={modelingWithdrawalSecondary}
                    onChange={(e) => {
                      setModelingWithdrawalSecondary(e.target.value as any)
                    }}
                    className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="tax_optimization">Tax Optimization</option>
                    <option value="longevity">Longevity</option>
                    <option value="legacy">Legacy Value</option>
                    <option value="stable_income">Stable Income</option>
                    <option value="sequence_risk">Sequence Risk Mitigation</option>
                    <option value="liquidity">Liquidity</option>
                    <option value="default">Default</option>
                  </select>
                  <p className="mt-1 text-xs text-purple-600">Used for tie-breaking when primary goal doesn't clearly determine the best choice</p>
                </div>
              </div>
            )}

            {/* Strategy-Specific Parameters */}
            {modelingStrategyType === 'amount_based_fixed_percentage' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">Withdrawal Percentage (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={strategyParams.fixed_percentage_rate}
                  onChange={(e) => {
                    setStrategyParams({ ...strategyParams, fixed_percentage_rate: parseFloat(e.target.value) || 4 })
                  }}
                  className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-1 text-xs text-purple-600">Percentage of portfolio value to withdraw each year (e.g., 4 for 4%)</p>
              </div>
            )}

            {modelingStrategyType === 'amount_based_fixed_dollar' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">Annual Withdrawal Amount ($)</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={strategyParams.fixed_dollar_amount}
                  onChange={(e) => {
                    setStrategyParams({ ...strategyParams, fixed_dollar_amount: parseFloat(e.target.value) || 50000 })
                  }}
                  className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-1 text-xs text-purple-600">Fixed dollar amount to withdraw each year regardless of market performance</p>
              </div>
            )}

            {modelingStrategyType === 'market_guardrails' && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">Ceiling (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={strategyParams.guardrails_ceiling}
                    onChange={(e) => {
                      setStrategyParams({ ...strategyParams, guardrails_ceiling: parseFloat(e.target.value) || 6 })
                    }}
                    className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                  <p className="mt-1 text-xs text-purple-600">Maximum withdrawal rate when market performs well</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-2">Floor (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={strategyParams.guardrails_floor}
                    onChange={(e) => {
                      setStrategyParams({ ...strategyParams, guardrails_floor: parseFloat(e.target.value) || 3 })
                    }}
                    className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                  <p className="mt-1 text-xs text-purple-600">Minimum withdrawal rate to protect principal</p>
                </div>
              </div>
            )}

            {modelingStrategyType === 'sequence_bracket_topping' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-900 mb-2">Tax Bracket Threshold (%)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="37"
                  value={strategyParams.bracket_topping_threshold}
                  onChange={(e) => {
                    setStrategyParams({ ...strategyParams, bracket_topping_threshold: parseFloat(e.target.value) || 12 })
                  }}
                  className="block w-full rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-1 text-xs text-purple-600">Fill this tax bracket with tax-deferred withdrawals, then use taxable/Roth</p>
              </div>
            )}

            <div className="rounded-md border border-purple-200 bg-white p-3 mb-4">
              <p className="text-xs font-medium text-purple-900 mb-2">Current Modeling Strategy:</p>
              <p className="text-sm text-purple-800">
                <strong>Strategy:</strong> {
                  modelingStrategyType === 'goal_based' ? (
                    modelingWithdrawalPriority === 'default' ? 'Default (Tax-Efficient)' :
                    modelingWithdrawalPriority === 'longevity' ? 'Longevity (Preserve Assets)' :
                    modelingWithdrawalPriority === 'legacy' ? 'Legacy Value (Maximize Inheritance)' :
                    modelingWithdrawalPriority === 'tax_optimization' ? 'Tax Optimization' :
                    modelingWithdrawalPriority === 'stable_income' ? 'Stable Income' :
                    modelingWithdrawalPriority === 'sequence_risk' ? 'Sequence of Returns Risk Mitigation' :
                    modelingWithdrawalPriority === 'liquidity' ? 'Liquidity (Easy Access)' :
                    'Default'
                  ) : modelingStrategyType === 'amount_based_4_percent' ? '4% Rule' :
                  modelingStrategyType === 'amount_based_fixed_percentage' ? `Fixed Percentage (${strategyParams.fixed_percentage_rate}%)` :
                  modelingStrategyType === 'amount_based_fixed_dollar' ? `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString()})` :
                  modelingStrategyType === 'amount_based_swp' ? 'Systematic Withdrawal Plan (Earnings Only)' :
                  modelingStrategyType === 'sequence_proportional' ? 'Proportional Withdrawals' :
                  modelingStrategyType === 'sequence_bracket_topping' ? `Bracket-Topping (${strategyParams.bracket_topping_threshold}% bracket)` :
                  modelingStrategyType === 'market_bucket' ? 'Bucket Strategy' :
                  modelingStrategyType === 'market_guardrails' ? `Guardrails (${strategyParams.guardrails_floor}%-${strategyParams.guardrails_ceiling}%)` :
                  modelingStrategyType === 'market_floor_upside' ? 'Floor-and-Upside' :
                  modelingStrategyType === 'tax_roth_conversion' ? 'Roth Conversion Bridge' :
                  modelingStrategyType === 'tax_qcd' ? 'Qualified Charitable Distributions (QCDs)' :
                  'Default'
                }
              </p>
              <p className="text-xs text-purple-600 mt-2">
                The system dynamically evaluates your situation each year (account balances, age, years remaining, etc.) and adjusts the withdrawal order based on the selected strategy.
              </p>
            </div>

            {/* Compare Strategies Button */}
            <div className="mb-4 pt-4 border-t border-purple-300">
              <button
                onClick={async () => {
                  if (!selectedScenarioId) return
                  setComparingStrategies(true)
                  await compareAllStrategies()
                  setComparingStrategies(false)
                }}
                disabled={comparingStrategies || !selectedScenarioId}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {comparingStrategies ? 'Comparing Strategies...' : 'Compare All Strategies'}
              </button>
              <p className="mt-2 text-xs text-purple-600">
                Run all strategies and compare metrics side-by-side
              </p>
            </div>
          </div>

          {/* Strategy Comparison Table */}
          {strategyComparison.length > 0 && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Strategy Comparison</h3>
                <button
                  onClick={() => setStrategyComparison([])}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 sticky left-0 bg-gray-50 z-10">
                        Strategy
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Legacy Value
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Longevity (years)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Total Tax
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Avg Annual Tax
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Tax Efficiency (%)
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Negative Years
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Lifetime Income
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Lifetime Expenses
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                        Total Withdrawals
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {strategyComparison.map((strategy, index) => {
                      // Find best values for highlighting
                      const bestLegacy = Math.max(...strategyComparison.map(s => s.legacyValue))
                      const bestLongevity = Math.max(...strategyComparison.map(s => s.longevity))
                      const bestTaxEfficiency = Math.min(...strategyComparison.map(s => s.taxEfficiency))
                      const lowestTax = Math.min(...strategyComparison.map(s => s.totalTax))
                      const lowestNegativeYears = Math.min(...strategyComparison.map(s => s.negativeYears))

                      return (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="sticky left-0 bg-inherit px-4 py-3 text-sm font-medium text-gray-900 z-10">
                            {strategy.strategyName}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm ${strategy.legacyValue === bestLegacy ? 'font-bold text-green-600' : 'text-gray-700'}`}>
                            ${strategy.legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm ${strategy.longevity === bestLongevity ? 'font-bold text-green-600' : 'text-gray-700'}`}>
                            {strategy.longevity > 0 ? `+${strategy.longevity.toFixed(1)}` : strategy.longevity.toFixed(1)}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm ${strategy.totalTax === lowestTax ? 'font-bold text-green-600' : 'text-gray-700'}`}>
                            ${strategy.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            ${strategy.avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-4 py-3 text-right text-sm ${strategy.taxEfficiency === bestTaxEfficiency ? 'font-bold text-green-600' : 'text-gray-700'}`}>
                            {strategy.taxEfficiency.toFixed(1)}%
                          </td>
                          <td className={`px-4 py-3 text-right text-sm ${strategy.negativeYears === lowestNegativeYears ? 'font-bold text-green-600' : strategy.negativeYears > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                            {strategy.negativeYears} ({strategy.negativeYearsPercentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            ${strategy.lifetimeIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            ${strategy.lifetimeExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-700">
                            ${strategy.totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs text-gray-600">
                <strong>Note:</strong> Best values are highlighted in green. Negative years indicate years with shortfalls.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import { Calculator, Settings, Save, Plus, Trash2, Check } from 'lucide-react'
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
  buildCalculatorSettings,
  calculateProgressiveTax,
  calculateCapitalGainsTax,
  determineFilingStatus,
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
  const [planDataForTooltip, setPlanDataForTooltip] = useState<any>(null)
  const [accountsForTooltip, setAccountsForTooltip] = useState<Account[]>([])
  const [expensesForTooltip, setExpensesForTooltip] = useState<Expense[]>([])
  const [otherIncomeForTooltip, setOtherIncomeForTooltip] = useState<OtherIncome[]>([])
  const [showPreRetirement, setShowPreRetirement] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table')
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [incomeGroupExpanded, setIncomeGroupExpanded] = useState(false)
  const [balanceGroupExpanded, setBalanceGroupExpanded] = useState(false)
  const [scenarios, setScenarios] = useState<Array<{ id: number; scenario_name: string; is_default: boolean }>>([])
  const [modelingWithdrawalPriority, setModelingWithdrawalPriority] = useState<'default' | 'longevity' | 'legacy' | 'tax_optimization' | 'stable_income' | 'sequence_risk' | 'liquidity'>('default')
  const [modelingWithdrawalSecondary, setModelingWithdrawalSecondary] = useState<'default' | 'longevity' | 'legacy' | 'tax_optimization' | 'stable_income' | 'sequence_risk' | 'liquidity'>('tax_optimization')
  const [strategyModelerExpanded, setStrategyModelerExpanded] = useState(false)
  const [modelingStrategyType, setModelingStrategyType] = useState<'amount_based_4_percent' | 'amount_based_fixed_percentage' | 'amount_based_fixed_dollar' | 'amount_based_swp' | 'sequence_proportional' | 'sequence_bracket_topping' | 'market_bucket' | 'market_guardrails' | 'market_floor_upside' | 'tax_roth_conversion' | 'tax_qcd'>('amount_based_4_percent')
  const [strategyParams, setStrategyParams] = useState({
    fixed_percentage_rate: 4, // 4%
    fixed_dollar_amount: 50000,
    guardrails_ceiling: 6, // 6%
    guardrails_floor: 3, // 3%
    bracket_topping_threshold: 12, // 12% tax bracket
  })
  const [comparingStrategies, setComparingStrategies] = useState(false)
  const [showStrategyPopup, setShowStrategyPopup] = useState(false)
  const [savingStrategy, setSavingStrategy] = useState(false)
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

  // Auto-load strategy comparison when switching to strategy-modeling tab
  useEffect(() => {
    if (activeSubTab === 'strategy-modeling' && selectedScenarioId && strategyComparison.length === 0 && !comparingStrategies) {
      setComparingStrategies(true)
      compareAllStrategies().finally(() => setComparingStrategies(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, selectedScenarioId])

  const loadProjections = async (scenarioId?: number) => {
    const targetScenarioId = scenarioId || selectedScenarioId
    if (!targetScenarioId) return
    
    setLoading(true)
    try {
      // Load retirement age from settings and life expectancy from plan
      const [settingsResult, planResult, accountsResult, expensesResult, incomeResult] = await Promise.all([
        supabase
        .from('rp_calculator_settings')
        .select('*')
        .eq('scenario_id', targetScenarioId)
          .single(),
        supabase
          .from('rp_retirement_plans')
          .select('*')
          .eq('id', planId)
        .single(),
        supabase
          .from('rp_accounts')
          .select('*')
          .eq('plan_id', planId),
        supabase
          .from('rp_expenses')
          .select('*')
          .eq('plan_id', planId),
        supabase
          .from('rp_other_income')
          .select('*')
          .eq('plan_id', planId)
      ])
      
      if (!settingsResult.error && settingsResult.data) {
        setRetirementAge(settingsResult.data.retirement_age)
        setSettings({
          current_year: settingsResult.data.current_year || new Date().getFullYear(),
          retirement_age: settingsResult.data.retirement_age || 65,
          retirement_start_year: settingsResult.data.retirement_start_year || 0,
          years_to_retirement: settingsResult.data.years_to_retirement || 0,
          annual_retirement_expenses: settingsResult.data.annual_retirement_expenses || 0,
          growth_rate_before_retirement: parseFloat(settingsResult.data.growth_rate_before_retirement?.toString() || '0.1'),
          growth_rate_during_retirement: parseFloat(settingsResult.data.growth_rate_during_retirement?.toString() || '0.05'),
          inflation_rate: parseFloat(settingsResult.data.inflation_rate?.toString() || '0.04'),
          enable_borrowing: settingsResult.data.enable_borrowing || false,
          ssa_start_age: settingsResult.data.ssa_start_age || 62,
          withdrawal_priority: 'default',
          withdrawal_secondary_priority: 'tax_optimization',
        })
      }
      
      if (!planResult.error && planResult.data) {
        setLifeExpectancy(planResult.data.life_expectancy)
        setPlanDataForTooltip(planResult.data)
      }

      if (!accountsResult.error && accountsResult.data) {
        setAccountsForTooltip((accountsResult.data || []).map(acc => ({
          id: acc.id,
          account_name: acc.account_name || '',
          owner: acc.owner || 'planner',
          account_type: acc.account_type || 'Other',
          balance: acc.balance || 0,
          annual_contribution: acc.annual_contribution || 0,
        })))
      }

      if (!expensesResult.error && expensesResult.data) {
        setExpensesForTooltip((expensesResult.data || []).map(exp => ({
          id: exp.id,
          expense_name: exp.expense_name || '',
          amount_before_65: exp.amount_before_65 || 0,
          amount_after_65: exp.amount_after_65 || 0,
        })))
      }

      if (!incomeResult.error && incomeResult.data) {
        setOtherIncomeForTooltip((incomeResult.data || []).map(inc => ({
          id: inc.id,
          income_name: inc.income_source || '',
          amount: inc.annual_amount || 0,
          start_year: inc.start_year || undefined,
          end_year: inc.end_year || undefined,
          inflation_adjusted: inc.inflation_adjusted || false,
        })))
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
          name: `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
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

  const saveStrategyAndSwitchToProjections = async () => {
    if (!selectedScenarioId) return

    setSavingStrategy(true)
    try {
      // Build the strategy settings to save
      const strategySettings: Record<string, any> = {
        withdrawal_strategy_type: modelingStrategyType,
      }

      // Add strategy-specific parameters
      if (modelingStrategyType === 'amount_based_fixed_percentage') {
        strategySettings.fixed_percentage_rate = strategyParams.fixed_percentage_rate / 100
      } else if (modelingStrategyType === 'amount_based_fixed_dollar') {
        strategySettings.fixed_dollar_amount = strategyParams.fixed_dollar_amount
      } else if (modelingStrategyType === 'market_guardrails') {
        strategySettings.guardrails_ceiling = strategyParams.guardrails_ceiling / 100
        strategySettings.guardrails_floor = strategyParams.guardrails_floor / 100
      } else if (modelingStrategyType === 'sequence_bracket_topping') {
        strategySettings.bracket_topping_threshold = strategyParams.bracket_topping_threshold
      }

      // Update the calculator settings with the selected strategy
      const { error } = await supabase
        .from('rp_calculator_settings')
        .update(strategySettings)
        .eq('scenario_id', selectedScenarioId)

      if (error) throw error

      // Close popup and switch to projections tab
      setShowStrategyPopup(false)
      setActiveSubTab('projections')

      // Recalculate projections with the new strategy
      await calculateAndSaveProjections()
    } catch (error) {
      console.error('Error saving strategy:', error)
    } finally {
      setSavingStrategy(false)
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

      // For saved projections, use common helper function to ensure consistency
      // Calculate years to retirement
      const currentYear = new Date().getFullYear()
      const birthYear = planData.data.birth_year
      const retirementAge = settingsData.data.retirement_age || 65
      const yearsToRetirement = retirementAge - (currentYear - birthYear)
      const annualExpenses = expenses.reduce((sum, exp) => {
        const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
        return sum + (amount || 0)
      }, 0) * 12
      
      const baseSettings = buildCalculatorSettings(
        settingsData.data,
        planData.data,
        currentYear,
        retirementAge,
        yearsToRetirement,
        annualExpenses
      )
      
      // Override with default strategy for saved projections (modeling uses different strategy)
      baseSettings.withdrawal_priority = 'default'
      baseSettings.withdrawal_secondary_priority = 'tax_optimization'
      
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
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Projections</h2>
          {/* Scenario Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Scenario:</label>
            <select
              value={selectedScenarioId || ''}
              onChange={(e) => setSelectedScenarioId(parseInt(e.target.value))}
              className="flex-1 sm:flex-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <button
            onClick={calculateAndSaveProjections}
            disabled={calculating || !selectedScenarioId}
            className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {calculating ? 'Calculating...' : 'Calculate Projections'}
          </button>
          <button
            onClick={() => setActiveSubTab('strategy-modeling')}
            className="flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-200"
          >
            <Settings className="w-4 h-4" />
            Strategy Modeling
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="mb-4 border-b border-gray-200 overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          <button
            onClick={() => setActiveSubTab('projections')}
            className={`whitespace-nowrap border-b-2 px-2 sm:px-1 py-3 sm:py-4 text-sm font-medium ${
              activeSubTab === 'projections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            Projections
          </button>
          <button
            onClick={() => setActiveSubTab('strategy-modeling')}
            className={`whitespace-nowrap border-b-2 px-2 sm:px-1 py-3 sm:py-4 text-sm font-medium ${
              activeSubTab === 'strategy-modeling'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
            }`}
          >
            Strategy Modeling
          </button>
        </nav>
      </div>

      {/* Projections Sub-tab */}
      {activeSubTab === 'projections' && (
        <div>
          {/* Strategy Metrics Summary - shown for both table and graph views */}
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
          const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projections[zeroNetworthYear]?.age || 0) : null
          const longevityBeyondLifeExpectancy = zeroNetworthYear >= 0 
            ? (projections[zeroNetworthYear]?.age || 0) - lifeExpectancy
            : finalAge - lifeExpectancy
          // Determine longevity display text
          const longevityDisplay = zeroNetworthYear >= 0 
            ? `Runout ${Math.abs(longevityBeyondLifeExpectancy).toFixed(2)} years before life expectancy`
            : 'Through plan life'
          
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
          const totalRemainingBalances = remaining401k + remainingRoth + remainingTaxable + remainingIra + remainingHsa + remainingOther
          
          // Lifetime expenses
          const lifetimeExpenses = retirementProjections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
          
          // Total withdrawals
          const totalWithdrawals = total401kWithdrawals + totalRothWithdrawals + totalTaxableWithdrawals + totalIraWithdrawals + totalHsaWithdrawals
          
          // Helper function to get strategy name
          const getStrategyName = () => {
            if (modelingStrategyType === 'amount_based_4_percent') return '4% Rule'
            if (modelingStrategyType === 'amount_based_fixed_percentage') return `Fixed Percentage (${strategyParams.fixed_percentage_rate}%)`
            if (modelingStrategyType === 'amount_based_fixed_dollar') return `Fixed Dollar ($${strategyParams.fixed_dollar_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })})`
            if (modelingStrategyType === 'amount_based_swp') return 'Systematic Withdrawal Plan (Earnings Only)'
            if (modelingStrategyType === 'sequence_proportional') return 'Proportional Withdrawals'
            if (modelingStrategyType === 'sequence_bracket_topping') return `Bracket-Topping (${strategyParams.bracket_topping_threshold}% bracket)`
            if (modelingStrategyType === 'market_bucket') return 'Bucket Strategy'
            if (modelingStrategyType === 'market_guardrails') return `Guardrails (${strategyParams.guardrails_floor}%-${strategyParams.guardrails_ceiling}%)`
            if (modelingStrategyType === 'market_floor_upside') return 'Floor-and-Upside'
            if (modelingStrategyType === 'tax_roth_conversion') return 'Roth Conversion Bridge'
            if (modelingStrategyType === 'tax_qcd') return 'Qualified Charitable Distributions (QCDs)'
            return 'Default'
          }

          return (
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Withdrawal Strategy: {getStrategyName()}{' '}
                <button
                  onClick={() => setShowStrategyPopup(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Change
                </button>
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs font-medium text-blue-900 mb-1">Legacy Value</p>
                  <p className="text-lg font-semibold text-blue-900">
                    ${legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">Final net worth</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-green-900">Longevity</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <svg className="h-3 w-3 text-green-600 hover:text-green-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-2xl bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-xs space-y-3">
                            {(() => {
                              const currentYear = new Date().getFullYear()
                              const birthYear = planDataForTooltip?.birth_year || 0
                              const currentAge = birthYear ? currentYear - birthYear : 0
                              const finalProjection = retirementProjections[retirementProjections.length - 1]
                              const finalAge = finalProjection?.age || 0
                              const zeroNetworthYear = projections.findIndex(p => (p.networth || 0) <= 0)
                              const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projections[zeroNetworthYear]?.age || 0) : finalAge
                              
                              const totalAccountBalance = accountsForTooltip.reduce((sum, acc) => sum + (acc.balance || 0), 0)
                              const totalMonthlyExpenses = expensesForTooltip.reduce((sum, exp) => {
                                const amount = (retirementAge || 65) >= 65 ? exp.amount_after_65 : exp.amount_before_65
                                return sum + (amount || 0)
                              }, 0)
                              const totalAnnualExpenses = totalMonthlyExpenses * 12
                              const totalOtherIncome = otherIncomeForTooltip.reduce((sum, inc) => sum + (inc.amount || 0), 0)
                              
                              return (
                                <>
                                  <div>
                                    <h4 className="font-semibold text-green-400 mb-2">Longevity Calculation</h4>
                                    <p className="mb-2">
                                      Longevity = {(zeroNetworthYear >= 0 ? ageAtZeroNetworth : finalAge)} - {lifeExpectancy} = {longevityBeyondLifeExpectancy.toFixed(2)} years
                                    </p>
                                    <p className="text-gray-400 text-xs mb-3">
                                      {zeroNetworthYear >= 0 
                                        ? `Funds run out at age ${ageAtZeroNetworth} (${ageAtZeroNetworth - lifeExpectancy} years ${ageAtZeroNetworth > lifeExpectancy ? 'beyond' : 'before'} life expectancy)`
                                        : `Projections end at age ${finalAge} (${finalAge - lifeExpectancy} years ${finalAge > lifeExpectancy ? 'beyond' : 'before'} life expectancy)`}
                                    </p>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-blue-400 mb-2">User-Entered Values</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Birth Year:</span> {birthYear || 'Not set'}</p>
                                      <p><span className="text-gray-500">Current Age:</span> {currentAge} years</p>
                                      <p><span className="text-gray-500">Retirement Age:</span> {retirementAge || 'Not set'} years</p>
                                      <p><span className="text-gray-500">Life Expectancy:</span> {lifeExpectancy} years</p>
                                      {planDataForTooltip?.include_spouse && (
                                        <>
                                          <p><span className="text-gray-500">Spouse Birth Year:</span> {planDataForTooltip?.spouse_birth_year || 'Not set'}</p>
                                          <p><span className="text-gray-500">Spouse Life Expectancy:</span> {planDataForTooltip?.spouse_life_expectancy || 'Not set'} years</p>
                                        </>
                                      )}
                                      <p><span className="text-gray-500">Total Account Balance:</span> ${totalAccountBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <div className="ml-4 mt-1">
                                        {accountsForTooltip.map(acc => (
                                          <p key={acc.id} className="text-xs">
                                            • {acc.account_name} ({acc.account_type}): ${(acc.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            {(acc.annual_contribution || 0) > 0 && `, Annual Contribution: $${(acc.annual_contribution || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                          </p>
                                        ))}
                                      </div>
                                      <p><span className="text-gray-500">Total Monthly Expenses:</span> ${totalMonthlyExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p><span className="text-gray-500">Total Annual Expenses:</span> ${totalAnnualExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      {expensesForTooltip.length > 0 && (
                                        <div className="ml-4 mt-1">
                                          {expensesForTooltip.map(exp => (
                                            <p key={exp.id} className="text-xs">
                                              • {exp.expense_name}: ${((retirementAge || 65) >= 65 ? exp.amount_after_65 : exp.amount_before_65) || 0}/month
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                      {totalOtherIncome > 0 && (
                                        <>
                                          <p><span className="text-gray-500">Other Income:</span> ${totalOtherIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                                          <div className="ml-4 mt-1">
                                            {otherIncomeForTooltip.map(inc => (
                                              <p key={inc.id} className="text-xs">
                                                • {inc.income_name}: ${(inc.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year
                                                {inc.start_year && ` (${inc.start_year}-${inc.end_year || 'ongoing'})`}
                                              </p>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-yellow-400 mb-2">Assumptions</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Growth Rate (Pre-Retirement):</span> {((settings?.growth_rate_before_retirement || 0.1) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Growth Rate (During Retirement):</span> {((settings?.growth_rate_during_retirement || 0.05) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Inflation Rate:</span> {((settings?.inflation_rate || 0.04) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Taxes:</span> Using IRS brackets</p>
                                      <p><span className="text-gray-500">SSA Start Age:</span> {settings?.ssa_start_age || 62} years</p>
                                      <p><span className="text-gray-500">Filing Status:</span> {planDataForTooltip?.filing_status || 'Single'}</p>
                                      <p><span className="text-gray-500">Borrowing Enabled:</span> {settings?.enable_borrowing ? 'Yes' : 'No'}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-purple-400 mb-2">Projection Summary</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Projection Start Year:</span> {projections[0]?.year || 'N/A'}</p>
                                      <p><span className="text-gray-500">Projection End Year:</span> {finalProjection?.year || 'N/A'}</p>
                                      <p><span className="text-gray-500">Final Age:</span> {finalAge} years</p>
                                      <p><span className="text-gray-500">Age at Zero Networth:</span> {zeroNetworthYear >= 0 ? `${ageAtZeroNetworth} years` : 'Not reached'}</p>
                                      <p><span className="text-gray-500">Total Retirement Years:</span> {retirementProjections.length} years</p>
                                    </div>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-lg font-semibold text-green-900">
                    {longevityDisplay}
                  </p>
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
                    {taxEfficiency.toFixed(2)}%
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">Tax as % of income</p>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-xs font-medium text-orange-900 mb-1">Negative Years</p>
                  <p className="text-lg font-semibold text-orange-900">
                    {negativeYears} ({negativeYearsPercentage.toFixed(2)}%)
                  </p>
                  <p className="text-xs text-orange-700 mt-1">Years with shortfall</p>
                </div>
              </div>
              
              {/* Lifetime Income, Expenses, Remaining Balances, and Total Withdrawals */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                    <p className="text-xs font-medium text-emerald-900 mb-1">Remaining Account Balances</p>
                    <p className="text-lg font-semibold text-emerald-900">
                      ${totalRemainingBalances.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      401k: ${remaining401k.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      IRA: ${remainingIra.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      Roth: ${remainingRoth.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      Taxable: ${remainingTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      HSA: ${remainingHsa.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      Other: ${remainingOther.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs font-medium text-amber-900 mb-1">Total Withdrawals</p>
                    <p className="text-lg font-semibold text-amber-900">
                      ${totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      401k: ${total401kWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      IRA: ${totalIraWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      Roth: ${totalRothWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      Taxable: ${totalTaxableWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                      HSA: ${totalHsaWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

          {/* Controls for view mode, graph type, and column visibility */}
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
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center space-x-2 border border-gray-300 rounded-md">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 text-sm rounded-l-md ${
                    viewMode === 'table'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('graph')}
                  className={`px-3 py-1 text-sm rounded-r-md ${
                    (viewMode as 'table' | 'graph') === 'graph'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Graph
                </button>
              </div>
              {(viewMode as 'table' | 'graph') === 'graph' && (
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
            </div>
          </div>

          {/* Table or Graph View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200 border text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {visibleColumns.year && <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase">Year</th>}
                      {visibleColumns.age && <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase">Age</th>}
                      {visibleColumns.event && <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase">Event</th>}
                    
                    {/* Individual Income Columns (shown when expanded) */}
                    {incomeGroupExpanded && visibleColumns.ssa && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">SSA</th>}
                    {incomeGroupExpanded && visibleColumns.dist401k && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">401k Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distRoth && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Roth Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distTaxable && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Taxable Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distHsa && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">HSA Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distIra && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">IRA Dist</th>}
                    {incomeGroupExpanded && visibleColumns.distOther && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Other Dist</th>}
                    {incomeGroupExpanded && visibleColumns.otherIncome && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Other Income</th>}
                    
                    {/* Total Income - Clickable to expand/collapse income columns */}
                    {visibleColumns.totalIncome && (
                      <th 
                        className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase bg-blue-50 cursor-pointer hover:bg-blue-100 active:bg-blue-200"
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
                          <span className="text-gray-700">{incomeGroupExpanded ? '▼' : '▶'}</span>
                        </div>
                      </th>
                    )}
                    
                    {visibleColumns.tax && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Tax</th>}
                    {visibleColumns.expenses && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Expenses</th>}
                    {visibleColumns.gapExcess && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Gap/Excess</th>}
                    
                    {/* Networth - Clickable to expand/collapse balance columns */}
                    {visibleColumns.networth && (
                      <th 
                        className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 active:bg-gray-200"
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
                          <span className="text-gray-700">{balanceGroupExpanded ? '▼' : '▶'}</span>
                        </div>
                      </th>
                    )}
                    
                    {/* Individual Balance Columns (shown when expanded, to the right of Networth) */}
                    {balanceGroupExpanded && visibleColumns.balance401k && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">401k Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceRoth && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Roth Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceTaxable && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Taxable Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceHsa && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">HSA Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceIra && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">IRA Bal</th>}
                    {balanceGroupExpanded && visibleColumns.balanceOther && <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-700 uppercase">Other Bal</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredProjections.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-4 py-8 text-center text-sm sm:text-base text-gray-700">
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
                  <tr key={`${proj.year}-${proj.age}`} className="hover:bg-gray-50">
                    {visibleColumns.year && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{proj.year}</td>}
                    {visibleColumns.age && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{proj.age || '-'}</td>}
                    {visibleColumns.event && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900">{proj.event || '-'}</td>}
                    
                    {/* Individual Income Columns (shown when expanded) */}
                    {incomeGroupExpanded && visibleColumns.ssa && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {showIncome && ssaIncome > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${ssaIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {ssaYoY !== null && (
                                <div className={`text-xs ${ssaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {ssaYoY >= 0 ? '+' : ''}{ssaYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.dist401k && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${dist401k.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {dist401kYoY !== null && (
                                <div className={`text-xs ${dist401kYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {dist401kYoY >= 0 ? '+' : ''}{dist401kYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.distRoth && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distRoth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distRothYoY !== null && (
                                <div className={`text-xs ${distRothYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distRothYoY >= 0 ? '+' : ''}{distRothYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.distTaxable && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distTaxableYoY !== null && (
                                <div className={`text-xs ${distTaxableYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distTaxableYoY >= 0 ? '+' : ''}{distTaxableYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.distHsa && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distHsa.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distHsaYoY !== null && (
                                <div className={`text-xs ${distHsaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distHsaYoY >= 0 ? '+' : ''}{distHsaYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.distIra && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distIra.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distIraYoY !== null && (
                                <div className={`text-xs ${distIraYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distIraYoY >= 0 ? '+' : ''}{distIraYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.distOther && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${distOther.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {distOtherYoY !== null && (
                                <div className={`text-xs ${distOtherYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {distOtherYoY >= 0 ? '+' : ''}{distOtherYoY.toFixed(2)}%
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
                    {incomeGroupExpanded && visibleColumns.otherIncome && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${otherIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {otherIncomeYoY !== null && (
                                <div className={`text-xs ${otherIncomeYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {otherIncomeYoY >= 0 ? '+' : ''}{otherIncomeYoY.toFixed(2)}%
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
                    {visibleColumns.totalIncome && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold bg-blue-50 text-gray-900">
                      {showIncome ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              {totalIncomeYoY !== null && (
                                <div className={`text-xs ${totalIncomeYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {totalIncomeYoY >= 0 ? '+' : ''}{totalIncomeYoY.toFixed(2)}%
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
                    {visibleColumns.tax && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div>${(proj.tax || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm space-y-2">
                              <p className="font-semibold mb-2">Tax Calculation (IRS 2024 Brackets)</p>
                              
                              {(() => {
                                // Use same calculation logic as retirement-projections.ts
                                // Determine filing status using the same helper function
                                const includeSpouseSsa = planDataForTooltip?.include_spouse || false
                                const filingStatus = determineFilingStatus(includeSpouseSsa, settings?.filing_status)
                                const standardDeduction = filingStatus === 'Married Filing Jointly' ? 29200 : 14600
                                const ordinaryIncome = (proj.distribution_401k || 0) + (proj.distribution_ira || 0) + (proj.other_recurring_income || 0)
                                const taxableIncomeAfterDeduction = Math.max(0, ordinaryIncome - standardDeduction)
                                
                                // Use actual IRS progressive tax brackets (same as projections)
                                const incomeTax = calculateProgressiveTax(taxableIncomeAfterDeduction, filingStatus)
                                
                                // Capital gains tax - use same calculation as projections
                                const distributionTaxable = proj.distribution_taxable || 0
                                const capitalGainsTax = calculateCapitalGainsTax(distributionTaxable, filingStatus)
                                
                                // Calculate effective rates for display
                                const effectiveIncomeTaxRate = taxableIncomeAfterDeduction > 0 
                                  ? (incomeTax / taxableIncomeAfterDeduction) * 100 
                                  : 0
                                const effectiveCapitalGainsTaxRate = distributionTaxable > 0
                                  ? (capitalGainsTax / distributionTaxable) * 100
                                  : 0
                                
                                return (
                                  <>
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium">Ordinary Income:</p>
                                      {(proj.distribution_401k || 0) > 0 && (
                                        <p className="text-xs ml-2">- 401k: ${(proj.distribution_401k || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      )}
                                      {(proj.distribution_ira || 0) > 0 && (
                                        <p className="text-xs ml-2">- IRA: ${(proj.distribution_ira || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      )}
                                      {(proj.other_recurring_income || 0) > 0 && (
                                        <p className="text-xs ml-2">- Other Income: ${(proj.other_recurring_income || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      )}
                                      <p className="text-xs ml-2 border-t border-gray-600 pt-1 mt-1">Total: ${ordinaryIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p className="text-xs ml-2">Standard Deduction ({filingStatus}): -${standardDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p className="text-xs ml-2 border-t border-gray-600 pt-1 mt-1">Taxable Income: ${taxableIncomeAfterDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      {taxableIncomeAfterDeduction > 0 && (
                                        <>
                                          <p className="text-xs ml-2">Income Tax (IRS brackets): ${incomeTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                          {effectiveIncomeTaxRate > 0 && (
                                            <p className="text-xs ml-2 text-gray-400">Effective Rate: {effectiveIncomeTaxRate.toFixed(2)}%</p>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    
                                    {distributionTaxable > 0 && (
                                      <div className="space-y-1 border-t border-gray-600 pt-2 mt-2">
                                        <p className="text-xs font-medium">Capital Gains:</p>
                                        <p className="text-xs ml-2">Taxable Account: ${distributionTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                        {capitalGainsTax > 0 && (
                                          <>
                                            <p className="text-xs ml-2">Capital Gains Tax (IRS brackets): ${capitalGainsTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                            {effectiveCapitalGainsTaxRate > 0 && (
                                              <p className="text-xs ml-2 text-gray-400">Effective Rate: {effectiveCapitalGainsTaxRate.toFixed(2)}%</p>
                                            )}
                                          </>
                                        )}
                                        {capitalGainsTax === 0 && (
                                          <p className="text-xs ml-2 text-gray-400 italic">No tax (within 0% capital gains bracket)</p>
                                        )}
                                      </div>
                                    )}
                                    
                                    <div className="border-t border-gray-600 pt-2 mt-2">
                                      <p className="text-xs font-semibold">Total Tax: ${(proj.tax || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p className="text-xs text-gray-400 italic mt-1">Using IRS 2024 federal tax brackets and standard deductions</p>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : '-'}
                    </td>}
                    {visibleColumns.expenses && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      {isRetired ? `$${(proj.total_expenses || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </td>}
                    {visibleColumns.gapExcess && <td className={`px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold ${
                      showIncome ? ((proj.gap_excess || 0) >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-400'
                    }`}>
                      {showIncome ? `$${(proj.gap_excess || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                    </td>}
                    {visibleColumns.networth && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-semibold text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.networth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {networthYoY !== null && (
                              <div className={`text-xs ${networthYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {networthYoY >= 0 ? '+' : ''}{networthYoY.toFixed(2)}%
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
                    {balanceGroupExpanded && visibleColumns.balance401k && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_401k || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balance401kYoY !== null && (
                              <div className={`text-xs ${balance401kYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balance401kYoY >= 0 ? '+' : ''}{balance401kYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balance401kChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balance401kChange.growth / (prevProj?.balance_401k || 1)) * 100).toFixed(2)}%)</p>
                              {balance401kChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balance401kChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balance401kChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balance401kChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balance401kChange.withdrawals / (prevProj?.balance_401k || 1)) * 100).toFixed(2)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balance401kChange.change >= 0 ? '+' : ''}${balance401kChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceRoth && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_roth || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceRothYoY !== null && (
                              <div className={`text-xs ${balanceRothYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceRothYoY >= 0 ? '+' : ''}{balanceRothYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balanceRothChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceRothChange.growth / (prevProj?.balance_roth || 1)) * 100).toFixed(2)}%)</p>
                              {balanceRothChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceRothChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceRothChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceRothChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceRothChange.withdrawals / (prevProj?.balance_roth || 1)) * 100).toFixed(2)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceRothChange.change >= 0 ? '+' : ''}${balanceRothChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceTaxable && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_investment || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceInvestmentYoY !== null && (
                              <div className={`text-xs ${balanceInvestmentYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceInvestmentYoY >= 0 ? '+' : ''}{balanceInvestmentYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balanceInvestmentChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceInvestmentChange.growth / (prevProj?.balance_investment || 1)) * 100).toFixed(2)}%)</p>
                              {balanceInvestmentChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceInvestmentChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceInvestmentChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceInvestmentChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceInvestmentChange.withdrawals / (prevProj?.balance_investment || 1)) * 100).toFixed(2)}%)</p>
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
                    {balanceGroupExpanded && visibleColumns.balanceHsa && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_hsa || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceHsaYoY !== null && (
                              <div className={`text-xs ${balanceHsaYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceHsaYoY >= 0 ? '+' : ''}{balanceHsaYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balanceHsaChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceHsaChange.growth / (prevProj?.balance_hsa || 1)) * 100).toFixed(2)}%)</p>
                              {balanceHsaChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceHsaChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceHsaChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceHsaChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceHsaChange.withdrawals / (prevProj?.balance_hsa || 1)) * 100).toFixed(2)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceHsaChange.change >= 0 ? '+' : ''}${balanceHsaChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceIra && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_ira || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceIraYoY !== null && (
                              <div className={`text-xs ${balanceIraYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceIraYoY >= 0 ? '+' : ''}{balanceIraYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balanceIraChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceIraChange.growth / (prevProj?.balance_ira || 1)) * 100).toFixed(2)}%)</p>
                              {balanceIraChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceIraChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceIraChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceIraChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceIraChange.withdrawals / (prevProj?.balance_ira || 1)) * 100).toFixed(2)}%)</p>
                              )}
                              <p className="text-xs font-semibold mt-2">Net Change: ${balanceIraChange.change >= 0 ? '+' : ''}${balanceIraChange.change.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </>
                          ) : (
                            <p className="text-xs">No previous data available</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </td>}
                    {balanceGroupExpanded && visibleColumns.balanceOther && <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-right font-medium text-gray-900">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div>${(proj.balance_other_investments || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            {balanceOtherYoY !== null && (
                              <div className={`text-xs ${balanceOtherYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {balanceOtherYoY >= 0 ? '+' : ''}{balanceOtherYoY.toFixed(2)}%
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
                              <p className="text-xs">Growth: +${balanceOtherChange.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceOtherChange.growth / (prevProj?.balance_other_investments || 1)) * 100).toFixed(2)}%)</p>
                              {balanceOtherChange.contributions > 0 && (
                                <p className="text-xs">Contributions: +${balanceOtherChange.contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                              )}
                              {balanceOtherChange.withdrawals < 0 && (
                                <p className="text-xs">Withdrawals: ${balanceOtherChange.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((balanceOtherChange.withdrawals / (prevProj?.balance_other_investments || 1)) * 100).toFixed(2)}%)</p>
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
            </div>
          )}

          {/* Graph View */}
          {viewMode === 'graph' && filteredProjections.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  {graphType === 'line' ? (
                    <LineChart data={filteredProjections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="age" 
                        label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        width={70}
                      />
                      <RechartsTooltip 
                        formatter={(value: number | undefined, name: string | undefined) => [
                          `$${(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                          name || ''
                        ]}
                        labelFormatter={(label) => `Age ${label}`}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="networth" name="Net Worth" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="total_income" name="Total Income" stroke="#16a34a" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="tax" name="Tax" stroke="#ca8a04" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  ) : graphType === 'area' ? (
                    <AreaChart data={filteredProjections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="age" 
                        label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        width={70}
                      />
                      <RechartsTooltip 
                        formatter={(value: number | undefined, name: string | undefined) => [
                          `$${(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                          name || ''
                        ]}
                        labelFormatter={(label) => `Age ${label}`}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="networth" name="Net Worth" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="balance_401k" name="401k Balance" stroke="#7c3aed" fill="#8b5cf6" fillOpacity={0.3} stackId="balances" />
                      <Area type="monotone" dataKey="balance_roth" name="Roth Balance" stroke="#059669" fill="#10b981" fillOpacity={0.3} stackId="balances" />
                      <Area type="monotone" dataKey="balance_investment" name="Taxable Balance" stroke="#0891b2" fill="#06b6d4" fillOpacity={0.3} stackId="balances" />
                    </AreaChart>
                  ) : (
                    <BarChart data={filteredProjections}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="age" 
                        label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                        interval={Math.ceil(filteredProjections.length / 15)}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        width={70}
                      />
                      <RechartsTooltip 
                        formatter={(value: number | undefined, name: string | undefined) => [
                          `$${(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                          name || ''
                        ]}
                        labelFormatter={(label) => `Age ${label}`}
                      />
                      <Legend />
                      <Bar dataKey="total_income" name="Total Income" fill="#16a34a" />
                      <Bar dataKey="expenses" name="Expenses" fill="#dc2626" />
                      <Bar dataKey="tax" name="Tax" fill="#ca8a04" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-gray-500 text-center">
                {graphType === 'line' && 'Line chart showing net worth, income, expenses, and tax over time'}
                {graphType === 'area' && 'Area chart showing net worth and stacked account balances over time'}
                {graphType === 'bar' && 'Bar chart comparing income, expenses, and tax by age'}
              </p>
            </div>
          )}

          {viewMode === 'graph' && filteredProjections.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-gray-600">
                {projections.length === 0 
                  ? 'No projections yet. Calculate projections to see the graph.'
                  : 'No projections match the current filter. Try enabling "Show Pre-Retirement Years".'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Strategy Selection Popup - available from any tab */}
      {showStrategyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Select Withdrawal Strategy</h3>
                <button
                  onClick={() => setShowStrategyPopup(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Strategy Type</label>
                  <select
                    value={modelingStrategyType}
                    onChange={(e) => setModelingStrategyType(e.target.value as any)}
                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
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
                  <p className="mt-1 text-xs text-gray-500">
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

                {/* Strategy-Specific Parameters */}
                {modelingStrategyType === 'amount_based_fixed_percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Withdrawal Percentage (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={strategyParams.fixed_percentage_rate}
                      onChange={(e) => setStrategyParams({ ...strategyParams, fixed_percentage_rate: parseFloat(e.target.value) || 4 })}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Percentage of portfolio value to withdraw each year</p>
                  </div>
                )}

                {modelingStrategyType === 'amount_based_fixed_dollar' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Annual Withdrawal Amount ($)</label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={strategyParams.fixed_dollar_amount}
                      onChange={(e) => setStrategyParams({ ...strategyParams, fixed_dollar_amount: parseFloat(e.target.value) || 50000 })}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Fixed dollar amount to withdraw each year</p>
                  </div>
                )}

                {modelingStrategyType === 'market_guardrails' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ceiling (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={strategyParams.guardrails_ceiling}
                        onChange={(e) => setStrategyParams({ ...strategyParams, guardrails_ceiling: parseFloat(e.target.value) || 6 })}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="mt-1 text-xs text-gray-500">Maximum withdrawal rate</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Floor (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={strategyParams.guardrails_floor}
                        onChange={(e) => setStrategyParams({ ...strategyParams, guardrails_floor: parseFloat(e.target.value) || 3 })}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="mt-1 text-xs text-gray-500">Minimum withdrawal rate</p>
                    </div>
                  </div>
                )}

                {modelingStrategyType === 'sequence_bracket_topping' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tax Bracket Threshold (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="37"
                      value={strategyParams.bracket_topping_threshold}
                      onChange={(e) => setStrategyParams({ ...strategyParams, bracket_topping_threshold: parseFloat(e.target.value) || 12 })}
                      className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Fill this tax bracket with tax-deferred withdrawals</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowStrategyPopup(false)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStrategyAndSwitchToProjections}
                  disabled={savingStrategy || !selectedScenarioId}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingStrategy ? 'Saving...' : 'Save & View Projections'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Modeling Sub-tab */}
      {activeSubTab === 'strategy-modeling' && (
        <div>
          {/* Strategy Comparison Table */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Strategy Comparison</h3>
              <button
                onClick={() => setShowStrategyPopup(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Select Strategy →
              </button>
            </div>

            {comparingStrategies && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-600 mb-3"></div>
                  <p className="text-sm text-gray-600">Comparing all strategies...</p>
                </div>
              </div>
            )}

            {!comparingStrategies && strategyComparison.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No comparison data available. Please select a scenario first.</p>
              </div>
            )}

            {!comparingStrategies && strategyComparison.length > 0 && (
              <>
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
                          Longevity
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
                        // Find best values for highlighting (higher is better for some, lower for others)
                        const bestLegacy = Math.max(...strategyComparison.map(s => s.legacyValue))
                        const worstLegacy = Math.min(...strategyComparison.map(s => s.legacyValue))
                        const bestLongevity = Math.max(...strategyComparison.map(s => s.longevity))
                        const worstLongevity = Math.min(...strategyComparison.map(s => s.longevity))
                        const lowestTax = Math.min(...strategyComparison.map(s => s.totalTax))
                        const highestTax = Math.max(...strategyComparison.map(s => s.totalTax))
                        const lowestAvgTax = Math.min(...strategyComparison.map(s => s.avgAnnualTax))
                        const highestAvgTax = Math.max(...strategyComparison.map(s => s.avgAnnualTax))
                        const bestTaxEfficiency = Math.min(...strategyComparison.map(s => s.taxEfficiency))
                        const worstTaxEfficiency = Math.max(...strategyComparison.map(s => s.taxEfficiency))
                        const lowestNegativeYears = Math.min(...strategyComparison.map(s => s.negativeYears))
                        const highestNegativeYears = Math.max(...strategyComparison.map(s => s.negativeYears))
                        const highestLifetimeIncome = Math.max(...strategyComparison.map(s => s.lifetimeIncome))
                        const lowestLifetimeIncome = Math.min(...strategyComparison.map(s => s.lifetimeIncome))
                        const lowestLifetimeExpenses = Math.min(...strategyComparison.map(s => s.lifetimeExpenses))
                        const highestLifetimeExpenses = Math.max(...strategyComparison.map(s => s.lifetimeExpenses))
                        const lowestWithdrawals = Math.min(...strategyComparison.map(s => s.totalWithdrawals))
                        const highestWithdrawals = Math.max(...strategyComparison.map(s => s.totalWithdrawals))

                        // Check if all values are the same (don't highlight if no difference)
                        const allLegacySame = bestLegacy === worstLegacy
                        const allLongevitySame = bestLongevity === worstLongevity
                        const allTaxSame = lowestTax === highestTax
                        const allAvgTaxSame = lowestAvgTax === highestAvgTax
                        const allTaxEfficiencySame = bestTaxEfficiency === worstTaxEfficiency
                        const allNegativeYearsSame = lowestNegativeYears === highestNegativeYears
                        const allLifetimeIncomeSame = highestLifetimeIncome === lowestLifetimeIncome
                        const allLifetimeExpensesSame = lowestLifetimeExpenses === highestLifetimeExpenses
                        const allWithdrawalsSame = lowestWithdrawals === highestWithdrawals

                        // Longevity display: "Full" if >= 0, "Short XX Yrs" if < 0
                        const longevityDisplay = strategy.longevity >= 0 
                          ? 'Full' 
                          : `Short ${Math.abs(strategy.longevity).toFixed(0)} Yrs`
                        const isBestLongevity = !allLongevitySame && strategy.longevity === bestLongevity

                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="sticky left-0 bg-inherit px-4 py-3 text-sm font-medium text-gray-900 z-10">
                              {strategy.strategyName}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allLegacySame && strategy.legacyValue === bestLegacy ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${isBestLongevity ? 'font-bold text-green-600 bg-green-50' : strategy.longevity < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                              {longevityDisplay}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allTaxSame && strategy.totalTax === lowestTax ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allAvgTaxSame && strategy.avgAnnualTax === lowestAvgTax ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allTaxEfficiencySame && strategy.taxEfficiency === bestTaxEfficiency ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              {strategy.taxEfficiency.toFixed(2)}%
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allNegativeYearsSame && strategy.negativeYears === lowestNegativeYears ? 'font-bold text-green-600 bg-green-50' : strategy.negativeYears > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                              {strategy.negativeYears} ({strategy.negativeYearsPercentage.toFixed(2)}%)
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allLifetimeIncomeSame && strategy.lifetimeIncome === highestLifetimeIncome ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.lifetimeIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allLifetimeExpensesSame && strategy.lifetimeExpenses === lowestLifetimeExpenses ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.lifetimeExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`px-4 py-3 text-right text-sm ${!allWithdrawalsSame && strategy.totalWithdrawals === lowestWithdrawals ? 'font-bold text-green-600 bg-green-50' : 'text-gray-700'}`}>
                              ${strategy.totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-gray-600">
                  <strong>Note:</strong> Best values in each column are highlighted in green. "Full" means assets last past life expectancy; "Short X Yrs" means assets run out X years before life expectancy. Negative years indicate years with shortfalls.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

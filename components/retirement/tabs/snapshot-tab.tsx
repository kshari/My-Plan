'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOptionalDataService } from '@/lib/storage'
import { useScenario } from '../scenario-context'
import { 
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateProgressiveTax,
  calculateCapitalGainsTax,
  determineFilingStatus,
  calculateEstimatedSSA,
  type Account, 
  type Expense, 
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'
import { ChevronRight, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ArrowRight, Info, Calculator, Edit2, Save, X, Plus, Trash2, Check, SlidersHorizontal, FileDown, Lock } from 'lucide-react'
import { PlanPdfDialog } from '@/components/retirement/plan-pdf-dialog'
import { PlanPrintAllDialog } from '@/components/retirement/plan-print-all-dialog'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
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
  SSA_FULL_RETIREMENT_AGE,
  ssaClaimingMultiplier,
} from '@/lib/constants/ssa-constants'
import {
  DEFAULT_AGE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_CURRENT_SAVINGS,
  DEFAULT_ANNUAL_CONTRIBUTION,
  DEFAULT_MONTHLY_EXPENSES,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
  DEFAULT_INFLATION_RATE,
  DEFAULT_INCLUDE_SSA,
  DEFAULT_SSA_START_AGE,
  DEFAULT_FILING_STATUS,
  SSA_EARLIEST_ELIGIBILITY_AGE,
  SAFE_WITHDRAWAL_RATE,
  SCORE_ON_TRACK_THRESHOLD,
  SCORE_CLOSE_THRESHOLD,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  DEFAULT_INFLATION_RATE_PCT,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
} from '@/lib/constants/retirement-defaults'
import { getStandardDeduction } from '@/lib/constants/tax-brackets'
import { calculateRetirementScore } from '@/components/retirement/tabs/analysis-tab'
import { runMonteCarloSimulation } from '@/lib/utils/monte-carlo'
import { DEBOUNCE_SAVE_MS, TOAST_DURATION_SHORT, TOAST_DURATION_LONG } from '@/lib/constants/timing'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'
import { DEFAULT_RETIREMENT_ASSUMPTIONS } from '@/lib/types/retirement-assumptions'

interface SnapshotTabProps {
  planId: number
  onSwitchToAdvanced?: () => void
  onSwitchToPlanSetup?: () => void
  /** Increment this value to force the tab to re-load and recalculate projections. */
  refreshKey?: number
}

export default function SnapshotTab({ planId, onSwitchToAdvanced, onSwitchToPlanSetup, refreshKey = 0 }: SnapshotTabProps) {
  const supabase = createClient()
  const dataService = useOptionalDataService()
  const isLocal = dataService?.mode === 'local'
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [mcRunning, setMcRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(true)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [planDataForTooltip, setPlanDataForTooltip] = useState<any>(null)
  const [accountsForTooltip, setAccountsForTooltip] = useState<Account[]>([])
  const [expensesForTooltip, setExpensesForTooltip] = useState<Expense[]>([])
  const [otherIncomeForTooltip, setOtherIncomeForTooltip] = useState<OtherIncome[]>([])
  const [settingsForTooltip, setSettingsForTooltip] = useState<CalculatorSettings | null>(null)
  // NOTE: projections removed - use 'projections' state for consistency
  // All tooltip calculations should use the same projections data as the table/graph
  const [showPreRetirement, setShowPreRetirement] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table')
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [showBannerOnMobile, setShowBannerOnMobile] = useState(false)
  const [editingAssumptions, setEditingAssumptions] = useState(false)
  const [editedAssumptions, setEditedAssumptions] = useState<{
    growth_rate_before_retirement: number
    growth_rate_during_retirement: number
    inflation_rate: number
    ssa_start_age: number
  } | null>(null)
  

  // Results
  const [results, setResults] = useState<{
    monthlyRetirementIncome: number
    annualRetirementIncome: number
    confidenceScore: number
    retirementScore: {
      overall: number
      longevity: number
      sustainability: number
      taxEfficiency: number
      inflation: number
      medical: number
      monteCarlo: number
      riskLevel: 'Low' | 'Medium' | 'High'
      details?: {
        longevity: string
        cashflow: string
        taxEfficiency: string
        inflation: string
        medical: string
        monteCarlo: string
      }
    }
    withdrawalRate: number
    status: 'on-track' | 'close' | 'at-risk'
    recommendation: string
    yearsMoneyLasts: number
    biggestRisks: string[]
    improvements: string[]
    lifeExpectancy: number
    legacyValue: number
    legacyInflationRate: number
    legacyCurrentAge: number
    fundsRunOutAge: number | null
    incomeCoverageAtFundsRunOut?: {
      year: number
      age: number
      totalIncome: number
      ssaIncome: number
      otherIncome: number
      expenses: number
      coveragePercentage: number
    }
    calculationDetails?: {
      monthlyIncomeCalculation: string
      confidenceScoreCalculation: string
      yearsMoneyLastsCalculation: string
      statusCalculation: string
      expenseCalculation: string
      legacyValueCalculation: string
    }
  } | null>(null)
  
  // Projections state
  const [showProjections, setShowProjections] = useState(false)
  const [projections, setProjections] = useState<ProjectionDetail[]>([])

  useEffect(() => {
    checkExistingData()
  }, [planId, selectedScenarioId, refreshKey])

  const saveMetrics = async (r: {
    confidenceScore: number
    monthlyRetirementIncome: number
    yearsMoneyLasts: number
    networthAtRetirement: number
    legacyValue: number
    status: string
  }, currentAge: number, retirementAge: number) => {
    if (isLocal) return
    try {
      await supabase.from('rp_plan_metrics').upsert({
        plan_id: planId,
        current_age: currentAge,
        retirement_age: retirementAge,
        confidence_score: r.confidenceScore,
        monthly_income: r.monthlyRetirementIncome,
        years_money_lasts: r.yearsMoneyLasts,
        networth_at_retirement: r.networthAtRetirement,
        legacy_value: r.legacyValue,
        status: r.status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_id' })
    } catch {
      // non-critical — silent fail
    }
  }

  const checkExistingData = async () => {
    try {
      if (isLocal && dataService) {
        const defaults = await dataService.getCalculatorDefaults()
        if (defaults && Object.keys(defaults).length > 0) {
          setHasExistingData(true)
          await loadAndCalculateSnapshot()
        }
        return
      }

      // First check if we have accounts or expenses
      const accountsData = await supabase.from('rp_accounts').select('*').eq('plan_id', planId)
      const hasAccounts = (accountsData.data || []).length > 0
      
      if (hasAccounts) {
        // If we have accounts, try to load scenario and calculate
        if (selectedScenarioId) {
          const settingsData = await supabase
            .from('rp_calculator_settings')
            .select('*')
            .eq('scenario_id', selectedScenarioId)
            .single()
          
          if (settingsData.data) {
            setHasExistingData(true)
            // Keep showQuickStart as true to show results in Simple view
            await loadAndCalculateSnapshot()
            return
          }
        }
        
        // If we have accounts but no scenario selected, try to find default scenario
        const { data: scenarios } = await supabase
          .from('rp_scenarios')
          .select('*')
          .eq('plan_id', planId)
          .order('is_default', { ascending: false })
          .limit(1)
        
        if (scenarios && scenarios.length > 0) {
          setSelectedScenarioId(scenarios[0].id)
          const settingsData = await supabase
            .from('rp_calculator_settings')
            .select('*')
            .eq('scenario_id', scenarios[0].id)
            .single()
          
          if (settingsData.data) {
            setHasExistingData(true)
            // Keep showQuickStart as true to show results in Simple view
            await loadAndCalculateSnapshot()
          }
        }
      }
    } catch (error) {
      console.error('Error checking existing data:', error)
    }
  }

  const loadAndCalculateSnapshot = async (useSSASettings?: { includeSsa: boolean; ssaForTwo: boolean }) => {
    if (!isLocal && !selectedScenarioId) return
    
    setCalculating(true)
    try {
      let planDataObj: any
      let accounts: Account[]
      let expenses: Expense[]
      let otherIncome: OtherIncome[]
      let settingsDataObj: any

      if (isLocal && dataService) {
        const defaults = await dataService.getCalculatorDefaults()
        const a: RetirementAssumptions = { ...DEFAULT_RETIREMENT_ASSUMPTIONS, ...(defaults || {}) } as RetirementAssumptions
        const currentYr = new Date().getFullYear()
        const birthYr = currentYr - a.age
        const ytr = Math.max(0, a.retirementAge - a.age)

        planDataObj = {
          id: 'local',
          plan_name: 'My Plan',
          birth_year: birthYr,
          life_expectancy: a.lifeExpectancy,
          filing_status: a.includeSpouse ? 'Married Filing Jointly' : 'Single',
          include_spouse: a.includeSpouse,
          spouse_birth_year: a.includeSpouse ? currentYr - a.spouseAge : null,
          spouse_life_expectancy: a.includeSpouse ? a.lifeExpectancy : null,
        }
        accounts = [{
          id: 1,
          account_name: 'Retirement Savings',
          owner: 'Planner',
          balance: a.currentSavings,
          account_type: '401k',
          annual_contribution: a.annualContribution,
        }]
        expenses = [{
          id: 1,
          expense_name: 'Living Expenses',
          amount_before_65: a.monthlyExpenses,
          amount_after_65: a.monthlyExpenses,
        }]
        otherIncome = []
        settingsDataObj = {
          current_year: currentYr,
          retirement_age: a.retirementAge,
          retirement_start_year: currentYr + ytr,
          years_to_retirement: ytr,
          annual_retirement_expenses: a.monthlyExpenses * 12,
          growth_rate_before_retirement: a.growthRatePreRetirement / 100,
          growth_rate_during_retirement: a.growthRateDuringRetirement / 100,
          inflation_rate: a.inflationRate / 100,
          planner_ssa_income: a.includeSsa,
          spouse_ssa_income: a.includeSpouse && a.includeSsa,
          ssa_start_age: a.ssaStartAge,
          planner_ssa_annual_benefit: a.ssaAnnualBenefit,
          spouse_ssa_annual_benefit: a.spouseSsaBenefit,
          pre_medicare_annual_premium: a.preMedicareAnnualPremium,
          post_medicare_annual_premium: a.postMedicareAnnualPremium,
          enable_borrowing: false,
        }
      } else {
        const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
          supabase.from('rp_retirement_plans').select('*').eq('id', planId).single(),
          supabase.from('rp_accounts').select('*').eq('plan_id', planId),
          supabase.from('rp_expenses').select('*').eq('plan_id', planId),
          supabase.from('rp_other_income').select('*').eq('plan_id', planId),
          supabase.from('rp_calculator_settings')
            .select('*')
            .eq('scenario_id', selectedScenarioId)
            .single(),
        ])

        if (!planData.data || !settingsData.data) {
          setCalculating(false)
          return
        }
        planDataObj = planData.data
        settingsDataObj = settingsData.data

        accounts = (accountsData.data || []).map(acc => ({
          id: acc.id,
          account_name: acc.account_name,
          owner: acc.owner || 'planner',
          balance: acc.balance || 0,
          account_type: acc.account_type || 'Other',
          annual_contribution: acc.annual_contribution || 0,
        }))

        expenses = (expensesData.data || []).map(exp => ({
          id: exp.id,
          expense_name: exp.expense_name,
          amount_before_65: exp.amount_before_65 || 0,
          amount_after_65: exp.amount_after_65 || 0,
        }))

        otherIncome = (incomeData.data || []).map(inc => ({
          id: inc.id,
          income_name: inc.income_source || '',
          amount: inc.annual_amount || 0,
          start_year: inc.start_year || undefined,
          end_year: inc.end_year || undefined,
          inflation_adjusted: inc.inflation_adjusted || false,
        }))
      }

      const currentYear = new Date().getFullYear()
      const birthYear = planDataObj.birth_year || (currentYear - 50)
      const retirementAge = settingsDataObj.retirement_age || DEFAULT_RETIREMENT_AGE
      const yearsToRetirement = retirementAge - (currentYear - birthYear)
      
      const totalSavings = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      const monthlyExpenses = expenses.reduce((sum, exp) => {
        const amount = retirementAge >= 65 ? (exp.amount_after_65 || 0) : (exp.amount_before_65 || 0)
        return sum + amount
      }, 0)
      const annualExpenses = monthlyExpenses * 12

      // Calculate simple projection - use common helper function to ensure consistency
      const settings = buildCalculatorSettings(
        settingsDataObj,
        planDataObj,
        currentYear,
        retirementAge,
        yearsToRetirement,
        annualExpenses
      )

      // Use provided SSA settings if available, otherwise use database values
      const includePlannerSsa = useSSASettings?.includeSsa ?? ((settingsDataObj.planner_ssa_income as boolean) ?? true)
      
      // Automatically include spouse SSA if:
      // 1. User explicitly set it to true, OR
      // 2. Plan includes spouse (include_spouse = true), OR
      // 3. Filing status is "Married Filing Jointly"
      // Never include for Single filers even if stale DB flag says true
      const explicitSpouseSsa = useSSASettings?.ssaForTwo ?? ((settingsDataObj.spouse_ssa_income as boolean) ?? false)
      const hasSpouse = planDataObj.include_spouse || false
      const isMarriedFilingJointly = planDataObj.filing_status === 'Married Filing Jointly'
      const isSingleFiler = planDataObj.filing_status === 'Single'
      const includeSpouseSsa = !isSingleFiler && (explicitSpouseSsa || hasSpouse || isMarriedFilingJointly)

      // Use explicit benefits when set; else estimate from income; else same defaults as calculator (22k/16k)
      const estimatedIncomeForSsa = Number(settingsDataObj?.estimated_ssa_annual_income) || 0
      const plannerBenefit = settingsDataObj?.planner_ssa_annual_benefit != null ? Number(settingsDataObj.planner_ssa_annual_benefit) : (includePlannerSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, true) : DEFAULT_SSA_ANNUAL_BENEFIT) : 0)
      const spouseBenefit = settingsDataObj?.spouse_ssa_annual_benefit != null ? Number(settingsDataObj.spouse_ssa_annual_benefit) : (includeSpouseSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, false) : DEFAULT_SPOUSE_SSA_BENEFIT) : 0)
      const baseEstimatedPlannerSsa = includePlannerSsa ? plannerBenefit : 0
      const baseEstimatedSpouseSsa = includeSpouseSsa ? spouseBenefit : 0
      
      // Adjust for inflation from current year to SSA start age
      // IMPORTANT: Use settings.current_year to match what the projection function uses
      const ssaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
      const projectionCurrentYear = settings.current_year || currentYear
      const projectionCurrentAge = projectionCurrentYear - birthYear
      const yearsToSsaStart = Math.max(0, ssaStartAge - projectionCurrentAge)
      const inflationToSsaStart = Math.pow(1 + settings.inflation_rate, yearsToSsaStart)

      // Spouse may be a different age; compute their own horizon so their benefit is
      // inflated correctly rather than using the planner's years-to-SSA-start.
      const spouseBirthYearForSsa = planDataObj.spouse_birth_year
      const spouseCurrentAge = spouseBirthYearForSsa ? projectionCurrentYear - spouseBirthYearForSsa : null
      const spouseYearsToSsaStart = spouseCurrentAge !== null
        ? Math.max(0, ssaStartAge - spouseCurrentAge)
        : yearsToSsaStart
      const spouseInflationToSsaStart = Math.pow(1 + settings.inflation_rate, spouseYearsToSsaStart)

      // Estimated SSA at start age (inflation-adjusted from today to start age)
      const estimatedPlannerSsaAtStart = includePlannerSsa ? baseEstimatedPlannerSsa * inflationToSsaStart : undefined
      const estimatedSpouseSsaAtStart = includeSpouseSsa ? baseEstimatedSpouseSsa * spouseInflationToSsaStart : undefined

      const projections = calculateRetirementProjections(
        birthYear,
        accounts,
        expenses,
        otherIncome,
        settings,
        planDataObj.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
        planDataObj.spouse_birth_year || undefined,
        planDataObj.spouse_life_expectancy || undefined,
        includePlannerSsa,
        includeSpouseSsa,
        estimatedPlannerSsaAtStart,
        estimatedSpouseSsaAtStart
      )

      // Calculate snapshot results
      const snapshotResults = calculateSnapshotResults(projections, totalSavings, annualExpenses, yearsToRetirement, settings, accounts, planDataObj.life_expectancy || DEFAULT_LIFE_EXPECTANCY)
      setResults(snapshotResults)
      setProjections(projections)
      saveMetrics(snapshotResults, currentYear - birthYear, retirementAge)

      // Run Monte Carlo silently in the background to compute the real Market Risk score.
      // Use setTimeout so the initial results render first before the CPU-heavy simulation runs.
      setMcRunning(true)
      setTimeout(() => {
        try {
          const { summary } = runMonteCarloSimulation(
            birthYear,
            accounts,
            expenses,
            otherIncome,
            settings,
            planDataObj.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
            1000,
            planDataObj.spouse_birth_year || undefined,
            planDataObj.spouse_life_expectancy || undefined,
            includePlannerSsa,
            includeSpouseSsa,
            estimatedPlannerSsaAtStart,
            estimatedSpouseSsaAtStart
          )
          const updatedScore = calculateRetirementScore(projections, settings, accounts, summary.successRate)
          setResults(prev => prev ? { ...prev, retirementScore: updatedScore } : prev)
        } catch (e) {
          console.error('Snapshot MC error:', e)
        } finally {
          setMcRunning(false)
        }
      }, 50)

      if (isLocal && dataService) {
        await dataService.saveProjections(projections)
      }
      
      // Store data for tooltip (merge SSA + healthcare from DB for banner and display)
      const settingsWithSsa = {
        ...settings,
        planner_ssa_income: settingsDataObj?.planner_ssa_income ?? true,
        spouse_ssa_income: settingsDataObj?.spouse_ssa_income ?? false,
        estimated_ssa_annual_income: settingsDataObj?.estimated_ssa_annual_income ?? 0,
        planner_ssa_annual_benefit: settingsDataObj?.planner_ssa_annual_benefit,
        spouse_ssa_annual_benefit: settingsDataObj?.spouse_ssa_annual_benefit,
        pre_medicare_annual_premium: settingsDataObj?.pre_medicare_annual_premium,
        post_medicare_annual_premium: settingsDataObj?.post_medicare_annual_premium,
      } as CalculatorSettings & {
        planner_ssa_income?: boolean
        spouse_ssa_income?: boolean
        estimated_ssa_annual_income?: number
        planner_ssa_annual_benefit?: number
        spouse_ssa_annual_benefit?: number
        pre_medicare_annual_premium?: number
        post_medicare_annual_premium?: number
      }
      setPlanDataForTooltip(planDataObj)
      setAccountsForTooltip(accounts)
      setExpensesForTooltip(expenses)
      setOtherIncomeForTooltip(otherIncome)
      setSettingsForTooltip(settingsWithSsa)
    } catch (error) {
      console.error('Error calculating snapshot:', error)
    } finally {
      setCalculating(false)
    }
  }


  const calculateSnapshotResults = (
    projections: ProjectionDetail[],
    currentSavings: number,
    annualExpenses: number,
    yearsToRetirement: number,
    settings: CalculatorSettings,
    accounts: Account[],
    lifeExpectancy: number = 90
  ) => {
    const retirementProjections = projections.filter(p => p.age >= settings.retirement_age)
    
    if (retirementProjections.length === 0) {
      return {
        monthlyRetirementIncome: 0,
        annualRetirementIncome: 0,
        confidenceScore: 0,
        retirementScore: { overall: 0, longevity: 0, sustainability: 0, taxEfficiency: 0, inflation: 0, medical: 0, monteCarlo: 50, riskLevel: 'High' as const },
        withdrawalRate: 0,
        status: 'at-risk' as const,
        recommendation: 'Please complete your plan details to see projections.',
        yearsMoneyLasts: 0,
        biggestRisks: ['Incomplete plan data'],
        improvements: ['Add your accounts and expenses'],
        lifeExpectancy,
        networthAtRetirement: 0,
        legacyValue: 0,
        legacyInflationRate: 0.03,
        legacyCurrentAge: 0,
        fundsRunOutAge: null,
        incomeCoverageAtFundsRunOut: undefined,
        calculationDetails: {
          monthlyIncomeCalculation: 'No projections available. Please complete your plan details.',
          confidenceScoreCalculation: 'No projections available. Please complete your plan details.',
          yearsMoneyLastsCalculation: 'No projections available. Please complete your plan details.',
          statusCalculation: 'No projections available. Please complete your plan details.',
          expenseCalculation: 'No projections available. Please complete your plan details.',
          legacyValueCalculation: 'No projections available. Please complete your plan details.',
        },
      }
    }

    // Estimated income at start of retirement = first year's after-tax income
    const firstRetirementYearProj = retirementProjections[0]
    const firstYearAfterTaxIncome = firstRetirementYearProj?.after_tax_income ?? 0
    const avgMonthlyIncome = firstYearAfterTaxIncome / 12

    // Find when money runs out - first year with negative networth
    // Don't use gap_excess as it can have small negative values due to rounding
    const retirementAge = settings.retirement_age
    let yearsMoneyLasts = 0
    let fundsRunOutAge: number | null = null
    
    for (let i = 0; i < retirementProjections.length; i++) {
      const proj = retirementProjections[i]
      const networth = proj.networth || 0
      const age = proj.age || (retirementAge + i)
      
      // If networth is negative, funds have run out
      if (networth <= 0) {
        // Money ran out - calculate years from retirement start
        fundsRunOutAge = age
        yearsMoneyLasts = i + 1 // Add 1 because i is 0-indexed, and we want years from retirement start
        break
      }
    }
    
    // Calculate income coverage at funds run out
    let incomeCoverageAtFundsRunOut: {
      year: number
      age: number
      totalIncome: number
      ssaIncome: number
      otherIncome: number
      expenses: number
      coveragePercentage: number
    } | undefined = undefined

    if (fundsRunOutAge !== null) {
      // Find the projection when funds run out
      const projectionAtRunOut = retirementProjections.find(p => p.age === fundsRunOutAge)
      if (projectionAtRunOut) {
        const totalIncome = (projectionAtRunOut.ssa_income || 0) + (projectionAtRunOut.other_recurring_income || 0)
        const ssaIncome = projectionAtRunOut.ssa_income || 0
        const otherIncome = projectionAtRunOut.other_recurring_income || 0
        const expenses = projectionAtRunOut.total_expenses || projectionAtRunOut.living_expenses || 0
        const coveragePercentage = expenses > 0 ? (totalIncome / expenses) * 100 : 0

        incomeCoverageAtFundsRunOut = {
          year: projectionAtRunOut.year,
          age: projectionAtRunOut.age || fundsRunOutAge,
          totalIncome,
          ssaIncome,
          otherIncome,
          expenses,
          coveragePercentage,
        }
      }
    }

    // Check if income (SSA + other) covers at least 60% of expenses throughout retirement
    const lowIncomeCoverageYears = retirementProjections.filter(p => {
      const totalIncome = (p.ssa_income || 0) + (p.other_recurring_income || 0)
      const expenses = p.total_expenses || p.living_expenses || 0
      const coveragePercentage = expenses > 0 ? (totalIncome / expenses) * 100 : 0
      return coveragePercentage < 60
    })

    // If we never found a failure point, money lasts until life expectancy or beyond
    if (fundsRunOutAge === null) {
      // Count actual retirement projection years with positive networth
      // This gives us the actual number of years money lasts from retirement start
      let lastPositiveYearIndex = -1
      for (let i = retirementProjections.length - 1; i >= 0; i--) {
        const proj = retirementProjections[i]
        if ((proj.networth || 0) >= -100) {
          lastPositiveYearIndex = i
          break
        }
      }
      
      if (lastPositiveYearIndex >= 0) {
        const lastPositiveProj = retirementProjections[lastPositiveYearIndex]
        const lastPositiveAge = lastPositiveProj.age || (retirementAge + lastPositiveYearIndex)
        
        // Check if we have projections up to life expectancy
        const projectionAtLifeExpectancy = retirementProjections.find(p => p.age === lifeExpectancy)
        if (projectionAtLifeExpectancy && lastPositiveAge >= lifeExpectancy) {
          // Money lasts at least until life expectancy
          fundsRunOutAge = null // null means it lasts beyond/until life expectancy
          // Count years from retirement start (age) to life expectancy
          // If retirement starts at age 54 and life expectancy is 90, that's 36 years (90 - 54)
          // But we need to count the actual projection years, so use the index
          const lifeExpectancyIndex = retirementProjections.findIndex(p => p.age === lifeExpectancy)
          if (lifeExpectancyIndex >= 0) {
            yearsMoneyLasts = lifeExpectancyIndex + 1 // +1 because index is 0-based
          } else {
            // If exact age not found, calculate from ages
            yearsMoneyLasts = lifeExpectancy - retirementAge
          }
        } else {
          // Money lasts until the last positive projection
          fundsRunOutAge = null
          yearsMoneyLasts = lastPositiveYearIndex + 1 // +1 because index is 0-based
        }
      } else {
        // All projections are negative - money doesn't last
        yearsMoneyLasts = 1
        fundsRunOutAge = retirementAge
      }
    }

    // Calculate legacy value
    // If funds last until life expectancy or beyond, show networth at life expectancy
    // Otherwise, show networth when funds run out (should be 0 or negative)
    let legacyValue = 0
    if (fundsRunOutAge === null || fundsRunOutAge >= lifeExpectancy) {
      // Funds last until or beyond life expectancy - show networth at life expectancy
      const ageAtLifeExpectancy = lifeExpectancy
      const projectionAtLifeExpectancy = retirementProjections.find(p => p.age === ageAtLifeExpectancy)
      if (projectionAtLifeExpectancy) {
        legacyValue = projectionAtLifeExpectancy.networth || 0
      } else {
        // Find closest projection
        const closestProj = retirementProjections.reduce((closest, p) => {
          const closestDiff = Math.abs(closest.age - ageAtLifeExpectancy)
          const currentDiff = Math.abs(p.age - ageAtLifeExpectancy)
          return currentDiff < closestDiff ? p : closest
        })
        legacyValue = closestProj.networth || 0
      }
    } else {
      // Funds run out before life expectancy - legacy value is 0 (or negative if we're showing when it goes negative)
      legacyValue = 0
    }

    // Calculate confidence score (0-100)
    const totalYears = retirementProjections.length
    const yearsWithShortfall = retirementProjections.filter(p => (p.gap_excess || 0) < -1000).length
    const shortfallRatio = yearsWithShortfall / totalYears
    const confidenceScore = Math.max(0, Math.min(100, Math.round((1 - shortfallRatio) * 100)))

    // Determine status
    let status: 'on-track' | 'close' | 'at-risk'
    if (confidenceScore >= SCORE_ON_TRACK_THRESHOLD) {
      status = 'on-track'
    } else if (confidenceScore >= SCORE_CLOSE_THRESHOLD) {
      status = 'close'
    } else {
      status = 'at-risk'
    }

    // Generate recommendation
    let recommendation = ''
    const avgGap = retirementProjections.reduce((sum, p) => sum + (p.gap_excess || 0), 0) / retirementProjections.length
    if (avgGap > 10000) {
      recommendation = "You're in great shape! Your plan looks solid."
    } else if (avgGap > 0) {
      recommendation = "You're on track! Your plan is working well for you."
    } else if (avgGap > -5000) {
      recommendation = "You're close, but may face a shortfall. See improvements below."
    } else {
      recommendation = "Your plan needs adjustment. See improvements below."
    }

    // Identify biggest risks with actual numbers from plan data
    const risks: string[] = []
    // Show enough decimal places so a "4.02%" rate doesn't look identical to the "4%" threshold
    const fmtWr = (r: number) => parseFloat(r.toFixed(2)).toString()
    
    // Calculate key metrics for risk assessment
    const firstYearExpenses = retirementProjections[0]?.total_expenses || retirementProjections[0]?.living_expenses || annualExpenses
    // Use the first retirement year's net worth as the denominator so the displayed SWR is
    // directly verifiable from the numbers the user sees in the projection table.
    // (First-retirement-row net worth = portfolio after that year's growth and withdrawals,
    // which is the value printed in the "Networth" column at retirement start.)
    const startingNetworth = (retirementProjections[0]?.networth || currentSavings) > 0
      ? retirementProjections[0]?.networth || currentSavings
      : currentSavings
    const withdrawalRate = startingNetworth > 0 ? (firstYearExpenses / startingNetworth) * 100 : 0
    const growthRateDuring = (settings.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT) * 100
    const inflationRate = (settings.inflation_rate || DEFAULT_INFLATION_RATE) * 100
    
    // Calculate account balances at retirement
    const firstYearProj = retirementProjections[0]
    const balance401k = firstYearProj?.balance_401k || 0
    const balanceRoth = firstYearProj?.balance_roth || 0
    const balanceInvestment = firstYearProj?.balance_investment || 0
    const totalBalance = balance401k + balanceRoth + balanceInvestment
    const taxDeferredRatio = totalBalance > 0 ? (balance401k / totalBalance) * 100 : 0
    
    // Calculate total shortfall amount if applicable
    const totalShortfall = retirementProjections.reduce((sum, p) => {
      const gap = p.gap_excess || 0
      return sum + (gap < 0 ? Math.abs(gap) : 0)
    }, 0)
    
    // Calculate years of retirement
    const retirementYears = lifeExpectancy - settings.retirement_age
    
    // Risk: Money runs out before life expectancy
    if (fundsRunOutAge !== null && fundsRunOutAge < lifeExpectancy) {
      const yearsShort = lifeExpectancy - fundsRunOutAge
      risks.push(`Assets depleted ${yearsShort} years before life expectancy (age ${fundsRunOutAge})`)
    } else if (yearsMoneyLasts < retirementYears * 0.8) {
      risks.push(`Plan covers only ${yearsMoneyLasts} of ${retirementYears} retirement years`)
    }
    
    // Risk: High withdrawal rate (only flag when meaningfully above the safe zone)
    if (withdrawalRate > 5.5) {
      risks.push(`High withdrawal rate of ${fmtWr(withdrawalRate)}% — well above the recommended 4% safe limit`)
    } else if (withdrawalRate > 4.5) {
      risks.push(`Withdrawal rate of ${fmtWr(withdrawalRate)}% is approaching the upper safe limit (4%)`)
    }
    
    // Risk: Heavy reliance on tax-deferred accounts (RMD risk)
    if (taxDeferredRatio > 70 && balance401k > 500000) {
      risks.push(`${taxDeferredRatio.toFixed(0)}% of assets in tax-deferred accounts - RMD taxes may be significant`)
    }
    
    // Risk: Frequent income shortfalls
    if (shortfallRatio > 0.3 && totalShortfall > 0) {
      const avgShortfallPerYear = totalShortfall / yearsWithShortfall
      risks.push(`Income shortfall in ${yearsWithShortfall} years (avg $${avgShortfallPerYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year)`)
    } else if (shortfallRatio > 0.15 && totalShortfall > 0) {
      risks.push(`Moderate income gaps in ${yearsWithShortfall} of ${totalYears} retirement years`)
    }
    
    // Risk: Low income coverage (SSA + other income vs expenses)
    if (lowIncomeCoverageYears.length > 0) {
      const avgCoverage = lowIncomeCoverageYears.reduce((sum, p) => {
        const totalIncome = (p.ssa_income || 0) + (p.other_recurring_income || 0)
        const expenses = p.total_expenses || p.living_expenses || 0
        return sum + (expenses > 0 ? (totalIncome / expenses) * 100 : 0)
      }, 0) / lowIncomeCoverageYears.length
      if (avgCoverage < 40) {
        risks.push(`SSA + other income cover an average of ${avgCoverage.toFixed(0)}% of projected expenses across retirement years — heavy reliance on portfolio withdrawals`)
      } else {
        risks.push(`SSA + other income cover an average of ${avgCoverage.toFixed(0)}% of projected expenses across ${lowIncomeCoverageYears.length} retirement year${lowIncomeCoverageYears.length > 1 ? 's' : ''} (inflation widens the gap over time)`)
      }
    }
    
    // Risk: Near-term retirement with insufficient savings
    if (yearsToRetirement < 10 && currentSavings < annualExpenses * 10) {
      const savingsYears = currentSavings / annualExpenses
      risks.push(`Only ${savingsYears.toFixed(1)} years of expenses saved with ${yearsToRetirement} years to retirement`)
    }
    
    // Risk: Aggressive growth assumptions
    if (growthRateDuring > 7) {
      risks.push(`Aggressive growth assumption of ${growthRateDuring.toFixed(1)}% during retirement`)
    }
    
    // Risk: Low growth vs inflation
    if (growthRateDuring - inflationRate < 1) {
      risks.push(`Real return of ${(growthRateDuring - inflationRate).toFixed(1)}% may not outpace inflation`)
    }
    
    // Limit to top 3-4 most relevant risks
    if (risks.length === 0) {
      // Provide context-aware low-risk messages
      if (legacyValue > 1000000) {
        risks.push(`Strong position with $${(legacyValue/1000000).toFixed(1)}M legacy value - consider Roth conversions for tax efficiency`)
      } else {
        risks.push('Market volatility could temporarily impact portfolio value')
      }
    }
    
    // Keep only top 4 risks
    const topRisks = risks.slice(0, 4)

    // Suggest improvements based on actual plan metrics
    const improvements: string[] = []
    
    // Calculate specific improvement metrics
    const monthlyContributionNeeded = avgGap < 0 ? Math.abs(avgGap) / 12 * 0.3 : 0
    
    // Primary improvement based on financial status
    if (fundsRunOutAge !== null && fundsRunOutAge < lifeExpectancy) {
      const yearsShort = lifeExpectancy - fundsRunOutAge
      const additionalNeeded = yearsShort * firstYearExpenses * 0.5 // rough estimate accounting for returns
      if (yearsToRetirement > 5) {
        const monthlyExtra = additionalNeeded / (yearsToRetirement * 12)
        improvements.push(`Increase monthly savings by $${monthlyExtra.toLocaleString(undefined, { maximumFractionDigits: 0 })} to close the ${yearsShort}-year gap`)
      } else if (yearsToRetirement > 0) {
        improvements.push(`Consider delaying retirement by ${Math.min(yearsShort, 5)} years to build sufficient savings`)
      }
    } else if (avgGap < 0 && monthlyContributionNeeded > 0) {
      improvements.push(`Increase monthly savings by $${Math.round(monthlyContributionNeeded).toLocaleString(undefined, { maximumFractionDigits: 0 })} to eliminate income gaps`)
    } else if (confidenceScore >= SCORE_ON_TRACK_THRESHOLD && yearsToRetirement > 0) {
      const extraMonthly = Math.round(currentSavings * 0.001) // 0.1% of savings as extra monthly
      improvements.push(`You're on track! Consider $${extraMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month extra for additional cushion`)
    }
    
    // Tax optimization based on account distribution
    if (taxDeferredRatio > 50 && yearsToRetirement > 5) {
      improvements.push(`Consider Roth conversions - ${taxDeferredRatio.toFixed(0)}% of assets will face RMDs`)
    } else if (balanceRoth < balance401k * 0.2 && yearsToRetirement > 10) {
      improvements.push('Build Roth balance for tax-free retirement income flexibility')
    } else {
      improvements.push('Review withdrawal order strategy for tax efficiency')
    }
    
    // Withdrawal rate improvement
    if (withdrawalRate > 4.5) {
      const expenseReduction = firstYearExpenses - (startingNetworth * SAFE_WITHDRAWAL_RATE)
      if (expenseReduction > 0) {
        improvements.push(`Reduce annual expenses by $${expenseReduction.toLocaleString(undefined, { maximumFractionDigits: 0 })} to reach 4% withdrawal rate`)
      }
    }
    
    // Growth rate adjustment if too aggressive
    if (growthRateDuring > 7) {
      improvements.push('Consider conservative growth assumptions (5-6%) for retirement projections')
    }
    
    // SSA optimization
    if (settings.ssa_start_age && settings.ssa_start_age < SSA_FULL_RETIREMENT_AGE) {
      improvements.push(`Delaying Social Security to age ${SSA_FULL_RETIREMENT_AGE}+ increases benefits by ~8% per year`)
    }
    
    // Additional suggestions based on situation
    if (yearsToRetirement > 5 && currentSavings < annualExpenses * 15) {
      improvements.push('Maximize employer 401(k) match if available')
    }
    
    // Keep only top 4 improvements
    const topImprovements = improvements.slice(0, 4)

    // Build calculation details for tooltips
    const annualIncomeAtRetirementStart = firstYearAfterTaxIncome

    // Calculate expense details for tooltip
    const firstRetirementYear = retirementProjections[0]
    const firstYearLivingExpenses = firstRetirementYear?.living_expenses || 0
    const currentYearExpenses = annualExpenses
    const inflationRateDecimal = settings.inflation_rate || DEFAULT_INFLATION_RATE
    const expensesAtRetirementStart = currentYearExpenses * Math.pow(1 + inflationRateDecimal, yearsToRetirement)
    const legacyValueCalculation = (() => {
      if (fundsRunOutAge === null || fundsRunOutAge >= lifeExpectancy) {
        const projectionAtLifeExpectancy = retirementProjections.find(p => p.age === lifeExpectancy)
        const networthAtLifeExpectancy = projectionAtLifeExpectancy?.networth || 0
        return `Legacy Value = Networth at Life Expectancy\n\nLife Expectancy: Age ${lifeExpectancy}\nNetworth at Age ${lifeExpectancy}: $${networthAtLifeExpectancy.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\nThis is the estimated value of your remaining assets at your life expectancy.`
      } else {
        return `Legacy Value = $0 (Funds exhausted before life expectancy)\n\nFunds run out at age: ${fundsRunOutAge}\nLife Expectancy: Age ${lifeExpectancy}\n\nSince funds are exhausted before life expectancy, there is no legacy value.`
      }
    })()
    
    const calculationDetails = {
      monthlyIncomeCalculation: `Estimated income at retirement = first year of retirement after-tax income\n\nFirst year annual (after-tax): $${annualIncomeAtRetirementStart.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nMonthly = Annual ÷ 12: $${Math.round(avgMonthlyIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\nThis is your estimated after-tax income at the start of retirement (first year).`,
      confidenceScoreCalculation: `Plan Viability Score = (1 - Shortfall Ratio) × 100\n\nTotal retirement years: ${totalYears}\nYears with shortfall (gap < -$1,000): ${yearsWithShortfall}\nShortfall ratio: ${(shortfallRatio * 100).toFixed(2)}%\n\nPlan Viability Score: ${confidenceScore}%\n\n⚠️ This score is deterministic — it assumes your configured return rate holds every year with no volatility. A score of 100% means your plan is fully funded under steady returns, not that it is guaranteed.\n\nFor a probability-weighted view that accounts for market ups and downs, run the Monte Carlo simulation in the Analysis tab.`,
      yearsMoneyLastsCalculation: (() => {
        const retirementAge = settings.retirement_age
        if (fundsRunOutAge) {
          const finalProj = retirementProjections.find(p => p.age === fundsRunOutAge)
          const finalNetworth = finalProj?.networth || 0
          return `Years money lasts = Number of retirement years until funds are exhausted\n\nRetirement Age: ${retirementAge}\nFunds Run Out Age: ${fundsRunOutAge}\nYears Money Lasts: ${yearsMoneyLasts} years (from age ${retirementAge} to age ${fundsRunOutAge})\nNetworth when funds run out: $${finalNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nLife Expectancy: Age ${lifeExpectancy}\n\nThis shows how long your savings will last from the start of retirement. If funds run out before life expectancy, you may face a shortfall.`
        } else {
          const projectionAtLifeExpectancy = retirementProjections.find(p => p.age === lifeExpectancy)
          const networthAtLifeExpectancy = projectionAtLifeExpectancy?.networth || 0
          return `Full Plan - Assets last beyond life expectancy\n\nRetirement Age: ${retirementAge}\nLife Expectancy: Age ${lifeExpectancy}\nNetworth at Life Expectancy: $${networthAtLifeExpectancy.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\nYour plan is fully funded. Assets will last beyond your life expectancy with an estimated $${networthAtLifeExpectancy.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining at age ${lifeExpectancy}.`
        }
      })(),
      statusCalculation: `Status is determined by the Retirement Score:\n\n• On Track: Score ≥ 80%\n• Close: Score 60-79%\n• At Risk: Score < 60%\n\nYour score: ${confidenceScore}%\nYour status: ${status === 'on-track' ? 'On Track' : status === 'close' ? 'Close' : 'At Risk'}\n\n⚠️ This uses deterministic (flat-return) projections. Run Monte Carlo in the Analysis tab for a probability-weighted success rate.`,
      expenseCalculation: `Expense Calculation at Retirement Start:\n\nCurrent Year Expenses: $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\nYears to Retirement: ${yearsToRetirement}\nInflation Rate: ${(inflationRateDecimal * 100).toFixed(2)}%\n\nExpenses at Retirement Start = Current Expenses × (1 + Inflation Rate)^Years to Retirement\nExpenses at Retirement Start = $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} × (1 + ${(inflationRateDecimal * 100).toFixed(2)}%)^${yearsToRetirement}\nExpenses at Retirement Start = $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${Math.pow(1 + inflationRateDecimal, yearsToRetirement).toFixed(4)}\nExpenses at Retirement Start = $${Math.round(expensesAtRetirementStart).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\n\nFirst Year Retirement Expenses: $${Math.round(firstYearLivingExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\n\nExpenses continue to inflate each year after retirement at ${(inflationRateDecimal * 100).toFixed(2)}% per year.`,
      legacyValueCalculation,
    }

    const networthAtRetirement = retirementProjections[0]?.networth ?? 0

    // Compute the same multi-dimensional retirement score shown in Risk Analysis
    const retirementScore = calculateRetirementScore(projections, settings, accounts)

    return {
      monthlyRetirementIncome: Math.round(avgMonthlyIncome),
      annualRetirementIncome: Math.round(avgMonthlyIncome * 12),
      confidenceScore,
      retirementScore,
      withdrawalRate,
      status,
      recommendation,
      yearsMoneyLasts: Math.round(yearsMoneyLasts),
      biggestRisks: topRisks,
      improvements: topImprovements,
      lifeExpectancy,
      networthAtRetirement: Math.round(networthAtRetirement),
      legacyValue: Math.round(legacyValue),
      legacyInflationRate: settings.inflation_rate || DEFAULT_INFLATION_RATE,
      legacyCurrentAge: settings.retirement_age - (settings.years_to_retirement ?? (settings.retirement_age - 50)),
      fundsRunOutAge,
      incomeCoverageAtFundsRunOut,
      calculationDetails,
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading your retirement snapshot...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`rounded-md p-4 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{message.text}</p>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Plan Inputs Banner (all assumptions); hidden in local mode since calculator shows this ── */}
      {!isLocal && (() => {
        const currentYear = new Date().getFullYear()
        const age = results && planDataForTooltip?.birth_year
          ? currentYear - planDataForTooltip.birth_year
          : DEFAULT_AGE
        const retireAt = results && settingsForTooltip ? settingsForTooltip.retirement_age : DEFAULT_RETIREMENT_AGE
        const totalSaved = results
          ? accountsForTooltip.reduce((s, a) => s + (a.balance ?? 0), 0)
          : DEFAULT_CURRENT_SAVINGS
        const annualContrib = results
          ? accountsForTooltip.reduce((s, a) => s + (a.annual_contribution ?? 0), 0)
          : DEFAULT_ANNUAL_CONTRIBUTION
        const annualSpend = results
          ? expensesForTooltip.reduce((s, e) => s + ((retireAt >= 65 ? e.amount_after_65 : e.amount_before_65) ?? 0), 0) * 12
          : DEFAULT_MONTHLY_EXPENSES * 12
        const filing = (results ? planDataForTooltip?.filing_status : 'Single') as string | undefined
        const growthPre  = results && settingsForTooltip ? +(settingsForTooltip.growth_rate_before_retirement * 100).toFixed(1) : DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT
        const growthPost = results && settingsForTooltip ? +(settingsForTooltip.growth_rate_during_retirement * 100).toFixed(1) : DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT
        const inflation  = results && settingsForTooltip ? +(settingsForTooltip.inflation_rate * 100).toFixed(1) : DEFAULT_INFLATION_RATE_PCT
        const lifeExp = results && planDataForTooltip?.life_expectancy != null ? planDataForTooltip.life_expectancy : DEFAULT_LIFE_EXPECTANCY
        const yrsToRetire = results && settingsForTooltip ? settingsForTooltip.years_to_retirement : Math.max(0, retireAt - age)
        const ssaStart = results && settingsForTooltip?.ssa_start_age != null ? settingsForTooltip.ssa_start_age : retireAt
        const st = settingsForTooltip as (CalculatorSettings & { planner_ssa_income?: boolean; spouse_ssa_income?: boolean; planner_ssa_annual_benefit?: number; spouse_ssa_annual_benefit?: number; estimated_ssa_annual_income?: number; pre_medicare_annual_premium?: number; post_medicare_annual_premium?: number }) | null
        const plannerSsa = st?.planner_ssa_income ?? true
        // Mirror the same auto-include logic used in loadAndCalculateSnapshot (lines 397-401).
        // spouse_ssa_income in rp_calculator_settings may be stale (e.g. was false when plan was
        // created as Single, but user has since updated include_spouse / filing_status in Plan Setup).
        const explicitSpouseSsaDisplay = st?.spouse_ssa_income ?? false
        const hasSpouseDisplay = planDataForTooltip?.include_spouse || false
        const isMfjDisplay = planDataForTooltip?.filing_status === 'Married Filing Jointly'
        const isSingleFilerDisplay = planDataForTooltip?.filing_status === 'Single'
        const spouseSsa = !isSingleFilerDisplay && (explicitSpouseSsaDisplay || hasSpouseDisplay || isMfjDisplay)
        const plannerSsaBenefit = st?.planner_ssa_annual_benefit
        // If no explicit benefit is stored but spouse SSA is now auto-included, fall back to the same
        // default that the projection engine uses so the banner and the chart stay consistent.
        const estimatedIncomeForSsaDisplay = Number(st?.estimated_ssa_annual_income) || 0
        const spouseSsaBenefit: number | null = st?.spouse_ssa_annual_benefit != null
          ? Number(st.spouse_ssa_annual_benefit)
          : spouseSsa
            ? (estimatedIncomeForSsaDisplay > 0 ? calculateEstimatedSSA(estimatedIncomeForSsaDisplay, false) : DEFAULT_SPOUSE_SSA_BENEFIT)
            : null
        const preMedicare = st?.pre_medicare_annual_premium
        const postMedicare = st?.post_medicare_annual_premium

        const fmt = (n: number) =>
          n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
          : n >= 1_000   ? `$${Math.round(n / 1_000)}k`
          : `$${n}`

        const plannerSsaLabel = plannerSsa
          ? (plannerSsaBenefit != null ? `at ${ssaStart}: ${fmt(plannerSsaBenefit)}/yr` : `at ${ssaStart}`)
          : 'No'
        const spouseSsaLabel = spouseSsa && spouseSsaBenefit != null ? `${fmt(spouseSsaBenefit)}/yr` : (spouseSsa ? 'Yes' : 'No')

        return (
          <div className="space-y-2">
            {/* Mobile: show button when banner is collapsed */}
            <button
              type="button"
              onClick={() => setShowBannerOnMobile(true)}
              className="md:hidden w-full flex items-center justify-center gap-2 rounded-xl border bg-muted/30 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              style={{ display: showBannerOnMobile ? 'none' : undefined }}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Show Plan Assumptions
              <ChevronDown className="h-4 w-4" />
            </button>
            {/* Banner: visible on md+ always; on mobile when expanded */}
            <div className={`rounded-xl border bg-muted/30 px-5 py-3 space-y-2 ${showBannerOnMobile ? 'block' : 'hidden md:block'}`}>
            {/* Line 1: Plan basis only */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <div>
                  <span className="text-muted-foreground">Age</span>
                  <span className="ml-1.5 font-semibold">{age}</span>
                </div>
                {filing && (
                  <div>
                    <span className="text-muted-foreground">Filing</span>
                    <span className="ml-1.5 font-semibold">{filing}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Saved</span>
                  <span className="ml-1.5 font-semibold">{fmt(totalSaved)}</span>
                </div>
                {annualContrib > 0 && (
                  <div>
                    <span className="text-muted-foreground">Contributing</span>
                    <span className="ml-1.5 font-semibold">{fmt(annualContrib)}/yr</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Living expenses</span>
                  <span className="ml-1.5 font-semibold">{fmt(annualSpend)}/yr</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Retire at</span>
                  <span className="ml-1.5 font-semibold">{retireAt}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Life exp.</span>
                  <span className="ml-1.5 font-semibold">{lifeExp}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Yrs to retire</span>
                  <span className="ml-1.5 font-semibold">{yrsToRetire}</span>
                </div>
              </div>
              {!planDataForTooltip && (
                <div className="ml-auto">
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">Quick estimate</Badge>
                </div>
              )}
            </div>

            {/* Line 2: Pre-ret / In-ret / Inflation + SSA & healthcare */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm border-t border-border/60 pt-2">
              {(results ? settingsForTooltip : true) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="text-muted-foreground">Pre-ret.</span>
                    <span className="font-semibold">{growthPre}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">In-ret.</span>
                    <span className="ml-1.5 font-semibold">{growthPost}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Inflation</span>
                    <span className="ml-1.5 font-semibold">{inflation}%</span>
                  </div>
                </div>
              )}
              {results && st && (
                <>
                  {(results ? settingsForTooltip : true) && <span className="hidden sm:block h-4 w-px bg-border" />}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <div>
                      <span className="text-muted-foreground">Planner SSA</span>
                      <span className="ml-1.5 font-semibold">{plannerSsaLabel}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Spouse SSA</span>
                      <span className="ml-1.5 font-semibold">{spouseSsaLabel}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Healthcare (Pre-65):</span>
                      <span className="font-semibold">{preMedicare != null && preMedicare > 0 ? fmt(preMedicare) + '/yr' : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Healthcare (65+):</span>
                      <span className="font-semibold">{postMedicare != null && postMedicare > 0 ? fmt(postMedicare) + '/yr' : '—'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
            {/* Mobile: collapse button when banner is expanded */}
            {showBannerOnMobile && (
              <button
                type="button"
                onClick={() => setShowBannerOnMobile(false)}
                className="md:hidden w-full flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Plan Assumptions
              </button>
            )}
          </div>
        )
      })()}
          {/* Plan Inputs form (same as calculator assumptions) */}

      {showQuickStart ? (
        <>
          {!results && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
              {calculating ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="mt-4 text-gray-600">Loading your retirement snapshot...</p>
                </>
              ) : (
                <p className="text-gray-600">No snapshot data yet. Set up accounts and expenses in Plan Details to see your quick summary here.</p>
              )}
            </div>
          )}

          {/* Results Snapshot */}
          {results && (
            <>
              {/* Plan Health & Income */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-8">
                {/* Calculator Icon with Tooltip */}
                <div className="flex justify-end mb-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="cursor-help p-2 rounded-full hover:bg-blue-100 transition-colors">
                          <Calculator className="h-8 w-8 text-blue-600" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-2xl bg-gray-900 text-gray-100 border border-gray-700 p-4">
                        <div className="text-xs space-y-3">
                          {(() => {
                            const currentYear = new Date().getFullYear()
                            const birthYear = planDataForTooltip?.birth_year || 0
                            const currentAge = birthYear ? currentYear - birthYear : 0
                            const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                            const lifeExpectancy = planDataForTooltip?.life_expectancy || DEFAULT_LIFE_EXPECTANCY
                            const finalProjection = projections[projections.length - 1]
                            const finalAge = finalProjection?.age || 0
                            const zeroNetworthYear = projections.findIndex(p => (p.networth || 0) <= 0)
                            const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projections[zeroNetworthYear]?.age || 0) : finalAge
                            
                            const totalAccountBalance = accountsForTooltip.reduce((sum, acc) => sum + (acc.balance || 0), 0)
                            const totalMonthlyExpenses = expensesForTooltip.reduce((sum, exp) => {
                              const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
                              return sum + (amount || 0)
                            }, 0)
                            const totalAnnualExpenses = totalMonthlyExpenses * 12
                            const totalOtherIncome = otherIncomeForTooltip.reduce((sum, inc) => sum + (inc.amount || 0), 0)
                            
                            return (
                              <>
                                <div>
                                  <h4 className="font-semibold text-blue-400 mb-2 text-base">All Calculation Numbers</h4>
                                </div>
                                
                                <div className="border-t border-gray-700 pt-2">
                                  <h4 className="font-semibold text-green-400 mb-2">User-Entered Values</h4>
                                  <div className="space-y-1 text-gray-300">
                                    <p><span className="text-gray-500">Birth Year:</span> {birthYear || 'Not set'}</p>
                                    <p><span className="text-gray-500">Current Age:</span> {currentAge} years</p>
                                    <p><span className="text-gray-500">Retirement Age:</span> {retirementAge} years</p>
                                    <p><span className="text-gray-500">Life Expectancy:</span> {lifeExpectancy} years</p>
                                    {planDataForTooltip?.include_spouse && (
                                      <>
                                        <p><span className="text-gray-500">Spouse Included:</span> Yes</p>
                                        {planDataForTooltip?.spouse_birth_year && (
                                          <p><span className="text-gray-500">Spouse Birth Year:</span> {planDataForTooltip.spouse_birth_year}</p>
                                        )}
                                        {planDataForTooltip?.spouse_life_expectancy && (
                                          <p><span className="text-gray-500">Spouse Life Expectancy:</span> {planDataForTooltip.spouse_life_expectancy} years</p>
                                        )}
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
                                            • {exp.expense_name}: ${(retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65) || 0}/month
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
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-yellow-400">Assumptions</h4>
                                    {!editingAssumptions ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingAssumptions(true)
                                          setEditedAssumptions({
                                            growth_rate_before_retirement: settingsForTooltip?.growth_rate_before_retirement || 0.1,
                                            growth_rate_during_retirement: settingsForTooltip?.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
                                            inflation_rate: settingsForTooltip?.inflation_rate || DEFAULT_INFLATION_RATE,
                                            ssa_start_age: settingsForTooltip?.ssa_start_age || settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE,
                                          })
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded transition-colors"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        Edit
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation()
                                            if (editedAssumptions && selectedScenarioId) {
                                              try {
                                                // Save to database
                                                const { error } = await supabase
                                                  .from('rp_calculator_settings')
                                                  .update({
                                                    growth_rate_before_retirement: editedAssumptions.growth_rate_before_retirement,
                                                    growth_rate_during_retirement: editedAssumptions.growth_rate_during_retirement,
                                                    inflation_rate: editedAssumptions.inflation_rate,
                                                    ssa_start_age: editedAssumptions.ssa_start_age,
                                                  })
                                                  .eq('scenario_id', selectedScenarioId)
                                                
                                                if (error) throw error
                                                
                                                // Update local state
                                                setSettingsForTooltip({
                                                  ...settingsForTooltip!,
                                                  ...editedAssumptions,
                                                })
                                                
                                                // Recalculate
                                                await loadAndCalculateSnapshot()
                                                
                                                setEditingAssumptions(false)
                                                setEditedAssumptions(null)
                                                setMessage({ type: 'success', text: 'Assumptions updated and projections recalculated!' })
                                                setTimeout(() => setMessage(null), TOAST_DURATION_SHORT)
                                              } catch (error: any) {
                                                console.error('Error saving assumptions:', error)
                                                setMessage({ type: 'error', text: `Failed to save: ${error.message}` })
                                              }
                                            }
                                          }}
                                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                                        >
                                          <Save className="h-3 w-3" />
                                          Save
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingAssumptions(false)
                                            setEditedAssumptions(null)
                                          }}
                                          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                                        >
                                          <X className="h-3 w-3" />
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-2 text-gray-300">
                                    {editingAssumptions && editedAssumptions ? (
                                      <>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 text-xs">Growth Rate (Pre-Retirement):</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.1"
                                              min="0"
                                              max="50"
                                              value={((editedAssumptions.growth_rate_before_retirement || 0) * 100).toFixed(2)}
                                              onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0
                                                setEditedAssumptions({
                                                  ...editedAssumptions,
                                                  growth_rate_before_retirement: value / 100,
                                                })
                                              }}
                                              className="w-20 px-2 py-1 text-xs bg-gray-800 text-gray-100 border border-gray-600 rounded focus:outline-none focus:border-yellow-500"
                                            />
                                            <span className="text-xs">%</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 text-xs">Growth Rate (During Retirement):</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.1"
                                              min="0"
                                              max="50"
                                              value={((editedAssumptions.growth_rate_during_retirement || 0) * 100).toFixed(2)}
                                              onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0
                                                setEditedAssumptions({
                                                  ...editedAssumptions,
                                                  growth_rate_during_retirement: value / 100,
                                                })
                                              }}
                                              className="w-20 px-2 py-1 text-xs bg-gray-800 text-gray-100 border border-gray-600 rounded focus:outline-none focus:border-yellow-500"
                                            />
                                            <span className="text-xs">%</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 text-xs">Inflation Rate:</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="0.1"
                                              min="0"
                                              max="20"
                                              value={((editedAssumptions.inflation_rate || 0) * 100).toFixed(2)}
                                              onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0
                                                setEditedAssumptions({
                                                  ...editedAssumptions,
                                                  inflation_rate: value / 100,
                                                })
                                              }}
                                              className="w-20 px-2 py-1 text-xs bg-gray-800 text-gray-100 border border-gray-600 rounded focus:outline-none focus:border-yellow-500"
                                            />
                                            <span className="text-xs">%</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-500 text-xs">SSA Start Age:</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              step="1"
                                              min="62"
                                              max="70"
                                              value={editedAssumptions.ssa_start_age || settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE}
                                              onChange={(e) => {
                                                const value = parseInt(e.target.value) || 62
                                                setEditedAssumptions({
                                                  ...editedAssumptions,
                                                  ssa_start_age: value,
                                                })
                                              }}
                                              className="w-20 px-2 py-1 text-xs bg-gray-800 text-gray-100 border border-gray-600 rounded focus:outline-none focus:border-yellow-500"
                                            />
                                            <span className="text-xs">years</span>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <p><span className="text-gray-500">Growth Rate (Pre-Retirement):</span> {((settingsForTooltip?.growth_rate_before_retirement || 0.1) * 100).toFixed(2)}%</p>
                                        <p><span className="text-gray-500">Growth Rate (During Retirement):</span> {((settingsForTooltip?.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT) * 100).toFixed(2)}%</p>
                                        <p><span className="text-gray-500">Inflation Rate:</span> {((settingsForTooltip?.inflation_rate || DEFAULT_INFLATION_RATE) * 100).toFixed(2)}%</p>
                                        <p><span className="text-gray-500">Taxes:</span> Using IRS brackets</p>
                                        <p><span className="text-gray-500">SSA Start Age:</span> {settingsForTooltip?.ssa_start_age || settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE} years</p>
                                      </>
                                    )}
                                    <p><span className="text-gray-500">Filing Status:</span> {planDataForTooltip?.filing_status || DEFAULT_FILING_STATUS}</p>
                                    <p><span className="text-gray-500">Borrowing Enabled:</span> {settingsForTooltip?.enable_borrowing ? 'Yes' : 'No'}</p>
                                    {(planDataForTooltip?.include_spouse || planDataForTooltip?.filing_status === 'Married Filing Jointly') && (
                                      <p className="text-xs text-yellow-400 mt-2">
                                        <span className="font-semibold">Note:</span> Spouse SSA income is automatically included in projections when plan includes spouse or filing status is "Married Filing Jointly", even if not explicitly selected.
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="border-t border-gray-700 pt-2">
                                  <h4 className="font-semibold text-purple-400 mb-2">Projection Summary</h4>
                                  <div className="space-y-1 text-gray-300">
                                    <p><span className="text-gray-500">Projection Start Year:</span> {projections[0]?.year || 'N/A'}</p>
                                    <p><span className="text-gray-500">Projection End Year:</span> {finalProjection?.year || 'N/A'}</p>
                                    <p><span className="text-gray-500">Final Age:</span> {finalAge} years</p>
                                    <p><span className="text-gray-500">Age at Zero Networth:</span> {zeroNetworthYear >= 0 ? `${ageAtZeroNetworth} years` : 'Not reached'}</p>
                                    <p><span className="text-gray-500">Total Retirement Years:</span> {projections.filter(p => p.age >= retirementAge).length} years</p>
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
                
                {/* Plan Health - Main Message */}
                {/* ── Plan status headline ───────────────────────────────── */}
                <div className="text-center mb-6">

                  {/* Top line: On Track / Close / At Risk */}
                  <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-bold mb-3
                    ${results.status === 'on-track' ? 'bg-green-100 text-green-800' : ''}
                    ${results.status === 'close'    ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${results.status === 'at-risk'  ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {results.status === 'on-track' && <CheckCircle2 className="h-5 w-5" />}
                    {results.status !== 'on-track' && <AlertCircle className="h-5 w-5" />}
                    <span>
                      {results.status === 'on-track' ? 'On Track'
                        : results.status === 'close' ? 'Close'
                        : 'At Risk'}
                    </span>
                    {results.calculationDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help opacity-60 hover:opacity-100">
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-sm whitespace-pre-line">
                            {results.calculationDetails.statusCalculation}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {/* Retirement Score (from Risk Analysis) */}
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">{results.retirementScore.overall}%</span>
                    <span className="text-base font-medium text-gray-500 self-end pb-1">Retirement Score</span>
                    {mcRunning && (
                      <span className="self-end pb-1.5 text-xs text-amber-600 animate-pulse" title="Running Monte Carlo to compute Market Risk score…">⟳ MC</span>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="cursor-help self-end pb-1.5">
                          <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-4">
                        <div className="text-xs space-y-3">
                          <p className="text-sm font-semibold text-white">Retirement Score breakdown</p>
                          {([
                            { label: 'Longevity', weight: 40, score: results.retirementScore.longevity, detail: results.retirementScore.details?.longevity },
                            { label: 'Market Risk (MC)', weight: 20, score: results.retirementScore.monteCarlo, detail: results.retirementScore.details?.monteCarlo },
                            { label: 'Cashflow', weight: 10, score: results.retirementScore.sustainability, detail: results.retirementScore.details?.cashflow },
                            { label: 'Tax Efficiency', weight: 10, score: results.retirementScore.taxEfficiency, detail: results.retirementScore.details?.taxEfficiency },
                            { label: 'Inflation', weight: 10, score: results.retirementScore.inflation, detail: results.retirementScore.details?.inflation },
                            { label: 'Medical', weight: 10, score: results.retirementScore.medical, detail: results.retirementScore.details?.medical },
                          ] as const).map(({ label, weight, score, detail }) => (
                            <div key={label}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-gray-300 font-medium">{label} <span className="text-gray-500">({weight}%)</span></span>
                                <span className={`font-bold ${score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>{score}</span>
                              </div>
                              {detail && detail.split('\n').map((line, i) => (
                                <p key={i} className="text-gray-400 leading-snug">{line}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Progress bar */}
                  <div className="flex justify-center mb-2">
                    <div className="w-56 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          results.retirementScore.overall >= SCORE_ON_TRACK_THRESHOLD ? 'bg-green-500' :
                          results.retirementScore.overall >= SCORE_CLOSE_THRESHOLD    ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${results.retirementScore.overall}%` }}
                      />
                    </div>
                  </div>

                  {/* One-line subtext */}
                  <p className="text-xs text-gray-500 mb-4">
                    Covers all retirement years based on your assumptions
                  </p>

                  {/* Single risk line with badge */}
                  {results.withdrawalRate > 0 && (() => {
                    const wr = results.withdrawalRate
                    const fmtWr2 = (r: number) => parseFloat(r.toFixed(2)).toString()
                    const isLow      = wr <= 4.5
                    const isModerate = wr > 4.5 && wr <= 5.5
                    const isHigh     = wr > 5.5
                    return (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-4 ${
                        isLow      ? 'bg-green-50 text-green-700 border border-green-200' :
                        isModerate ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                     'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className="text-sm">{isLow ? '🟢' : isModerate ? '🟡' : '🔴'}</span>
                        <span>
                          {isLow
                            ? `Safe withdrawal rate (${fmtWr2(wr)}%)`
                            : isModerate
                              ? `Moderate risk — ${fmtWr2(wr)}% withdrawal rate`
                              : `High withdrawal rate (${fmtWr2(wr)}%) — review expenses`}
                        </span>
                      </div>
                    )
                  })()}

                  {/* View Risk Analysis — always shown; tone varies by risk level */}
                  {(() => {
                    const wr = results.withdrawalRate
                    const hasHighRisk = results.retirementScore.overall < SCORE_ON_TRACK_THRESHOLD
                      || wr > 4.5
                      || results.fundsRunOutAge !== null
                      || (results.biggestRisks && results.biggestRisks.length > 0 && results.biggestRisks[0] !== 'Market volatility could temporarily impact portfolio value')
                    return (
                      <div>
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent('switchTab', { detail: 'analysis' }))}
                          className={`text-xs font-medium hover:underline ${hasHighRisk ? 'text-amber-700 hover:text-amber-900' : 'text-blue-600 hover:text-blue-800'}`}
                        >
                          {hasHighRisk ? '⚠ Review Risk Analysis for details →' : 'View full Risk Analysis →'}
                        </button>
                      </div>
                    )
                  })()}
                </div>

                {/* Estimated Income - Secondary */}
                <div className="text-center border-t border-blue-200 pt-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-600">Estimated Income at Retirement</p>
                    {results.calculationDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-sm whitespace-pre-line">
                            {results.calculationDetails.monthlyIncomeCalculation}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {results.calculationDetails && (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <p className="text-xs text-gray-500">Living Expenses at Retirement Start</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-sm whitespace-pre-line">
                            {results.calculationDetails.expenseCalculation}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <div className="flex items-baseline justify-center gap-4">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                        ${(results.monthlyRetirementIncome || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">per month · after tax</p>
                    </div>
                    <div className="text-gray-400">/</div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                        ${((results.annualRetirementIncome ?? results.monthlyRetirementIncome * 12) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">per year · after tax</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Three Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* How Long Money Lasts */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">How Long Your Money Lasts</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-2xl bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-xs space-y-3">
                            {results.calculationDetails && (
                              <div>
                                <h4 className="font-semibold text-green-400 mb-2">How Long Your Money Lasts Calculation</h4>
                                <div className="text-sm whitespace-pre-line text-gray-300 mb-3">
                                  {results.calculationDetails.yearsMoneyLastsCalculation}
                                </div>
                              </div>
                            )}
                            {(() => {
                              const currentYear = new Date().getFullYear()
                              const birthYear = planDataForTooltip?.birth_year || 0
                              const currentAge = birthYear ? currentYear - birthYear : 0
                              const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                              const lifeExpectancy = planDataForTooltip?.life_expectancy || results.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY
                              const finalProjection = projections[projections.length - 1]
                              const finalAge = finalProjection?.age || 0
                              const zeroNetworthYear = projections.findIndex(p => (p.networth || 0) <= 0)
                              const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projections[zeroNetworthYear]?.age || 0) : finalAge
                              const longevityBeyondLifeExpectancy = zeroNetworthYear >= 0
                                ? ageAtZeroNetworth - lifeExpectancy
                                : finalAge - lifeExpectancy
                              
                              const totalAccountBalance = accountsForTooltip.reduce((sum, acc) => sum + (acc.balance || 0), 0)
                              const totalMonthlyExpenses = expensesForTooltip.reduce((sum, exp) => {
                                const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
                                return sum + (amount || 0)
                              }, 0)
                            const totalAnnualExpenses = totalMonthlyExpenses * 12
                            const totalOtherIncome = otherIncomeForTooltip.reduce((sum, inc) => sum + (inc.amount || 0), 0)
                            
                            return (
                                <>
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-blue-400 mb-2">User-Entered Values</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Birth Year:</span> {birthYear || 'Not set'}</p>
                                      <p><span className="text-gray-500">Current Age:</span> {currentAge} years</p>
                                      <p><span className="text-gray-500">Retirement Age:</span> {retirementAge} years</p>
                                      <p><span className="text-gray-500">Life Expectancy:</span> {lifeExpectancy} years</p>
                                      <p><span className="text-gray-500">Total Account Balance:</span> ${totalAccountBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                      <p><span className="text-gray-500">Total Annual Expenses:</span> ${totalAnnualExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-yellow-400 mb-2">Assumptions</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Growth Rate (Pre-Retirement):</span> {((settingsForTooltip?.growth_rate_before_retirement || 0.1) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Growth Rate (During Retirement):</span> {((settingsForTooltip?.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Inflation Rate:</span> {((settingsForTooltip?.inflation_rate || DEFAULT_INFLATION_RATE) * 100).toFixed(2)}%</p>
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-purple-400 mb-2">Projection Details</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Age at Zero Networth:</span> {zeroNetworthYear >= 0 ? `${ageAtZeroNetworth} years` : 'Not reached'}</p>
                                      <p><span className="text-gray-500">Longevity Beyond Life Expectancy:</span> {longevityBeyondLifeExpectancy.toFixed(2)} years</p>
                                      <p><span className="text-gray-500">Total Retirement Years:</span> {projections.filter(p => p.age >= retirementAge).length} years</p>
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
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    {results.fundsRunOutAge 
                      ? `${results.yearsMoneyLasts} years`
                      : `Full Plan`}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {results.fundsRunOutAge 
                      ? `Funds run out at age ${results.fundsRunOutAge} (before life expectancy of ${results.lifeExpectancy})`
                      : `Assets last beyond life expectancy (age ${results.lifeExpectancy}) with $${results.legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} remaining`}
                  </p>
                  {results.incomeCoverageAtFundsRunOut && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs font-semibold text-yellow-900 mb-1">Income Coverage When Funds Run Out (Age {results.incomeCoverageAtFundsRunOut.age}):</p>
                      <div className="text-xs text-yellow-800 space-y-1">
                        <div className="flex justify-between">
                          <span>SSA Income:</span>
                          <span className="font-medium">${Math.round(results.incomeCoverageAtFundsRunOut.ssaIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span>
                        </div>
                        {results.incomeCoverageAtFundsRunOut.otherIncome > 0 && (
                          <div className="flex justify-between">
                            <span>Other Income:</span>
                            <span className="font-medium">${Math.round(results.incomeCoverageAtFundsRunOut.otherIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Total Income:</span>
                          <span className="font-medium">${Math.round(results.incomeCoverageAtFundsRunOut.totalIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expenses:</span>
                          <span className="font-medium">${Math.round(results.incomeCoverageAtFundsRunOut.expenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span>
                        </div>
                        <div className="border-t border-yellow-300 pt-1 mt-1 flex justify-between font-semibold">
                          <span>Coverage:</span>
                          <span className={results.incomeCoverageAtFundsRunOut.coveragePercentage < 60 ? 'text-red-600' : 'text-green-600'}>
                            {results.incomeCoverageAtFundsRunOut.coveragePercentage.toFixed(2)}%
                          </span>
                        </div>
                        {results.incomeCoverageAtFundsRunOut.coveragePercentage < 60 && (
                          <p className="text-red-700 font-medium mt-1">
                            ⚠️ Income covers less than 60% of expenses
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Legacy Value */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Legacy Value</h3>
                    {results.calculationDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-sm whitespace-pre-line">
                            {results.calculationDetails.legacyValueCalculation}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    ${results.legacyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-sm text-gray-600">
                    {results.fundsRunOutAge 
                      ? `Funds exhausted before life expectancy (age ${results.lifeExpectancy})`
                      : `Estimated value at life expectancy (age ${results.lifeExpectancy}) · future dollars`}
                  </p>
                  {!results.fundsRunOutAge && results.legacyValue > 0 && results.legacyInflationRate > 0 && results.legacyCurrentAge > 0 && (() => {
                    const yearsToLifeExp = results.lifeExpectancy - results.legacyCurrentAge
                    const realLegacy = Math.round(results.legacyValue / Math.pow(1 + results.legacyInflationRate, yearsToLifeExp))
                    return (
                      <p className="text-xs text-gray-500 mt-1">
                        ≈ ${realLegacy.toLocaleString(undefined, { maximumFractionDigits: 0 })} in today's dollars
                      </p>
                    )
                  })()}
                  {!results.fundsRunOutAge && results.withdrawalRate > 4.5 && (
                    <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      Based on steady-return projections only. With a {parseFloat(results.withdrawalRate.toFixed(2))}% withdrawal rate, market downturns could significantly reduce this figure — see Monte Carlo results for a probability-adjusted view.
                    </p>
                  )}
                </div>

                {/* Biggest Risks */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Biggest Risks</h3>
                  </div>
                  <ul className="space-y-2">
                    {results.biggestRisks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-orange-600 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* SSA Information */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Info className="h-5 w-5 text-blue-600" />
                  Social Security Income
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  Your projections use the SSA assumptions from your plan. Edit your plan in Plan Details to change assumptions.
                </p>
                {(() => {
                  // Calculate SSA at start age for display (matching projection calculations exactly)
                  const ssaStartAge = settingsForTooltip?.ssa_start_age || settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                  // Use the same age calculation as projection: currentYear - birthYear
                  const currentYear = new Date().getFullYear()
                  const birthYear = planDataForTooltip?.birth_year || (currentYear - 50)
                  const currentAge = currentYear - birthYear
                  const yearsToSsaStart = Math.max(0, ssaStartAge - currentAge)
                  const inflationRate = settingsForTooltip?.inflation_rate || DEFAULT_INFLATION_RATE
                  const inflationToSsaStart = yearsToSsaStart > 0 
                    ? Math.pow(1 + inflationRate, yearsToSsaStart)
                    : 1

                  // Spouse may be a different age — compute their own horizon independently.
                  const spouseBirthYearTooltip = planDataForTooltip?.spouse_birth_year
                  const spouseCurrentAgeTooltip = spouseBirthYearTooltip ? currentYear - spouseBirthYearTooltip : null
                  const spouseYearsToSsaStart = spouseCurrentAgeTooltip !== null
                    ? Math.max(0, ssaStartAge - spouseCurrentAgeTooltip)
                    : yearsToSsaStart
                  const spouseInflationToSsaStart = spouseYearsToSsaStart > 0
                    ? Math.pow(1 + inflationRate, spouseYearsToSsaStart)
                    : 1

                  // Each person gets their OWN early-claiming multiplier.
                  // The planner claims at ssaStartAge. The spouse also starts at the same
                  // CALENDAR YEAR, which means the spouse's actual claiming age = ssaStartAge +
                  // (spouseBirthYear - plannerBirthYear) i.e. offset by the age gap.
                  // Example: planner 53, spouse 51; ssaStartAge 65.
                  //   Planner claims at 65 (planner's FRA year).
                  //   In that same calendar year, spouse is 63 → 4 yrs before FRA → 25% reduction.
                  const plannerClaimingAge = ssaStartAge
                  const plannerMultiplier = ssaClaimingMultiplier(plannerClaimingAge)
                  const plannerReduction = plannerClaimingAge < SSA_FULL_RETIREMENT_AGE
                    ? Math.round((1 - plannerMultiplier) * 100) : 0

                  // Spouse claiming age in the planner's claiming calendar year:
                  //   calendarYearOfClaim = birthYear + ssaStartAge
                  //   spouseAgeAtClaim = calendarYearOfClaim - spouseBirthYear
                  const calendarYearOfClaim = birthYear + ssaStartAge
                  const spouseClaimingAge = spouseBirthYearTooltip
                    ? calendarYearOfClaim - spouseBirthYearTooltip
                    : ssaStartAge
                  const spouseMultiplier = ssaClaimingMultiplier(spouseClaimingAge)
                  const spouseReduction = spouseClaimingAge < SSA_FULL_RETIREMENT_AGE
                    ? Math.round((1 - spouseMultiplier) * 100) : 0

                  // Mirror the same auto-include logic as loadAndCalculateSnapshot (lines 397-401).
                  // spouse_ssa_income in rp_calculator_settings may be stale (explicitly false when plan
                  // was created as Single) — only the plan-level include_spouse / filing_status should veto.
                  const st = settingsForTooltip as any
                  const _isSingleFilerSsa = planDataForTooltip?.filing_status === 'Single'
                  const _hasSpouseSsa     = planDataForTooltip?.include_spouse || false
                  const _isMfjSsa         = planDataForTooltip?.filing_status === 'Married Filing Jointly'
                  const _explicitSpouseSsa = st?.spouse_ssa_income === true
                  const estimatedIncome = Number(st?.estimated_ssa_annual_income) || 0
                  // Use explicit benefits when set; else estimate from income (calculateEstimatedSSA returns defaults when income is 0)
                  const plannerIncluded = st?.planner_ssa_income !== false
                  const spouseIncluded = !_isSingleFilerSsa && (_explicitSpouseSsa || _hasSpouseSsa || _isMfjSsa)
                  const plannerBenefit = st?.planner_ssa_annual_benefit != null && st.planner_ssa_annual_benefit !== ''
                    ? Number(st.planner_ssa_annual_benefit)
                    : (plannerIncluded ? calculateEstimatedSSA(estimatedIncome, true) : 0)
                  const spouseBenefit = st?.spouse_ssa_annual_benefit != null && st.spouse_ssa_annual_benefit !== ''
                    ? Number(st.spouse_ssa_annual_benefit)
                    : (spouseIncluded ? calculateEstimatedSSA(estimatedIncome, false) : 0)
                  const basePlannerSsa = plannerBenefit
                  const baseSpouseSsa = spouseIncluded ? spouseBenefit : 0

                  const plannerSsaAtStartAge = basePlannerSsa * inflationToSsaStart * plannerMultiplier
                  const spouseSsaAtStartAge = baseSpouseSsa * spouseInflationToSsaStart * spouseMultiplier
                  const totalSsaAtStartAge = plannerSsaAtStartAge + spouseSsaAtStartAge

                  // Intermediate: inflated-only (before claiming reduction) — shown in step breakdown
                  const plannerSsaInflatedOnly = basePlannerSsa * inflationToSsaStart
                  const spouseSsaInflatedOnly = baseSpouseSsa * spouseInflationToSsaStart
                  const totalSsaInflatedOnly = plannerSsaInflatedOnly + spouseSsaInflatedOnly
                  
                  // Calculate current dollar amounts (base estimates without inflation or early retirement factor)
                  const plannerSsaCurrentDollars = basePlannerSsa
                  const spouseSsaCurrentDollars = baseSpouseSsa
                  const totalSsaCurrentDollars = plannerSsaCurrentDollars + spouseSsaCurrentDollars

                  // Helpers for formatted age labels
                  const fmtClaimLabel = (claimAge: number, personLabel: string) => {
                    if (claimAge >= SSA_FULL_RETIREMENT_AGE) return `${personLabel} at FRA ${claimAge}`
                    return `${personLabel} at ${claimAge} (${SSA_FULL_RETIREMENT_AGE - claimAge} yr${SSA_FULL_RETIREMENT_AGE - claimAge !== 1 ? 's' : ''} before FRA)`
                  }
                  
                  return (
                    <div className="text-sm text-gray-600 space-y-3">
                      {/* Step 0: Today's estimated benefit */}
                      <div>
                        <p className="font-medium text-gray-800 mb-1">Step 1 — Today's estimated benefit (current dollars):</p>
                        <p>• Total: <span className="font-semibold text-gray-900">${Math.round(totalSsaCurrentDollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                        {plannerSsaCurrentDollars > 0 && (
                          <p className="ml-4 text-xs">- Your benefit: ${Math.round(plannerSsaCurrentDollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                        )}
                        {spouseSsaCurrentDollars > 0 && (
                          <p className="ml-4 text-xs">- Spouse benefit: ${Math.round(spouseSsaCurrentDollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                        )}
                      </div>

                      {/* Step 1: Inflation-adjusted to SSA start age */}
                      {yearsToSsaStart > 0 && (
                        <div>
                          <p className="font-medium text-gray-800 mb-1">
                            Step 2 — Inflation-adjusted to age {ssaStartAge}{spouseYearsToSsaStart !== yearsToSsaStart
                              ? ` (you: ${yearsToSsaStart} yr${yearsToSsaStart !== 1 ? 's' : ''}, spouse: ${spouseYearsToSsaStart} yr${spouseYearsToSsaStart !== 1 ? 's' : ''} × ${(inflationRate * 100).toFixed(1)}%)`
                              : ` (${yearsToSsaStart} yr${yearsToSsaStart !== 1 ? 's' : ''} × ${(inflationRate * 100).toFixed(1)}%)`}:
                          </p>
                          <p>• Total: <span className="font-semibold text-gray-900">${Math.round(totalSsaInflatedOnly).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                          {plannerSsaInflatedOnly > 0 && basePlannerSsa > 0 && (
                            <p className="ml-4 text-xs">- Your benefit: ${Math.round(plannerSsaInflatedOnly).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                          )}
                          {spouseSsaInflatedOnly > 0 && baseSpouseSsa > 0 && (
                            <p className="ml-4 text-xs">- Spouse benefit: ${Math.round(spouseSsaInflatedOnly).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">This is what each benefit would be at FRA if you started today's amount.</p>
                        </div>
                      )}

                      {/* Step 2: Early claiming reductions — shown PER PERSON when they differ */}
                      {(plannerReduction > 0 || spouseReduction > 0) && (
                        <div>
                          <p className="font-medium text-gray-800 mb-1">
                            Step 3 — Early claiming reductions (vs FRA {SSA_FULL_RETIREMENT_AGE}):
                          </p>
                          {plannerReduction > 0 && (
                            <p className="text-amber-700 text-xs">
                              {fmtClaimLabel(plannerClaimingAge, 'You')}: × {plannerMultiplier.toFixed(4)} = −{plannerReduction}% permanent reduction
                            </p>
                          )}
                          {spouseIncluded && spouseReduction > 0 && (
                            <p className="text-amber-700 text-xs">
                              {fmtClaimLabel(spouseClaimingAge, 'Spouse')}: × {spouseMultiplier.toFixed(4)} = −{spouseReduction}% permanent reduction
                            </p>
                          )}
                          {spouseIncluded && spouseClaimingAge !== plannerClaimingAge && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              When you claim at your age {plannerClaimingAge}, your spouse will be age {spouseClaimingAge} — each gets their own reduction based on their own age vs FRA.
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5">Permanent reduction. Claiming later (up to age {SSA_FULL_RETIREMENT_AGE}) eliminates it.</p>
                        </div>
                      )}

                      {/* Final: What you actually receive */}
                      <div className="pt-2 border-t border-gray-300">
                        <p className="font-medium text-gray-800 mb-1">
                          Final — Estimated SSA income at your age {ssaStartAge} (future dollars, after reductions):
                        </p>
                        <p>• Total: <span className="font-semibold text-gray-900 text-base">${Math.round(totalSsaAtStartAge).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                        {plannerSsaAtStartAge > 0 && basePlannerSsa > 0 && (
                          <p className="ml-4 text-xs">- Your benefit: ${Math.round(plannerSsaAtStartAge).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                        )}
                        {spouseSsaAtStartAge > 0 && baseSpouseSsa > 0 && (
                          <p className="ml-4 text-xs">- Spouse benefit: ${Math.round(spouseSsaAtStartAge).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year{spouseClaimingAge !== plannerClaimingAge ? ` (at spouse age ${spouseClaimingAge})` : ''}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">After claiming, SSA benefits grow annually with the SSA COLA rate (~2.5%).</p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Recommendations & Next Steps */}
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">What Should You Do Next?</h3>
                </div>
                
                {/* Main Recommendation */}
                <p className="text-gray-700 mb-4">{results.recommendation}</p>
                
                {/* Improvements */}
                {results.improvements && results.improvements.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <h4 className="text-sm font-semibold text-gray-900">What Could Improve Your Plan</h4>
                    </div>
                    <ul className="space-y-2 ml-6">
                      {results.improvements.map((improvement, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">•</span>
                          <span>{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-blue-200">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowProjections(!showProjections)}
                      className="rounded-md bg-white border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <span>{showProjections ? 'Hide' : 'See'} Yearly Projections</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${showProjections ? 'rotate-90' : ''}`} />
                    </button>
                    {onSwitchToPlanSetup && !isLocal && (
                      <button
                        onClick={onSwitchToPlanSetup}
                        type="button"
                        className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Update Plan Setup</span>
                      </button>
                    )}
                    {!isLocal && (
                      <>
                        <PlanPdfDialog
                          planId={planId}
                          scenarioId={selectedScenarioId}
                          planName={planDataForTooltip?.plan_name}
                        />
                        <PlanPrintAllDialog
                          planId={planId}
                          scenarioId={selectedScenarioId}
                          planName={planDataForTooltip?.plan_name}
                        />
                      </>
                    )}
                  </div>
                  {isLocal ? (
                    <a
                      href="/login?signup=1"
                      className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 flex items-center gap-2 transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Sign Up for Advanced Analysis</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        setShowQuickStart(false)
                        if (onSwitchToAdvanced) {
                          onSwitchToAdvanced()
                        }
                      }}
                      className="rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200 flex items-center gap-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span>See Advanced Analysis</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Simplified Projections View */}
              {showProjections && projections.length > 0 && (
                <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">Year-by-Year Projections</h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      {projections.length > 0 && (
                        <button
                          onClick={() => {
                            // Export projections to CSV - same logic as advanced projections
                            const currentYear = new Date().getFullYear()
                            const birthYear = planDataForTooltip?.birth_year || (currentYear - 50)
                            const currentAgeCalc = currentYear - birthYear
                            const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                            
                            const filteredProjs = projections.filter(p => {
                              if (showPreRetirement) {
                                // Show all projections from current age to life expectancy
                                return p.age >= currentAgeCalc && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                              } else {
                                // Show only retirement years
                                return p.age >= retirementAge && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                              }
                            })
                            
                            // Define CSV headers with all fields (same as advanced projections)
                            const headers = [
                              'Year',
                              'Age',
                              'Event',
                              'SSA Income',
                              '401k Withdrawal',
                              'Roth Withdrawal',
                              'Taxable Withdrawal',
                              'HSA Withdrawal',
                              'IRA Withdrawal',
                              'Other Withdrawal',
                              'Investment Income',
                              'Other Investments Income',
                              'Other Recurring Income',
                              'Total Income',
                              'After-Tax Income',
                              'Living Expenses',
                              'Healthcare Expenses',
                              'Total Expenses',
                              'Annual Contribution',
                              'Gap/Excess',
                              'Cumulative Liability',
                              'Debt Balance',
                              'Debt Interest Paid',
                              'Debt Principal Paid',
                              'Assets Remaining',
                              'Networth',
                              '401k Balance',
                              'Roth Balance',
                              'Taxable Balance',
                              'Other Investments Balance',
                              'HSA Balance',
                              'IRA Balance',
                              'Taxable Income',
                              'Tax'
                            ]
                            
                            // Convert projections to CSV rows
                            const rows = filteredProjs.map((proj, idx) => {
                              // Calculate contributions if not present in projection data (same logic as advanced projections)
                              let contribution = proj.annual_contribution
                              
                              // If contribution is missing, calculate it from account balance changes
                              if (contribution === undefined) {
                                const isRetired = retirementAge !== null && (proj.age || 0) >= retirementAge
                                if (!isRetired) {
                                  // Find previous projection
                                  const prevProj = idx > 0 ? filteredProjs[idx - 1] : null
                                  const growthRate = settingsForTooltip?.growth_rate_before_retirement || 0.1
                                  
                                  if (prevProj) {
                                    // Calculate from account balance changes (has previous year)
                                    const calculateAccountContributions = (current: number, previous: number | null, distribution: number): number => {
                                      if (previous === null) return 0
                                      const balanceAfterGrowth = previous * (1 + growthRate)
                                      const contributions = current + distribution - balanceAfterGrowth
                                      return Math.max(0, contributions)
                                    }
                                    
                                    contribution = 
                                      calculateAccountContributions(proj.balance_401k || 0, prevProj?.balance_401k || null, proj.distribution_401k || 0) +
                                      calculateAccountContributions(proj.balance_roth || 0, prevProj?.balance_roth || null, proj.distribution_roth || 0) +
                                      calculateAccountContributions(proj.balance_investment || 0, prevProj?.balance_investment || null, proj.distribution_taxable || 0) +
                                      calculateAccountContributions(proj.balance_hsa || 0, prevProj?.balance_hsa || null, proj.distribution_hsa || 0) +
                                      calculateAccountContributions(proj.balance_ira || 0, prevProj?.balance_ira || null, proj.distribution_ira || 0) +
                                      calculateAccountContributions(proj.balance_other_investments || 0, prevProj?.balance_other_investments || null, proj.distribution_other || 0)
                                  } else {
                                    // First year: calculate from initial account balances
                                    const getInitialBalance = (accountType: string): number => {
                                      const type = (accountType || 'Other').trim()
                                      const key = type === 'Roth IRA' ? 'Roth IRA' : 
                                                  type === '401k' ? '401k' :
                                                  type === 'HSA' ? 'HSA' :
                                                  type === 'IRA' || type === 'Traditional IRA' ? 'IRA' :
                                                  type === 'Taxable' ? 'Taxable' : 'Other'
                                      
                                      const account = accountsForTooltip.find(acc => {
                                        const accType = (acc.account_type || 'Other').trim()
                                        const accKey = accType === 'Roth IRA' ? 'Roth IRA' : 
                                                     accType === '401k' ? '401k' :
                                                     accType === 'HSA' ? 'HSA' :
                                                     accType === 'IRA' || accType === 'Traditional IRA' ? 'IRA' :
                                                     accType === 'Taxable' ? 'Taxable' : 'Other'
                                        return accKey === key
                                      })
                                      return account?.balance || 0
                                    }
                                    
                                    const calculateFirstYearContributions = (currentBalance: number, accountType: string, distribution: number): number => {
                                      const initialBalance = getInitialBalance(accountType)
                                      if (initialBalance === 0) return 0
                                      const balanceAfterGrowth = initialBalance * (1 + growthRate)
                                      const contributions = currentBalance + distribution - balanceAfterGrowth
                                      return Math.max(0, contributions)
                                    }
                                    
                                    // Sum contributions from all accounts
                                    let totalContribution = 0
                                    accountsForTooltip.forEach(acc => {
                                      const type = acc.account_type || 'Other'
                                      let currentBalance = 0
                                      let distribution = 0
                                      
                                      if (type === '401k') {
                                        currentBalance = proj.balance_401k || 0
                                        distribution = proj.distribution_401k || 0
                                      } else if (type === 'Roth IRA' || type === 'Roth') {
                                        currentBalance = proj.balance_roth || 0
                                        distribution = proj.distribution_roth || 0
                                      } else if (type === 'Taxable') {
                                        currentBalance = proj.balance_investment || 0
                                        distribution = proj.distribution_taxable || 0
                                      } else if (type === 'HSA') {
                                        currentBalance = proj.balance_hsa || 0
                                        distribution = proj.distribution_hsa || 0
                                      } else if (type === 'IRA' || type === 'Traditional IRA') {
                                        currentBalance = proj.balance_ira || 0
                                        distribution = proj.distribution_ira || 0
                                      } else {
                                        currentBalance = proj.balance_other_investments || 0
                                        distribution = proj.distribution_other || 0
                                      }
                                      
                                      totalContribution += calculateFirstYearContributions(currentBalance, type, distribution)
                                    })
                                    
                                    contribution = totalContribution
                                  }
                                } else {
                                  contribution = 0
                                }
                              }
                              
                              return [
                                proj.year || '',
                                proj.age || '',
                                proj.event || '',
                                (proj.ssa_income || 0).toFixed(2),
                                (proj.distribution_401k || 0).toFixed(2),
                                (proj.distribution_roth || 0).toFixed(2),
                                (proj.distribution_taxable || 0).toFixed(2),
                                (proj.distribution_hsa || 0).toFixed(2),
                                (proj.distribution_ira || 0).toFixed(2),
                                (proj.distribution_other || 0).toFixed(2),
                                (proj.investment_income || 0).toFixed(2),
                                (proj.other_investments_income || 0).toFixed(2),
                                (proj.other_recurring_income || 0).toFixed(2),
                                (proj.total_income || 0).toFixed(2),
                                (proj.after_tax_income || 0).toFixed(2),
                                (proj.living_expenses || 0).toFixed(2),
                                (proj.healthcare_expenses || proj.special_expenses || 0).toFixed(2),
                                (proj.total_expenses || 0).toFixed(2),
                                (contribution || 0).toFixed(2),
                                (proj.gap_excess || 0).toFixed(2),
                                (proj.cumulative_liability || 0).toFixed(2),
                                (proj.debt_balance || 0).toFixed(2),
                                (proj.debt_interest_paid || 0).toFixed(2),
                                (proj.debt_principal_paid || 0).toFixed(2),
                                (proj.assets_remaining || 0).toFixed(2),
                                (proj.networth || 0).toFixed(2),
                                (proj.balance_401k || 0).toFixed(2),
                                (proj.balance_roth || 0).toFixed(2),
                                (proj.balance_investment || 0).toFixed(2),
                                (proj.balance_other_investments || 0).toFixed(2),
                                (proj.balance_hsa || 0).toFixed(2),
                                (proj.balance_ira || 0).toFixed(2),
                                (proj.taxable_income || 0).toFixed(2),
                                (proj.tax || 0).toFixed(2)
                              ]
                            })
                            
                            // Escape CSV values (handle commas, quotes, newlines)
                            const escapeCSV = (value: string | number): string => {
                              const str = String(value)
                              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                                return `"${str.replace(/"/g, '""')}"`
                              }
                              return str
                            }
                            
                            // Combine headers and rows
                            const csvContent = [
                              headers.map(escapeCSV).join(','),
                              ...rows.map(row => row.map(escapeCSV).join(','))
                            ].join('\n')
                            
                            // Create blob and download
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                            const link = document.createElement('a')
                            const url = URL.createObjectURL(blob)
                            link.setAttribute('href', url)
                            link.setAttribute('download', `quick-projections-${new Date().toISOString().split('T')[0]}.csv`)
                            link.style.visibility = 'hidden'
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          }}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export to CSV
                        </button>
                      )}
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPreRetirement}
                          onChange={(e) => setShowPreRetirement(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Show Pre-Retirement Years</span>
                      </label>
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
                            viewMode === 'graph'
                              ? 'bg-blue-100 text-blue-700'
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
                  </div>
                  
                  {/* Table View */}
                  {viewMode === 'table' && (
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Year</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Age</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Income</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Total Expenses</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Gap/Excess</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Remaining Funds</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {projections
                          .filter(p => {
                            // Use settingsForTooltip values for consistency with calculations
                            const currentYear = new Date().getFullYear()
                            const birthYear = planDataForTooltip?.birth_year || (currentYear - 50)
                            const currentAgeCalc = currentYear - birthYear
                            const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                            
                            if (showPreRetirement) {
                              // Show all projections from current age to life expectancy
                              return p.age >= currentAgeCalc && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                            } else {
                              // Show only retirement years
                              return p.age >= retirementAge && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                            }
                          })
                          .map((proj, idx) => {
                            // Get filtered projections for calculating previous projection
                            // Use same filter logic as above for consistency
                            const currentYear = new Date().getFullYear()
                            const birthYear = planDataForTooltip?.birth_year || (currentYear - 50)
                            const currentAgeCalc = currentYear - birthYear
                            const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                            
                            const filteredProjs = projections.filter(p => {
                              if (showPreRetirement) {
                                return p.age >= currentAgeCalc && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                              } else {
                                return p.age >= retirementAge && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                              }
                            })
                            const prevProj = idx > 0 ? filteredProjs[idx - 1] : null
                            return (
                            <tr key={idx} className={proj.gap_excess && proj.gap_excess < -1000 ? 'bg-red-50' : ''}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{proj.year}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{proj.age}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                {(() => {
                                  // Use a small threshold to handle rounding and floating point precision
                                  const afterTaxIncome = proj.after_tax_income || 0
                                  // Show income if it's greater than 0.01 to avoid showing $0 for very small amounts
                                  return afterTaxIncome > 0.01 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button className="cursor-help hover:text-blue-600 transition-colors">
                                        <div>
                                          ${afterTaxIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          {prevProj && prevProj.after_tax_income != null && prevProj.after_tax_income > 0 ? (() => {
                                            const incomeChange = ((proj.after_tax_income || 0) - prevProj.after_tax_income) / prevProj.after_tax_income * 100
                                            return (
                                              <div className={`text-xs mt-0.5 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(2)}%
                                              </div>
                                            )
                                          })() : null}
                                        </div>
                                      </button>
                                    </TooltipTrigger>
                                  <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                                    <div className="text-sm space-y-2">
                                      <div className="font-semibold text-base mb-3 text-white">Income Breakdown</div>
                                      
                                      {/* Income Sources */}
                                      <div className="space-y-1">
                                        {(proj.ssa_income || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">Social Security:</span>
                                            <span className="text-white font-medium">${((proj.ssa_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_401k || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">401(k) Withdrawals:</span>
                                            <span className="text-white font-medium">${((proj.distribution_401k || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_ira || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">IRA Withdrawals:</span>
                                            <span className="text-white font-medium">${((proj.distribution_ira || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_roth || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">Roth Withdrawals:</span>
                                            <span className="text-white font-medium">${((proj.distribution_roth || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_taxable || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">Taxable Account:</span>
                                            <span className="text-white font-medium">${((proj.distribution_taxable || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_hsa || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">HSA Withdrawals:</span>
                                            <span className="text-white font-medium">${((proj.distribution_hsa || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.distribution_other || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">Other Account:</span>
                                            <span className="text-white font-medium">${((proj.distribution_other || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                        {(proj.other_recurring_income || 0) > 0 && (
                                          <div className="flex justify-between">
                                            <span className="text-gray-300">Other Income:</span>
                                            <span className="text-white font-medium">${((proj.other_recurring_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Totals */}
                                      <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                                        <div className="flex justify-between">
                                          <span className="text-gray-300">Total Income:</span>
                                          <span className="text-white font-semibold">${((proj.total_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                      </div>

                                      {/* Tax Calculation Breakdown */}
                                      {(proj.tax || 0) > 0 && (
                                        <div className="border-t border-gray-700 pt-3 mt-3">
                                          <div className="font-semibold text-base mb-2 text-yellow-400">Tax Calculation</div>
                                          <div className="space-y-1 text-xs">
                                            {(() => {
                                              // Use same auto-include logic as loadAndCalculateSnapshot (lines 397-401).
                                              const _isSingle = planDataForTooltip?.filing_status === 'Single'
                                              const _hasSp    = planDataForTooltip?.include_spouse || false
                                              const _isMfj    = planDataForTooltip?.filing_status === 'Married Filing Jointly'
                                              const includeSpouseSsa = !_isSingle && (_hasSp || _isMfj)
                                              const filingStatus = determineFilingStatus(includeSpouseSsa, planDataForTooltip?.filing_status)
                                              const standardDeduction = getStandardDeduction(filingStatus)
                                              const ordinaryIncome = (proj.distribution_401k || 0) + (proj.distribution_ira || 0) + (proj.other_recurring_income || 0)
                                              const taxableIncomeAfterDeduction = Math.max(0, ordinaryIncome - standardDeduction)
                                              
                                              // Use actual IRS progressive tax brackets (same as projections)
                                              const incomeTax = calculateProgressiveTax(taxableIncomeAfterDeduction, filingStatus)
                                              
                                              // Capital gains tax - use same calculation as projections
                                              // Note: In projections, capital gains tax is calculated on distributionTaxable directly
                                              // Capital gains brackets are based on total taxable income level
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
                                                    <div className="text-gray-400 font-semibold mb-1">Ordinary Income:</div>
                                                    {(proj.distribution_401k || 0) > 0 && (
                                                      <div className="ml-2 flex justify-between">
                                                        <span className="text-gray-400">401(k) Withdrawals:</span>
                                                        <span className="text-gray-300">${((proj.distribution_401k || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                      </div>
                                                    )}
                                                    {(proj.distribution_ira || 0) > 0 && (
                                                      <div className="ml-2 flex justify-between">
                                                        <span className="text-gray-400">IRA Withdrawals:</span>
                                                        <span className="text-gray-300">${((proj.distribution_ira || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                      </div>
                                                    )}
                                                    {(proj.other_recurring_income || 0) > 0 && (
                                                      <div className="ml-2 flex justify-between">
                                                        <span className="text-gray-400">Other Income:</span>
                                                        <span className="text-gray-300">${((proj.other_recurring_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                      </div>
                                                    )}
                                                    <div className="ml-2 flex justify-between border-t border-gray-600 pt-1 mt-1">
                                                      <span className="text-gray-300">Total Ordinary Income:</span>
                                                      <span className="text-white font-medium">${ordinaryIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                    <div className="ml-2 flex justify-between">
                                                      <span className="text-gray-400">Standard Deduction ({filingStatus}):</span>
                                                      <span className="text-gray-300">-${standardDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                    <div className="ml-2 flex justify-between border-t border-gray-600 pt-1 mt-1">
                                                      <span className="text-gray-300">Taxable Income (after deduction):</span>
                                                      <span className="text-white font-medium">${taxableIncomeAfterDeduction.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                    {taxableIncomeAfterDeduction > 0 && (
                                                      <div className="ml-2 flex justify-between">
                                                        <span className="text-gray-400">Income Tax (IRS 2024 brackets):</span>
                                                        <span className="text-red-300 font-medium">${incomeTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                      </div>
                                                    )}
                                                    {taxableIncomeAfterDeduction > 0 && effectiveIncomeTaxRate > 0 && (
                                                      <div className="ml-2 flex justify-between text-xs text-gray-500">
                                                        <span>Effective Rate:</span>
                                                        <span>{effectiveIncomeTaxRate.toFixed(2)}%</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                  
                                                  {distributionTaxable > 0 && (
                                                    <div className="space-y-1 mt-2">
                                                      <div className="text-gray-400 font-semibold mb-1">Capital Gains:</div>
                                                      <div className="ml-2 flex justify-between">
                                                        <span className="text-gray-400">Taxable Account Withdrawals:</span>
                                                        <span className="text-gray-300">${distributionTaxable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                      </div>
                                                      {distributionTaxable > 0 && effectiveCapitalGainsTaxRate > 0 && (
                                                        <div className="ml-2 flex justify-between">
                                                          <span className="text-gray-400">Capital Gains Tax (IRS 2024 brackets):</span>
                                                          <span className="text-red-300 font-medium">${capitalGainsTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                        </div>
                                                      )}
                                                      {distributionTaxable > 0 && effectiveCapitalGainsTaxRate > 0 && (
                                                        <div className="ml-2 flex justify-between text-xs text-gray-500">
                                                          <span>Effective Rate:</span>
                                                          <span>{effectiveCapitalGainsTaxRate.toFixed(2)}%</span>
                                                        </div>
                                                      )}
                                                      {distributionTaxable > 0 && capitalGainsTax === 0 && (
                                                        <div className="ml-2 text-xs text-gray-500 italic">
                                                          No tax (within 0% capital gains bracket)
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                  
                                                  <div className="border-t border-gray-600 pt-2 mt-2 flex justify-between">
                                                    <span className="text-gray-200 font-semibold">Total Tax:</span>
                                                    <span className="text-red-300 font-bold">${((proj.tax || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                  </div>
                                                  <div className="text-gray-500 text-xs mt-1 italic">
                                                    Note: Tax calculation uses 2024 federal tax brackets and standard deductions. Actual tax may vary based on specific bracket thresholds.
                                                  </div>
                                                </>
                                              )
                                            })()}
                                          </div>
                                        </div>
                                      )}

                                      <div className="border-t border-gray-700 pt-2 mt-2">
                                        <div className="flex justify-between">
                                          <span className="text-gray-200 font-semibold">After-Tax Income:</span>
                                          <span className="text-green-300 font-bold">${((proj.after_tax_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        {prevProj && prevProj.after_tax_income != null && prevProj.after_tax_income > 0 ? (() => {
                                          const incomeChange = ((proj.after_tax_income || 0) - prevProj.after_tax_income) / prevProj.after_tax_income * 100
                                          return (
                                            <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                                              <span className="text-gray-300">Change from Last Year:</span>
                                              <span className={`font-semibold ${incomeChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(2)}%
                                              </span>
                                            </div>
                                          )
                                        })() : null}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )
                                })()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help border-b border-dotted border-gray-300">
                                      ${((proj.total_expenses || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">
                                    <div className="space-y-1">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Living:</span>
                                        <span>${(proj.living_expenses || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                      </div>
                                      {((proj.healthcare_expenses || proj.special_expenses || 0) > 0) && (
                                        <div className="flex justify-between gap-4">
                                          <span className="text-muted-foreground">Healthcare:</span>
                                          <span>${(proj.healthcare_expenses || proj.special_expenses || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                                (() => {
                                  const gapExcess = proj.gap_excess || 0
                                  const normalizedValue = Math.abs(gapExcess) < 0.0001 ? 0 : gapExcess
                                  return normalizedValue < 0 ? 'text-red-600' : normalizedValue > 0 ? 'text-green-600' : 'text-gray-900'
                                })()
                              }`}>
                                ${(() => {
                                  const gapExcess = proj.gap_excess || 0
                                  const normalizedValue = Math.abs(gapExcess) < 0.0001 ? 0 : gapExcess
                                  const displayValue = normalizedValue === 0 ? 0 : normalizedValue
                                  const formatted = displayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                  return formatted.replace(/^-0$/, '0')
                                })()}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                (proj.networth || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="cursor-help hover:text-blue-600 transition-colors">
                                      <div>
                                        ${((proj.networth || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        {prevProj && prevProj.networth != null && prevProj.networth !== 0 ? (() => {
                                          const prevNetworth = prevProj.networth || 0
                                          const currentNetworth = proj.networth || 0
                                          const networthChange = currentNetworth - prevNetworth
                                          let networthChangePercent = 0
                                          let signFlip = false
                                          if (prevNetworth !== 0) {
                                            const prevNeg = prevNetworth < 0
                                            const currNeg = currentNetworth < 0
                                            if (prevNeg && currNeg) {
                                              // Both negative
                                              const pct = (networthChange / Math.abs(prevNetworth)) * 100
                                              networthChangePercent = currentNetworth < prevNetworth ? -Math.abs(pct) : Math.abs(pct)
                                            } else if (prevNeg !== currNeg) {
                                              // Sign flip — percentage is misleading
                                              signFlip = true
                                              networthChangePercent = networthChange >= 0 ? 1 : -1 // just for direction
                                            } else {
                                              // Both positive — standard
                                              networthChangePercent = (networthChange / prevNetworth) * 100
                                            }
                                          }
                                          // Cap extreme percentages (e.g. from near-zero base)
                                          const cappedPct = Math.min(499, Math.max(-499, networthChangePercent))
                                          const capped = !signFlip && Math.abs(networthChangePercent) > 499
                                          return (
                                            <div className={`text-xs mt-0.5 ${networthChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {signFlip
                                                ? (networthChange >= 0 ? '↑ turned positive' : '↓ turned negative')
                                                : `${cappedPct >= 0 ? '+' : ''}${cappedPct.toFixed(2)}%${capped ? '+' : ''}`}
                                            </div>
                                          )
                                        })() : null}
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                                    <div className="text-sm space-y-2">
                                      <div className="font-semibold text-base mb-3 text-white">Remaining Funds Change Breakdown</div>
                                      
                                      {prevProj && (() => {
                                        
                                        const prevNetworth = prevProj.networth || 0
                                        const currentNetworth = proj.networth || 0
                                        const networthChange = currentNetworth - prevNetworth
                                        let networthChangePercent = 0
                                        let signFlipTooltip = false
                                        if (prevNetworth !== 0) {
                                          const prevNegT = prevNetworth < 0
                                          const currNegT = currentNetworth < 0
                                          if (prevNegT && currNegT) {
                                            const pct = (networthChange / Math.abs(prevNetworth)) * 100
                                            networthChangePercent = currentNetworth < prevNetworth ? -Math.abs(pct) : Math.abs(pct)
                                          } else if (prevNegT !== currNegT) {
                                            signFlipTooltip = true
                                            networthChangePercent = networthChange >= 0 ? 1 : -1
                                          } else {
                                            networthChangePercent = (networthChange / prevNetworth) * 100
                                          }
                                        }
                                        const cappedPctT = Math.min(499, Math.max(-499, networthChangePercent))
                                        const cappedT = !signFlipTooltip && Math.abs(networthChangePercent) > 499
                                        
                                        // Calculate contributions from actual balance changes (same method as individual account tooltips)
                                        // Use settingsForTooltip consistently - this is what the projections were calculated with
                                        const retirementAgeForCalc = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                                        const isRetired = proj.age >= retirementAgeForCalc
                                        const growthRate = isRetired 
                                          ? (settingsForTooltip?.growth_rate_during_retirement || DEFAULT_GROWTH_RATE_DURING_RETIREMENT)
                                          : (settingsForTooltip?.growth_rate_before_retirement || DEFAULT_GROWTH_RATE_PRE_RETIREMENT)
                                        
                                        // Calculate contributions for each account type from balance changes
                                        const calculateAccountContributions = (current: number, previous: number | null, distribution: number): number => {
                                          if (previous === null || isRetired) return 0
                                          const balanceAfterGrowth = previous * (1 + growthRate)
                                          // contributions = current + withdrawals - balanceAfterGrowth
                                          const contributions = current + distribution - balanceAfterGrowth
                                          return Math.max(0, contributions) // Can't have negative contributions
                                        }
                                        
                                        const contributions = 
                                          calculateAccountContributions(proj.balance_401k || 0, prevProj?.balance_401k || null, proj.distribution_401k || 0) +
                                          calculateAccountContributions(proj.balance_roth || 0, prevProj?.balance_roth || null, proj.distribution_roth || 0) +
                                          calculateAccountContributions(proj.balance_investment || 0, prevProj?.balance_investment || null, proj.distribution_taxable || 0) +
                                          calculateAccountContributions(proj.balance_hsa || 0, prevProj?.balance_hsa || null, proj.distribution_hsa || 0) +
                                          calculateAccountContributions(proj.balance_ira || 0, prevProj?.balance_ira || null, proj.distribution_ira || 0) +
                                          calculateAccountContributions(proj.balance_other_investments || 0, prevProj?.balance_other_investments || null, proj.distribution_other || 0)
                                        
                                        // Calculate total withdrawals
                                        const totalWithdrawals = 
                                          (proj.distribution_401k || 0) +
                                          (proj.distribution_ira || 0) +
                                          (proj.distribution_roth || 0) +
                                          (proj.distribution_taxable || 0) +
                                          (proj.distribution_hsa || 0) +
                                          (proj.distribution_other || 0)
                                        
                                        // Calculate total growth from all accounts
                                        const calculateAccountGrowth = (previous: number | null): number => {
                                          if (previous === null) return 0
                                          return previous * growthRate
                                        }
                                        
                                        const estimatedGrowth = 
                                          calculateAccountGrowth(prevProj?.balance_401k || null) +
                                          calculateAccountGrowth(prevProj?.balance_roth || null) +
                                          calculateAccountGrowth(prevProj?.balance_investment || null) +
                                          calculateAccountGrowth(prevProj?.balance_hsa || null) +
                                          calculateAccountGrowth(prevProj?.balance_ira || null) +
                                          calculateAccountGrowth(prevProj?.balance_other_investments || null)
                                        
                                        return (
                                          <>
                                            <div className="space-y-1">
                                              <div className="flex justify-between">
                                                <span className="text-gray-300">Previous Year Remaining Funds:</span>
                                                <span className="text-white font-medium">${prevNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                              </div>
                                              
                                              {contributions > 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Contributions:</span>
                                                  <span className="text-green-300 font-medium">+${contributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                              )}
                                              
                                              {estimatedGrowth > 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Investment Growth:</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-green-300 font-medium">+${estimatedGrowth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    <span className="text-green-300 text-xs">({(growthRate * 100).toFixed(2)}%)</span>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {estimatedGrowth < 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Investment Loss:</span>
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-red-300 font-medium">${estimatedGrowth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    <span className="text-red-300 text-xs">({(growthRate * 100).toFixed(2)}%)</span>
                                                  </div>
                                                </div>
                                              )}
                                              
                                              {estimatedGrowth === 0 && prevNetworth > 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Investment Growth:</span>
                                                  <span className="text-gray-400 text-xs">({(growthRate * 100).toFixed(2)}%)</span>
                                                </div>
                                              )}
                                              
                                              {totalWithdrawals > 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Withdrawals:</span>
                                                  <span className="text-red-300 font-medium">-${totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                              )}
                                              
                                              {(proj.tax || 0) > 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Taxes Paid:</span>
                                                  <span className="text-red-300 font-medium">-${((proj.tax || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Net Change */}
                                            <div className="border-t border-gray-700 pt-2 mt-2">
                                              <div className="flex justify-between">
                                                <span className="text-gray-200 font-semibold">Net Change:</span>
                                                <span className={`font-bold ${
                                                  networthChange >= 0 ? 'text-green-300' : 'text-red-300'
                                                }`}>
                                                  {networthChange >= 0 ? '+' : ''}${networthChange.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </span>
                                              </div>
                                              <div className="flex justify-between mt-2">
                                                <span className="text-gray-300">Change Percentage:</span>
                                                <span className={`font-semibold ${
                                                  networthChangePercent >= 0 ? 'text-green-300' : 'text-red-300'
                                                }`}>
                                                  {signFlipTooltip
                                                    ? (networthChange >= 0 ? '↑ turned positive' : '↓ turned negative')
                                                    : `${cappedPctT >= 0 ? '+' : ''}${cappedPctT.toFixed(2)}%${cappedT ? '+' : ''}`}
                                                </span>
                                              </div>
                                              <div className="flex justify-between mt-2 border-t border-gray-700 pt-2">
                                                <span className="text-gray-200 font-semibold">Current Remaining Funds:</span>
                                                <span className="text-white font-bold">${currentNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                              </div>
                                            </div>
                                          </>
                                        )
                                      })()}
                                      
                                      {idx === 0 && (
                                        <div className="text-gray-400 italic">
                                          This is the first year. No previous year to compare.
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            </tr>
                            )
                          })}
                      </tbody>
                    </table>
                    {results && (
                      <p className="mt-4 text-sm text-gray-600 text-center">
                        Showing projections until life expectancy (age {results.lifeExpectancy}). Switch to Advanced view for more details.
                      </p>
                    )}
                  </div>
                  )}
                  
                  {/* Graph View */}
                  {viewMode === 'graph' && (() => {
                    // Use settingsForTooltip values for consistency with calculations
                    const currentYear = new Date().getFullYear()
                    const birthYear = planDataForTooltip?.birth_year || (currentYear - 50)
                    const currentAgeCalc = currentYear - birthYear
                    const retirementAge = settingsForTooltip?.retirement_age || DEFAULT_RETIREMENT_AGE
                    
                    const filteredProjs = projections.filter(p => {
                      if (showPreRetirement) {
                        return p.age >= currentAgeCalc && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                      } else {
                        return p.age >= retirementAge && p.age <= (results?.lifeExpectancy || DEFAULT_LIFE_EXPECTANCY)
                      }
                    })
                    
                    if (filteredProjs.length === 0) {
                      return (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                          <p className="text-gray-600">
                            No projections match the current filter. Try enabling "Show Pre-Retirement Years".
                          </p>
                        </div>
                      )
                    }
                    
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <div className="h-[500px]">
                          <ResponsiveContainer width="100%" height="100%">
                            {graphType === 'line' ? (
                              <LineChart data={filteredProjs}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
                                <Line type="monotone" dataKey="after_tax_income" name="After-Tax Income" stroke="#16a34a" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="total_expenses" name="Expenses" stroke="#dc2626" strokeWidth={2} dot={false} />
                              </LineChart>
                            ) : graphType === 'area' ? (
                              <AreaChart data={filteredProjs}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
                              <BarChart data={filteredProjs}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                                <XAxis 
                                  dataKey="age" 
                                  label={{ value: 'Age', position: 'insideBottom', offset: -5 }}
                                  tick={{ fontSize: 12 }}
                                  interval={Math.ceil(filteredProjs.length / 15)}
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
                                <Bar dataKey="after_tax_income" name="After-Tax Income" fill="#16a34a" />
                                <Bar dataKey="total_expenses" name="Expenses" fill="#dc2626" />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                        <p className="mt-3 text-xs text-gray-500 text-center">
                          {graphType === 'line' && 'Line chart showing net worth, income, and expenses over time'}
                          {graphType === 'area' && 'Area chart showing net worth and stacked account balances over time'}
                          {graphType === 'bar' && 'Bar chart comparing income and expenses by age'}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              )}
            </>
          )}
        </>
      ) : null}

      {/* Local mode signup CTA */}
      {isLocal && results && (
        <div className="mt-8 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 p-6 text-center">
          <h3 className="text-lg font-semibold text-violet-900 dark:text-violet-100">Want deeper analysis?</h3>
          <p className="mt-1.5 text-sm text-violet-700 dark:text-violet-300 max-w-md mx-auto">
            Create a free account to unlock advanced projections, risk analysis, tax efficiency modeling, multiple scenarios, and PDF export.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/login?signup=1"
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            >
              Create Free Account <ArrowRight className="h-4 w-4" />
            </a>
            {onSwitchToAdvanced && (
              <button
                onClick={onSwitchToAdvanced}
                className="inline-flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:underline"
              >
                See what&apos;s included
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
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
import { ChevronRight, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, ArrowRight, Info, Calculator, Edit2, Save, X, Plus, Trash2, Check } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/property/ui/tooltip'

interface SnapshotTabProps {
  planId: number
  onSwitchToAdvanced?: () => void
}

interface QuickStartInputs {
  age: number
  retirementAge: number
  currentSavings: number
  annualContribution: number
  estimatedAnnualExpenses: number
  riskComfort: number // 0-100, where 0 = Conservative, 100 = Aggressive
  includeSsa: boolean
  ssaForTwo: boolean
  estimatedAnnualIncome: number // For SSA estimation
}

export default function SnapshotTab({ planId, onSwitchToAdvanced }: SnapshotTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(true)
  const [hasExistingData, setHasExistingData] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [planDataForTooltip, setPlanDataForTooltip] = useState<any>(null)
  const [accountsForTooltip, setAccountsForTooltip] = useState<Account[]>([])
  const [expensesForTooltip, setExpensesForTooltip] = useState<Expense[]>([])
  const [otherIncomeForTooltip, setOtherIncomeForTooltip] = useState<OtherIncome[]>([])
  const [settingsForTooltip, setSettingsForTooltip] = useState<CalculatorSettings | null>(null)
  const [projectionsForTooltip, setProjectionsForTooltip] = useState<ProjectionDetail[]>([])
  const [editingAssumptions, setEditingAssumptions] = useState(false)
  const [editedAssumptions, setEditedAssumptions] = useState<{
    growth_rate_before_retirement: number
    growth_rate_during_retirement: number
    inflation_rate: number
    ssa_start_age: number
  } | null>(null)
  
  // Quick Start inputs
  const [inputs, setInputs] = useState<QuickStartInputs>({
    age: 50,
    retirementAge: 65,
    currentSavings: 0,
    annualContribution: 0,
    estimatedAnnualExpenses: 70000, // Default: $70,000/year for a couple (general estimate)
    riskComfort: 50, // Middle of the road
    includeSsa: true, // Default to including SSA
    ssaForTwo: true, // Default to two people (general estimate)
    estimatedAnnualIncome: 0, // Will be used to estimate SSA
  })

  // SSA customization state
  const [showSsaCustomization, setShowSsaCustomization] = useState(false)
  const [ssaSettings, setSsaSettings] = useState({
    includeSsa: true, // Default to including SSA
    ssaForTwo: true, // Default to two people (general estimate)
    estimatedAnnualIncome: 0, // Will be used for estimation if provided
  })

  // Calculate estimated SSA based on annual income
  const calculateEstimatedSSA = (annualIncome: number, isPlanner: boolean = true): number => {
    if (!annualIncome || annualIncome <= 0) {
      // Use default estimates if no income provided
      return isPlanner ? 20000 : 15000
    }
    
    // Simplified SSA estimation based on income
    // SSA uses average indexed monthly earnings (AIME) and bend points
    // For quick estimation, we'll use a simplified formula:
    // - For income up to ~$50k: ~40% replacement
    // - For income $50k-$100k: ~30% replacement  
    // - For income above $100k: ~20% replacement (due to cap)
    
    const maxSSAIncome = 168600 // 2024 Social Security wage base
    const cappedIncome = Math.min(annualIncome, maxSSAIncome)
    
    let estimatedSSA = 0
    if (cappedIncome <= 50000) {
      estimatedSSA = cappedIncome * 0.40
    } else if (cappedIncome <= 100000) {
      estimatedSSA = 50000 * 0.40 + (cappedIncome - 50000) * 0.30
    } else {
      estimatedSSA = 50000 * 0.40 + 50000 * 0.30 + (cappedIncome - 100000) * 0.20
    }
    
    // Adjust for spouse (typically 50% of primary if lower earner, or their own benefit)
    if (!isPlanner) {
      // Spouse benefit is typically 50% of primary or their own benefit, whichever is higher
      // For quick start, we'll use 75% of primary as a reasonable estimate
      estimatedSSA = estimatedSSA * 0.75
    }
    
    // Ensure minimum and maximum bounds
    const minSSA = isPlanner ? 15000 : 10000
    const maxSSA = isPlanner ? 45000 : 35000
    return Math.max(minSSA, Math.min(maxSSA, estimatedSSA))
  }

  const estimatedPlannerSSA = inputs.includeSsa ? calculateEstimatedSSA(inputs.estimatedAnnualIncome, true) : 0
  const estimatedSpouseSSA = inputs.includeSsa && inputs.ssaForTwo ? calculateEstimatedSSA(inputs.estimatedAnnualIncome, false) : 0
  const totalEstimatedSSA = estimatedPlannerSSA + estimatedSpouseSSA
  
  // Results
  const [results, setResults] = useState<{
    monthlyRetirementIncome: number
    annualRetirementIncome: number
    confidenceScore: number
    status: 'on-track' | 'close' | 'at-risk'
    recommendation: string
    yearsMoneyLasts: number
    biggestRisks: string[]
    improvements: string[]
    lifeExpectancy: number
    legacyValue: number
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
  const ssaSettingsInitialized = useRef(false)

  useEffect(() => {
    checkExistingData()
  }, [planId, selectedScenarioId])

  const checkExistingData = async () => {
    try {
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
    if (!selectedScenarioId) return
    
    setCalculating(true)
    try {
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

      const accounts: Account[] = (accountsData.data || []).map(acc => ({
        id: acc.id,
        account_name: acc.account_name,
        owner: acc.owner || 'planner',
        balance: acc.balance || 0,
        account_type: acc.account_type || 'Other',
        annual_contribution: acc.annual_contribution || 0,
      }))

      const expenses: Expense[] = (expensesData.data || []).map(exp => ({
        id: exp.id,
        expense_name: exp.expense_name,
        amount_before_65: exp.amount_before_65 || 0,
        amount_after_65: exp.amount_after_65 || 0,
      }))

      const otherIncome: OtherIncome[] = (incomeData.data || []).map(inc => ({
        id: inc.id,
        income_name: inc.income_source || '',
        amount: inc.annual_amount || 0,
        start_year: inc.start_year || undefined,
        end_year: inc.end_year || undefined,
        inflation_adjusted: inc.inflation_adjusted || false,
      }))

      const currentYear = new Date().getFullYear()
      const birthYear = planData.data.birth_year || (currentYear - 50)
      const retirementAge = settingsData.data.retirement_age || 65
      const yearsToRetirement = retirementAge - (currentYear - birthYear)
      
      const totalSavings = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
      const monthlyExpenses = expenses.reduce((sum, exp) => {
        const amount = retirementAge >= 65 ? (exp.amount_after_65 || 0) : (exp.amount_before_65 || 0)
        return sum + amount
      }, 0)
      const annualExpenses = monthlyExpenses * 12

      // Calculate simple projection - use common helper function to ensure consistency
      const settings = buildCalculatorSettings(
        settingsData.data,
        planData.data,
        currentYear,
        retirementAge,
        yearsToRetirement,
        annualExpenses
      )

      // Use provided SSA settings if available, otherwise use database values
      const includePlannerSsa = useSSASettings?.includeSsa ?? ((settingsData.data.planner_ssa_income as boolean) ?? true)
      const includeSpouseSsa = useSSASettings?.ssaForTwo ?? ((settingsData.data.spouse_ssa_income as boolean) ?? true)

      const projections = calculateRetirementProjections(
        birthYear,
        accounts,
        expenses,
        otherIncome,
        settings,
        planData.data.life_expectancy || 90,
        planData.data.spouse_birth_year || undefined,
        planData.data.spouse_life_expectancy || undefined,
        includePlannerSsa,
        includeSpouseSsa
      )

      // Calculate snapshot results
      const snapshotResults = calculateSnapshotResults(projections, totalSavings, annualExpenses, yearsToRetirement, settings, planData.data.life_expectancy || 90)
      setResults(snapshotResults)
      setProjections(projections) // Store projections for simplified view
      
      // Store data for tooltip
      setPlanDataForTooltip(planData.data)
      setAccountsForTooltip(accounts)
      setExpensesForTooltip(expenses)
      setOtherIncomeForTooltip(otherIncome)
      setSettingsForTooltip(settings)
      setProjectionsForTooltip(projections)
      
      // Update quick start inputs from existing data (only if not using custom SSA settings)
      if (!useSSASettings) {
        setInputs({
          age: currentYear - birthYear,
          retirementAge: retirementAge,
          currentSavings: totalSavings,
          annualContribution: accounts.reduce((sum, acc) => sum + (acc.annual_contribution || 0), 0),
          estimatedAnnualExpenses: annualExpenses || 70000, // Use calculated expenses or default
          riskComfort: 50, // Default
          includeSsa: settingsData.data.planner_ssa_income ?? true,
          ssaForTwo: settingsData.data.spouse_ssa_income ?? true, // Default to true for general estimate
          estimatedAnnualIncome: 0, // Not stored, user can enter
        })

        // Update SSA settings state from saved data
        setSsaSettings({
          includeSsa: settingsData.data.planner_ssa_income ?? true,
          ssaForTwo: settingsData.data.spouse_ssa_income ?? true,
          estimatedAnnualIncome: 0, // Not stored in DB, user can customize
        })
        ssaSettingsInitialized.current = true
      }
    } catch (error) {
      console.error('Error calculating snapshot:', error)
    } finally {
      setCalculating(false)
    }
  }

  // Recalculate when SSA settings change (with debouncing for income field)
  useEffect(() => {
    // Only recalculate if we have results (meaning data has been loaded) and we're in quick start view
    if (!results || !selectedScenarioId || !showQuickStart) return
    
    // Skip recalculation on initial load - only recalculate when user changes settings
    if (!ssaSettingsInitialized.current) return

    // Debounce the recalculation, especially for income field changes
    const timeoutId = setTimeout(() => {
      loadAndCalculateSnapshot({
        includeSsa: ssaSettings.includeSsa ?? true,
        ssaForTwo: ssaSettings.ssaForTwo ?? true,
      })
    }, 800) // 800ms debounce for income field

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssaSettings.includeSsa, ssaSettings.ssaForTwo, ssaSettings.estimatedAnnualIncome])

  const calculateSnapshotResults = (
    projections: ProjectionDetail[],
    currentSavings: number,
    annualExpenses: number,
    yearsToRetirement: number,
    settings: CalculatorSettings,
    lifeExpectancy: number = 90
  ) => {
    const retirementProjections = projections.filter(p => p.age >= settings.retirement_age)
    
    if (retirementProjections.length === 0) {
      return {
        monthlyRetirementIncome: 0,
        annualRetirementIncome: 0,
        confidenceScore: 0,
        status: 'at-risk' as const,
        recommendation: 'Please complete your plan details to see projections.',
        yearsMoneyLasts: 0,
        biggestRisks: ['Incomplete plan data'],
        improvements: ['Add your accounts and expenses'],
        lifeExpectancy,
        legacyValue: 0,
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

    // Calculate average monthly income in retirement (first 10 years)
    const earlyRetirementYears = retirementProjections.slice(0, 10)
    const avgMonthlyIncome = earlyRetirementYears.length > 0
      ? earlyRetirementYears.reduce((sum, p) => sum + (p.after_tax_income || 0), 0) / earlyRetirementYears.length / 12
      : 0

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
    if (confidenceScore >= 80) {
      status = 'on-track'
    } else if (confidenceScore >= 60) {
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
    
    // Calculate key metrics for risk assessment
    const firstYearExpenses = retirementProjections[0]?.total_expenses || retirementProjections[0]?.living_expenses || annualExpenses
    const startingNetworth = retirementProjections[0]?.networth || currentSavings
    const withdrawalRate = startingNetworth > 0 ? (firstYearExpenses / startingNetworth) * 100 : 0
    const growthRateDuring = (settings.growth_rate_during_retirement || 0.05) * 100
    const inflationRate = (settings.inflation_rate || 0.03) * 100
    
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
    
    // Risk: High withdrawal rate
    if (withdrawalRate > 5) {
      risks.push(`High withdrawal rate of ${withdrawalRate.toFixed(1)}% (recommended: 4% or less)`)
    } else if (withdrawalRate > 4) {
      risks.push(`Withdrawal rate of ${withdrawalRate.toFixed(1)}% is above the recommended 4%`)
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
        risks.push(`Passive income covers only ${avgCoverage.toFixed(0)}% of expenses - heavy reliance on withdrawals`)
      } else {
        risks.push(`SSA + other income cover only ${avgCoverage.toFixed(0)}% of expenses in ${lowIncomeCoverageYears.length} year${lowIncomeCoverageYears.length > 1 ? 's' : ''}`)
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
    } else if (confidenceScore >= 80 && yearsToRetirement > 0) {
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
      const expenseReduction = firstYearExpenses - (startingNetworth * 0.04)
      if (expenseReduction > 0) {
        improvements.push(`Reduce annual expenses by $${expenseReduction.toLocaleString(undefined, { maximumFractionDigits: 0 })} to reach 4% withdrawal rate`)
      }
    }
    
    // Growth rate adjustment if too aggressive
    if (growthRateDuring > 7) {
      improvements.push('Consider conservative growth assumptions (5-6%) for retirement projections')
    }
    
    // SSA optimization
    if (settings.ssa_start_age && settings.ssa_start_age < 67) {
      improvements.push(`Delaying Social Security to age 67+ increases benefits by ~8% per year`)
    }
    
    // Additional suggestions based on situation
    if (yearsToRetirement > 5 && currentSavings < annualExpenses * 15) {
      improvements.push('Maximize employer 401(k) match if available')
    }
    
    // Keep only top 4 improvements
    const topImprovements = improvements.slice(0, 4)

    // Build calculation details for tooltips
    const totalIncomeFirst10Years = earlyRetirementYears.reduce((sum, p) => sum + (p.after_tax_income || 0), 0)
    const avgAnnualIncome = totalIncomeFirst10Years / earlyRetirementYears.length
    
    // Calculate expense details for tooltip
    const firstRetirementYear = retirementProjections[0]
    const firstYearLivingExpenses = firstRetirementYear?.living_expenses || 0
    const currentYearExpenses = annualExpenses
    const inflationRateDecimal = settings.inflation_rate || 0.04
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
      monthlyIncomeCalculation: `Average monthly income = (Sum of after-tax income for first 10 retirement years) / 10 years / 12 months\n\nTotal income (10 years): $${totalIncomeFirst10Years.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nAverage annual income: $${avgAnnualIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nAverage monthly income: $${Math.round(avgMonthlyIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}\n\nThis represents your average monthly after-tax income during the first 10 years of retirement.`,
      confidenceScoreCalculation: `Confidence Score = (1 - Shortfall Ratio) × 100\n\nTotal retirement years: ${totalYears}\nYears with shortfall (gap < -$1,000): ${yearsWithShortfall}\nShortfall ratio: ${(shortfallRatio * 100).toFixed(2)}%\n\nConfidence Score: ${confidenceScore}%\n\nThis score indicates the likelihood your plan will succeed based on how often you face income shortfalls.`,
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
      statusCalculation: `Status is determined by Confidence Score:\n\n• On Track: Confidence Score ≥ 80%\n• Close: Confidence Score 60-79%\n• At Risk: Confidence Score < 60%\n\nYour score: ${confidenceScore}%\nYour status: ${status === 'on-track' ? 'On Track' : status === 'close' ? 'Close' : 'At Risk'}`,
      expenseCalculation: `Expense Calculation at Retirement Start:\n\nCurrent Year Expenses: $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\nYears to Retirement: ${yearsToRetirement}\nInflation Rate: ${(inflationRateDecimal * 100).toFixed(2)}%\n\nExpenses at Retirement Start = Current Expenses × (1 + Inflation Rate)^Years to Retirement\nExpenses at Retirement Start = $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} × (1 + ${(inflationRateDecimal * 100).toFixed(2)}%)^${yearsToRetirement}\nExpenses at Retirement Start = $${currentYearExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${Math.pow(1 + inflationRateDecimal, yearsToRetirement).toFixed(4)}\nExpenses at Retirement Start = $${Math.round(expensesAtRetirementStart).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\n\nFirst Year Retirement Expenses: $${Math.round(firstYearLivingExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year\n\nExpenses continue to inflate each year after retirement at ${(inflationRateDecimal * 100).toFixed(2)}% per year.`,
      legacyValueCalculation,
    }

    return {
      monthlyRetirementIncome: Math.round(avgMonthlyIncome),
      annualRetirementIncome: Math.round(avgMonthlyIncome * 12),
      confidenceScore,
      status,
      recommendation,
      yearsMoneyLasts: Math.round(yearsMoneyLasts),
      biggestRisks: topRisks,
      improvements: topImprovements,
      lifeExpectancy,
      legacyValue: Math.round(legacyValue),
      fundsRunOutAge,
      incomeCoverageAtFundsRunOut,
      calculationDetails,
    }
  }

  const handleQuickStartCalculate = async () => {
    setCalculating(true)
    setSaving(true)
    setMessage(null)
    try {
      // Convert quick start inputs to full plan structure
      const currentYear = new Date().getFullYear()
      const birthYear = currentYear - inputs.age
      const yearsToRetirement = inputs.retirementAge - inputs.age
      
      // Estimate growth rate based on risk comfort (Conservative = 6%, Aggressive = 10%)
      const growthRate = 0.06 + (inputs.riskComfort / 100) * 0.04
      
      // Save plan basis (birth year, filing status, and include_spouse)
      // If includeSpouseSsa is true (ssaForTwo), ensure include_spouse is also true
      const { error: planError } = await supabase
        .from('rp_retirement_plans')
        .update({
          birth_year: birthYear,
          life_expectancy: 90, // Default
          filing_status: inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single', // Set filing status based on whether spouse is included
          include_spouse: inputs.ssaForTwo, // If spouse SSA is included, spouse should be included in plan
        })
        .eq('id', planId)
      
      if (planError) throw planError

      // Get or create default scenario
      let scenarioId = selectedScenarioId
      if (!scenarioId) {
        // Check if default scenario exists
        const { data: existingScenarios } = await supabase
          .from('rp_scenarios')
          .select('*')
          .eq('plan_id', planId)
          .eq('is_default', true)
          .limit(1)
        
        if (existingScenarios && existingScenarios.length > 0) {
          scenarioId = existingScenarios[0].id
        } else {
          // Create default scenario
          const { data: newScenario, error: scenarioError } = await supabase
            .from('rp_scenarios')
            .insert([{
              plan_id: planId,
              scenario_name: 'Default',
              is_default: true,
            }])
            .select()
            .single()
          
          if (scenarioError) throw scenarioError
          scenarioId = newScenario.id
          setSelectedScenarioId(scenarioId)
        }
      }

      // Delete existing accounts and expenses to replace with Quick Start data
      await supabase.from('rp_accounts').delete().eq('plan_id', planId)
      await supabase.from('rp_expenses').delete().eq('plan_id', planId)

      // Create simplified account
      const { error: accountError } = await supabase
        .from('rp_accounts')
        .insert([{
          plan_id: planId,
          account_name: 'Combined Savings',
          owner: 'planner',
          balance: inputs.currentSavings,
          account_type: '401k',
          annual_contribution: inputs.annualContribution,
        }])
      
      if (accountError) throw accountError

      // Use provided annual expenses, convert to monthly for expenses table
      const estimatedMonthlyExpenses = inputs.estimatedAnnualExpenses / 12
      
      const { error: expenseError } = await supabase
        .from('rp_expenses')
        .insert([{
          plan_id: planId,
          expense_name: 'Living Expenses',
          amount_before_65: estimatedMonthlyExpenses,
          amount_after_65: estimatedMonthlyExpenses * 0.9,
        }])
      
      if (expenseError) throw expenseError

      // Save calculator settings - use provided annual expenses
      // Inflate expenses to retirement start year (current expenses adjusted for inflation)
      const inflationRate = 0.04 // 4% default inflation rate
      const retirementStartExpenses = inputs.estimatedAnnualExpenses * 0.9 * Math.pow(1 + inflationRate, yearsToRetirement)
      
      // Use goal-based strategy to ensure expenses are always covered
      const settingsData = {
        plan_id: planId,
        scenario_id: scenarioId,
        retirement_age: inputs.retirementAge,
        retirement_start_year: currentYear + yearsToRetirement,
        years_to_retirement: yearsToRetirement,
        annual_retirement_expenses: retirementStartExpenses, // Expenses at retirement start (inflated from current)
        growth_rate_before_retirement: growthRate,
        growth_rate_during_retirement: growthRate * 0.7,
        inflation_rate: 0.04,
        planner_ssa_income: true, // Default to including SSA
        spouse_ssa_income: inputs.ssaForTwo, // Set based on whether spouse is included
        ssa_start_age: 62, // Default SSA start age
        // Explicitly set goal-based strategy to ensure expenses are always covered
        withdrawal_strategy_type: 'goal_based',
        withdrawal_priority: 'default', // Tax-efficient default strategy
        withdrawal_secondary_priority: 'tax_optimization',
        enable_borrowing: false, // Don't allow borrowing in Quick Start
      }

      // Check if settings exist (use maybeSingle to avoid error if not found)
      const { data: existingSettings, error: checkError } = await supabase
        .from('rp_calculator_settings')
        .select('id')
        .eq('scenario_id', scenarioId)
        .maybeSingle()

      if (checkError) {
        console.error('Error checking existing settings:', checkError)
        throw checkError
      }

      if (existingSettings) {
        const { error: settingsError } = await supabase
          .from('rp_calculator_settings')
          .update(settingsData)
          .eq('scenario_id', scenarioId)
        
        if (settingsError) {
          console.error('Error updating settings:', settingsError)
          throw settingsError
        }
      } else {
        const { error: settingsError } = await supabase
          .from('rp_calculator_settings')
          .insert([settingsData])
        
        if (settingsError) {
          console.error('Error inserting settings:', settingsError)
          throw settingsError
        }
      }

      // Now calculate projections with saved data
      const accounts: Account[] = [{
        id: 0,
        account_name: 'Combined Savings',
        owner: 'planner',
        balance: inputs.currentSavings,
        account_type: '401k',
        annual_contribution: inputs.annualContribution,
      }]

      const expenses: Expense[] = [{
        id: 0,
        expense_name: 'Living Expenses',
        amount_before_65: estimatedMonthlyExpenses,
        amount_after_65: estimatedMonthlyExpenses * 0.9,
      }]

      // Get filing_status from plan basis (we just saved it)
      const { data: planDataForFilingStatus } = await supabase
        .from('rp_retirement_plans')
        .select('filing_status')
        .eq('id', planId)
        .single()

      const settings: CalculatorSettings = {
        current_year: currentYear,
        retirement_age: inputs.retirementAge,
        retirement_start_year: currentYear + yearsToRetirement,
        years_to_retirement: yearsToRetirement,
        annual_retirement_expenses: retirementStartExpenses, // Use inflated expenses at retirement start
        growth_rate_before_retirement: growthRate,
        growth_rate_during_retirement: growthRate * 0.7,
        inflation_rate: 0.04,
        filing_status: (planDataForFilingStatus?.filing_status as any) || (inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single'),
        // Use goal-based strategy with default priority to ensure expenses are always covered
        withdrawal_strategy_type: 'goal_based',
        withdrawal_priority: 'default', // Tax-efficient strategy that covers expenses
        withdrawal_secondary_priority: 'tax_optimization',
        enable_borrowing: false, // Don't allow borrowing in Quick Start
      }

      // Determine SSA inclusion based on inputs
      // ssaForTwo defaults to true (not shown in quick form, but assumed for general estimate)
      const includePlannerSsa = inputs.includeSsa ?? true
      const includeSpouseSsa = inputs.ssaForTwo ?? true // Default to true for general estimate (two people)

      const projections = calculateRetirementProjections(
        birthYear,
        accounts,
        expenses,
        [],
        settings,
        90,
        undefined, // spouseBirthYear - not used in quick start
        undefined, // spouseLifeExpectancy - not used in quick start
        includePlannerSsa,
        includeSpouseSsa
      )

      const snapshotResults = calculateSnapshotResults(
        projections,
        inputs.currentSavings,
        inputs.estimatedAnnualExpenses, // Use provided annual expenses
        yearsToRetirement,
        settings,
        90 // Default life expectancy for quick start
      )
      
      setResults(snapshotResults)
      setProjections(projections) // Store projections for simplified view
      setHasExistingData(true)
      
      // Store data for tooltip
      setPlanDataForTooltip({
        birth_year: birthYear,
        life_expectancy: 90,
        include_spouse: inputs.ssaForTwo,
        filing_status: inputs.ssaForTwo ? 'Married Filing Jointly' : 'Single',
      })
      setAccountsForTooltip(accounts)
      setExpensesForTooltip(expenses)
      setSettingsForTooltip(settings)
      setProjectionsForTooltip(projections)
      // Keep showQuickStart as true to show results in Simple view, not Advanced
      setMessage({ type: 'success', text: 'Your plan has been saved! Results are shown below.' })
      setTimeout(() => setMessage(null), 5000)
      
      // Reload to ensure scenario is selected
      if (scenarioId) {
        setSelectedScenarioId(scenarioId)
      }
    } catch (error: any) {
      console.error('Error saving quick start:', error)
      
      // Handle Supabase errors - they can have different structures
      let errorMessage = 'Failed to save your plan. Please try again.'
      
      if (error) {
        // Supabase errors typically have a message property
        if (error.message) {
          errorMessage = error.message
        } else if (error.details) {
          errorMessage = error.details
        } else if (error.hint) {
          errorMessage = error.hint
        } else if (typeof error === 'string') {
          errorMessage = error
        } else {
          // Try to stringify the error to see what we have
          try {
            const errorStr = JSON.stringify(error, null, 2)
            console.error('Error details:', errorStr)
            errorMessage = `Error: ${errorStr.substring(0, 200)}`
          } catch {
            errorMessage = 'An unknown error occurred. Please check the console for details.'
          }
        }
      }
      
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setCalculating(false)
      setSaving(false)
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

      {showQuickStart ? (
        <>
          {/* Quick Start Form */}
          {!results && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Start</h2>
                <p className="text-gray-600">
                  Get your retirement snapshot in 2 minutes. We'll use smart defaults for everything else.
                </p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Age
                    </label>
                    <input
                      type="number"
                      value={inputs.age || ''}
                      onChange={(e) => setInputs({ ...inputs, age: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min="18"
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Planned Retirement Age
                    </label>
                    <input
                      type="number"
                      value={inputs.retirementAge || ''}
                      onChange={(e) => setInputs({ ...inputs, retirementAge: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      min={inputs.age}
                      max="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Savings
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={inputs.currentSavings || ''}
                        onChange={(e) => setInputs({ ...inputs, currentSavings: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Total across all retirement accounts</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Annual Contribution
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={inputs.annualContribution || ''}
                        onChange={(e) => setInputs({ ...inputs, annualContribution: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">How much you save each year</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Annual Expenses
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        value={inputs.estimatedAnnualExpenses || ''}
                        onChange={(e) => setInputs({ ...inputs, estimatedAnnualExpenses: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="70000"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Expected annual expenses in retirement (default: $70,000 for a couple)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Comfort
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {inputs.riskComfort < 33 ? 'Conservative' : inputs.riskComfort < 67 ? 'Moderate' : 'Aggressive'}
                      </span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={inputs.riskComfort}
                      onChange={(e) => setInputs({ ...inputs, riskComfort: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Conservative</span>
                      <span>Aggressive</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Affects expected investment returns</p>
                  </div>
                </div>

                <button
                  onClick={handleQuickStartCalculate}
                  disabled={calculating || saving || !inputs.age || !inputs.retirementAge || inputs.currentSavings === 0 || !inputs.estimatedAnnualExpenses}
                  className="w-full rounded-md bg-blue-100 px-6 py-3 text-base font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(calculating || saving) ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>{saving ? 'Saving...' : 'Calculating...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Save & See My Retirement Snapshot</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
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
                            const retirementAge = settingsForTooltip?.retirement_age || 65
                            const lifeExpectancy = planDataForTooltip?.life_expectancy || 90
                            const finalProjection = projectionsForTooltip[projectionsForTooltip.length - 1]
                            const finalAge = finalProjection?.age || 0
                            const zeroNetworthYear = projectionsForTooltip.findIndex(p => (p.networth || 0) <= 0)
                            const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projectionsForTooltip[zeroNetworthYear]?.age || 0) : finalAge
                            
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
                                            growth_rate_during_retirement: settingsForTooltip?.growth_rate_during_retirement || 0.05,
                                            inflation_rate: settingsForTooltip?.inflation_rate || 0.04,
                                            ssa_start_age: settingsForTooltip?.ssa_start_age || 62,
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
                                                setTimeout(() => setMessage(null), 3000)
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
                                              value={editedAssumptions.ssa_start_age || 62}
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
                                        <p><span className="text-gray-500">Growth Rate (During Retirement):</span> {((settingsForTooltip?.growth_rate_during_retirement || 0.05) * 100).toFixed(2)}%</p>
                                        <p><span className="text-gray-500">Inflation Rate:</span> {((settingsForTooltip?.inflation_rate || 0.04) * 100).toFixed(2)}%</p>
                                        <p><span className="text-gray-500">Taxes:</span> Using IRS brackets</p>
                                        <p><span className="text-gray-500">SSA Start Age:</span> {settingsForTooltip?.ssa_start_age || 62} years</p>
                                      </>
                                    )}
                                    <p><span className="text-gray-500">Filing Status:</span> {planDataForTooltip?.filing_status || 'Single'}</p>
                                    <p><span className="text-gray-500">Borrowing Enabled:</span> {settingsForTooltip?.enable_borrowing ? 'Yes' : 'No'}</p>
                                  </div>
                                </div>
                                
                                <div className="border-t border-gray-700 pt-2">
                                  <h4 className="font-semibold text-purple-400 mb-2">Projection Summary</h4>
                                  <div className="space-y-1 text-gray-300">
                                    <p><span className="text-gray-500">Projection Start Year:</span> {projectionsForTooltip[0]?.year || 'N/A'}</p>
                                    <p><span className="text-gray-500">Projection End Year:</span> {finalProjection?.year || 'N/A'}</p>
                                    <p><span className="text-gray-500">Final Age:</span> {finalAge} years</p>
                                    <p><span className="text-gray-500">Age at Zero Networth:</span> {zeroNetworthYear >= 0 ? `${ageAtZeroNetworth} years` : 'Not reached'}</p>
                                    <p><span className="text-gray-500">Total Retirement Years:</span> {projectionsForTooltip.filter(p => p.age >= retirementAge).length} years</p>
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
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-lg sm:text-xl font-bold mb-4
                    ${results.status === 'on-track' ? 'bg-green-100 text-green-800' : ''}
                    ${results.status === 'close' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${results.status === 'at-risk' ? 'bg-red-100 text-red-800' : ''}
                  ">
                    {results.status === 'on-track' && <CheckCircle2 className="h-5 w-5" />}
                    {results.status === 'close' && <AlertCircle className="h-5 w-5" />}
                    {results.status === 'at-risk' && <AlertCircle className="h-5 w-5" />}
                    <span>
                      {results.status === 'on-track' ? 'Your Plan is On Track' : results.status === 'close' ? 'Your Plan is Close' : 'Your Plan is At Risk'}
                    </span>
                    {results.calculationDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-4 w-4" />
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
                </div>

                {/* Confidence Score - Main Message */}
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Confidence Score</h3>
                    {results.calculationDetails && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="cursor-help">
                            <Info className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                          <div className="text-sm whitespace-pre-line">
                            {results.calculationDetails.confidenceScoreCalculation}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">{results.confidenceScore}%</span>
                    <div className="w-64 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${
                          results.confidenceScore >= 80 ? 'bg-green-500' :
                          results.confidenceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${results.confidenceScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {results.confidenceScore}% likelihood your plan will succeed
                    </p>
                  </div>
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
                      <p className="text-xs text-gray-500">Expenses at Retirement Start</p>
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
                      <p className="text-xs text-gray-600 mt-1">per month</p>
                    </div>
                    <div className="text-gray-400">/</div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                        ${((results.annualRetirementIncome ?? results.monthlyRetirementIncome * 12) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">per year</p>
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
                              const retirementAge = settingsForTooltip?.retirement_age || 65
                              const lifeExpectancy = planDataForTooltip?.life_expectancy || results.lifeExpectancy || 90
                              const finalProjection = projectionsForTooltip[projectionsForTooltip.length - 1]
                              const finalAge = finalProjection?.age || 0
                              const zeroNetworthYear = projectionsForTooltip.findIndex(p => (p.networth || 0) <= 0)
                              const ageAtZeroNetworth = zeroNetworthYear >= 0 ? (projectionsForTooltip[zeroNetworthYear]?.age || 0) : finalAge
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
                                      <p><span className="text-gray-500">Growth Rate (During Retirement):</span> {((settingsForTooltip?.growth_rate_during_retirement || 0.05) * 100).toFixed(2)}%</p>
                                      <p><span className="text-gray-500">Inflation Rate:</span> {((settingsForTooltip?.inflation_rate || 0.04) * 100).toFixed(2)}%</p>
                                    </div>
                                  </div>
                                  
                                  <div className="border-t border-gray-700 pt-2">
                                    <h4 className="font-semibold text-purple-400 mb-2">Projection Details</h4>
                                    <div className="space-y-1 text-gray-300">
                                      <p><span className="text-gray-500">Age at Zero Networth:</span> {zeroNetworthYear >= 0 ? `${ageAtZeroNetworth} years` : 'Not reached'}</p>
                                      <p><span className="text-gray-500">Longevity Beyond Life Expectancy:</span> {longevityBeyondLifeExpectancy.toFixed(2)} years</p>
                                      <p><span className="text-gray-500">Total Retirement Years:</span> {projectionsForTooltip.filter(p => p.age >= retirementAge).length} years</p>
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
                      : `Estimated value at life expectancy (age ${results.lifeExpectancy})`}
                  </p>
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-600" />
                    Social Security Income
                  </h3>
                  <button
                    onClick={() => setShowSsaCustomization(!showSsaCustomization)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showSsaCustomization ? 'Hide' : 'Estimate based on current income'}
                  </button>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  Your projections include Social Security benefits. We've estimated benefits for two people based on general assumptions.
                </p>
                {!showSsaCustomization && (
                  <div className="text-sm text-gray-600">
                    <p>• Estimated total SSA: <span className="font-semibold text-gray-900">${Math.round(totalEstimatedSSA).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                    {estimatedPlannerSSA > 0 && (
                      <p>• Your estimated benefit: ${Math.round(estimatedPlannerSSA).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                    )}
                    {estimatedSpouseSSA > 0 && (
                      <p>• Spouse estimated benefit: ${Math.round(estimatedSpouseSSA).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</p>
                    )}
                  </div>
                )}
                
                {showSsaCustomization && (
                  <div className="mt-4 space-y-4 bg-white rounded-md p-4 border border-gray-200">
                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={ssaSettings.includeSsa ?? true}
                          onChange={(e) => {
                            const isChecked = e.target.checked
                            setSsaSettings({ 
                              ...ssaSettings, 
                              includeSsa: isChecked,
                              // When unchecking, also clear spouse SSA
                              ssaForTwo: isChecked ? ssaSettings.ssaForTwo : false
                            })
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Include Social Security income in projections</span>
                      </label>
                    </div>

                    {ssaSettings.includeSsa && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Current Annual Income
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 inline-block ml-1 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs bg-gray-900 text-gray-100 border border-gray-700">
                                <p className="text-xs text-gray-200">
                                  Your current annual income helps us estimate your Social Security benefits. 
                                  Social Security uses your highest 35 years of earnings.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                            <input
                              type="number"
                              value={ssaSettings.estimatedAnnualIncome || ''}
                              onChange={(e) => setSsaSettings({ ...ssaSettings, estimatedAnnualIncome: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded-md border border-gray-300 pl-8 pr-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="0"
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">Used to estimate your Social Security benefits</p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={ssaSettings.ssaForTwo ?? true}
                              onChange={(e) => setSsaSettings({ ...ssaSettings, ssaForTwo: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Include Social Security for spouse/partner</span>
                          </label>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-md p-4">
                          <p className="text-sm font-medium text-gray-900 mb-2">Updated Estimated Social Security Benefits:</p>
                          <div className="space-y-1 text-sm text-gray-700">
                            {ssaSettings.includeSsa && calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, true) > 0 && (
                              <p>• Your estimated benefit: <span className="font-semibold">${Math.round(calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, true)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                            )}
                            {ssaSettings.includeSsa && ssaSettings.ssaForTwo && calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, false) > 0 && (
                              <p>• Spouse estimated benefit: <span className="font-semibold">${Math.round(calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, false)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</span></p>
                            )}
                            <p className="pt-2 border-t border-green-200">
                              <strong>Total: ${Math.round(
                                (ssaSettings.includeSsa ? calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, true) : 0) +
                                (ssaSettings.includeSsa && ssaSettings.ssaForTwo ? calculateEstimatedSSA(ssaSettings.estimatedAnnualIncome, false) : 0)
                              ).toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</strong>
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Save button - always visible regardless of includeSsa setting */}
                    <button
                      onClick={async () => {
                        // Save SSA settings to profile
                        try {
                          const { error: planError } = await supabase
                            .from('rp_retirement_plans')
                            .update({
                              // Store SSA income estimate in plan (we'll use this for display)
                            })
                            .eq('id', planId)
                          
                          if (planError) throw planError

                          // Update scenario settings
                          if (selectedScenarioId) {
                            // When includeSsa is false, clear both planner and spouse SSA
                            const plannerSsaIncome = ssaSettings.includeSsa ? true : false
                            const spouseSsaIncome = ssaSettings.includeSsa && ssaSettings.ssaForTwo ? true : false
                            
                            // If spouse_ssa_income is true, ensure include_spouse is also true
                            if (spouseSsaIncome) {
                              const { error: planUpdateError } = await supabase
                                .from('rp_retirement_plans')
                                .update({ include_spouse: true })
                                .eq('id', planId)
                              
                              if (planUpdateError) {
                                console.error('Error updating include_spouse:', planUpdateError)
                                // Don't throw - continue with settings update
                              }
                            }
                            
                            const { error: settingsError } = await supabase
                              .from('rp_calculator_settings')
                              .update({
                                planner_ssa_income: plannerSsaIncome,
                                spouse_ssa_income: spouseSsaIncome,
                              })
                              .eq('scenario_id', selectedScenarioId)
                            
                            if (settingsError) throw settingsError
                          }

                          // Update inputs to match
                          setInputs({ ...inputs, includeSsa: ssaSettings.includeSsa, ssaForTwo: ssaSettings.ssaForTwo, estimatedAnnualIncome: ssaSettings.estimatedAnnualIncome })
                          
                          setMessage({ type: 'success', text: 'SSA assumptions saved to your profile!' })
                          setTimeout(() => setMessage(null), 5000)
                          
                          // Recalculate with new SSA settings (use current state values)
                          await loadAndCalculateSnapshot({
                            includeSsa: ssaSettings.includeSsa ?? true,
                            ssaForTwo: ssaSettings.ssaForTwo ?? true,
                          })
                        } catch (error: any) {
                          console.error('Error saving SSA settings:', error)
                          setMessage({ type: 'error', text: error.message || 'Failed to save SSA settings. Please try again.' })
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                    >
                      <Save className="w-4 h-4" />
                      Save to Profile & Recalculate
                    </button>
                  </div>
                )}
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
                    <button
                      onClick={() => {
                        setResults(null)
                        setShowQuickStart(true)
                      }}
                      className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Change Plan Inputs
                    </button>
                  </div>
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
                    <span>See Advanced Planning</span>
                  </button>
                </div>
              </div>

              {/* Simplified Projections View */}
              {showProjections && projections.length > 0 && (
                <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Year-by-Year Projections</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Year</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Age</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Income</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Expenses</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Gap/Excess</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Remaining Funds</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {projections
                          .filter(p => p.age >= (inputs.retirementAge || 65) && p.age <= (results?.lifeExpectancy || 90))
                          .map((proj, idx) => (
                            <tr key={idx} className={proj.gap_excess && proj.gap_excess < -1000 ? 'bg-red-50' : ''}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{proj.year}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{proj.age}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="cursor-help hover:text-blue-600 transition-colors">
                                      <div>
                                        ${((proj.after_tax_income || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        {idx > 0 && (() => {
                                          const prevProj = projections
                                            .filter(p => p.age >= (inputs.retirementAge || 65) && p.age <= (results?.lifeExpectancy || 90))
                                            [idx - 1]
                                          if (!prevProj || !prevProj.after_tax_income || prevProj.after_tax_income === 0) return null
                                          const incomeChange = ((proj.after_tax_income || 0) - prevProj.after_tax_income) / prevProj.after_tax_income * 100
                                          return (
                                            <div className={`text-xs mt-0.5 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(2)}%
                                            </div>
                                          )
                                        })()}
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
                                              // Use same calculation logic as retirement-projections.ts
                                              // Determine filing status using the same logic as the main calculation
                                              const includeSpouseSsa = planDataForTooltip?.include_spouse || false
                                              const filingStatus = determineFilingStatus(includeSpouseSsa, planDataForTooltip?.filing_status)
                                              const standardDeduction = filingStatus === 'Married Filing Jointly' ? 29200 : 14600
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
                                        {idx > 0 && (() => {
                                          const prevProj = projections
                                            .filter(p => p.age >= (inputs.retirementAge || 65) && p.age <= (results?.lifeExpectancy || 90))
                                            [idx - 1]
                                          if (prevProj && prevProj.after_tax_income && prevProj.after_tax_income !== 0) {
                                            const incomeChange = ((proj.after_tax_income || 0) - prevProj.after_tax_income) / prevProj.after_tax_income * 100
                                            return (
                                              <div className="flex justify-between border-t border-gray-700 pt-2 mt-2">
                                                <span className="text-gray-300">Change from Last Year:</span>
                                                <span className={`font-semibold ${incomeChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                  {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(2)}%
                                                </span>
                                              </div>
                                            )
                                          }
                                          return null
                                        })()}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                ${((proj.total_expenses || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                                (proj.gap_excess || 0) < 0 ? 'text-red-600' : 'text-green-600'
                              }`}>
                                ${((proj.gap_excess || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button className="cursor-help hover:text-blue-600 transition-colors">
                                      <div>
                                        ${((proj.networth || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        {idx > 0 && (() => {
                                          const prevProj = projections
                                            .filter(p => p.age >= (inputs.retirementAge || 65) && p.age <= (results?.lifeExpectancy || 90))
                                            [idx - 1]
                                          if (!prevProj || !prevProj.networth || prevProj.networth === 0) return null
                                          const networthChange = ((proj.networth || 0) - prevProj.networth) / prevProj.networth * 100
                                          return (
                                            <div className={`text-xs mt-0.5 ${networthChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {networthChange >= 0 ? '+' : ''}{networthChange.toFixed(2)}%
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                                    <div className="text-sm space-y-2">
                                      <div className="font-semibold text-base mb-3 text-white">Remaining Funds Change Breakdown</div>
                                      
                                      {idx > 0 && (() => {
                                        const prevProj = projections
                                          .filter(p => p.age >= (inputs.retirementAge || 65) && p.age <= (results?.lifeExpectancy || 90))
                                          [idx - 1]
                                        
                                        if (!prevProj) return null
                                        
                                        const prevNetworth = prevProj.networth || 0
                                        const currentNetworth = proj.networth || 0
                                        const networthChange = currentNetworth - prevNetworth
                                        const networthChangePercent = prevNetworth !== 0 ? (networthChange / prevNetworth * 100) : 0
                                        
                                        // Calculate contributions (only in pre-retirement years)
                                        const isRetired = proj.age >= (inputs.retirementAge || 65)
                                        const contributions = isRetired ? 0 : (inputs.annualContribution || 0)
                                        
                                        // Calculate total withdrawals
                                        const totalWithdrawals = 
                                          (proj.distribution_401k || 0) +
                                          (proj.distribution_ira || 0) +
                                          (proj.distribution_roth || 0) +
                                          (proj.distribution_taxable || 0) +
                                          (proj.distribution_hsa || 0) +
                                          (proj.distribution_other || 0)
                                        
                                        // Estimate growth (simplified: change - contributions + withdrawals)
                                        // Growth = Current - Previous - Contributions + Withdrawals
                                        const estimatedGrowth = networthChange - contributions + totalWithdrawals
                                        
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
                                                  <span className="text-green-300 font-medium">+${estimatedGrowth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                              )}
                                              
                                              {estimatedGrowth < 0 && (
                                                <div className="flex justify-between">
                                                  <span className="text-gray-300">Investment Loss:</span>
                                                  <span className="text-red-300 font-medium">${estimatedGrowth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
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
                                                  {networthChangePercent >= 0 ? '+' : ''}{networthChangePercent.toFixed(2)}%
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
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {results && (
                    <p className="mt-4 text-sm text-gray-600 text-center">
                      Showing projections until life expectancy (age {results.lifeExpectancy}). Switch to Advanced view for more details.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}

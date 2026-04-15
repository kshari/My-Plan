'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'
import { 
  runMonteCarloSimulation, 
  runDeterministicStressTest,
  type MonteCarloSummary,
  type DeterministicStressResult,
} from '@/lib/utils/monte-carlo'
import { Calculator, Play, Save, TrendingDown, TrendingUp, Activity, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingState } from '@/components/ui/loading-state'
import {
  INCOME_TAX_BRACKETS,
  CAPITAL_GAINS_BRACKETS,
  getStandardDeduction,
  DEFAULT_MARGINAL_TAX_RATE,
  SSA_TAXABLE_PORTION,
  TOP_MARGINAL_RATE,
  type FilingStatus,
} from '@/lib/constants/tax-brackets'
import { calculateMarginalTaxRate } from '@/lib/utils/tax-calculations'
import {
  SSA_FULL_RETIREMENT_AGE,
  ssaClaimingMultiplier,
} from '@/lib/constants/ssa-constants'
import {
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
  DEFAULT_INFLATION_RATE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_FILING_STATUS,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  RMD_START_AGE,
  SAFE_WITHDRAWAL_RATE,
  SCORE_ON_TRACK_THRESHOLD,
  SCORE_CLOSE_THRESHOLD,
  SCORE_MEDIUM_RISK_THRESHOLD,
  SCORE_AT_RISK_THRESHOLD,
  SCORE_WEIGHT_LONGEVITY,
  SCORE_WEIGHT_MONTE_CARLO,
  SCORE_WEIGHT_CASHFLOW,
  SCORE_WEIGHT_TAX_EFFICIENCY,
  SCORE_WEIGHT_INFLATION,
  SCORE_WEIGHT_MEDICAL,
  MEDICARE_ELIGIBILITY_AGE,
  ROTH_CONVERSION_MAX,
  ROTH_CONVERSION_FRACTION,
} from '@/lib/constants/retirement-defaults'

interface AnalysisTabProps {
  planId: number
  /** When true, automatically runs Monte Carlo after the main analysis loads. */
  autoRunMonteCarlo?: boolean
  /** When true, pre-expand the RMD year-by-year breakdown table (useful for print). */
  initialRmdDetailsExpanded?: boolean
}

interface RetirementScore {
  overall: number
  sustainability: number
  taxEfficiency: number
  longevity: number
  inflation: number
  medical: number
  monteCarlo: number
  riskLevel: 'Low' | 'Medium' | 'High'
  details: {
    longevity: string
    cashflow: string
    taxEfficiency: string
    inflation: string
    medical: string
    monteCarlo: string
  }
}

interface Risk {
  type: string
  severity: 'Low' | 'Medium' | 'High'
  description: string
  recommendation: string
}

interface Recommendation {
  category: string
  priority: 'High' | 'Medium' | 'Low'
  title: string
  description: string
  impact: string
}

export default function AnalysisTab({ planId, autoRunMonteCarlo, initialRmdDetailsExpanded }: AnalysisTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [rmdDetailsExpanded, setRmdDetailsExpanded] = useState(initialRmdDetailsExpanded ?? false)
  const [score, setScore] = useState<RetirementScore | null>(null)
  const [risks, setRisks] = useState<Risk[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [rmdAnalysis, setRmdAnalysis] = useState<any>(null)
  const [taxEfficiency, setTaxEfficiency] = useState<any>(null)
  const [monteCarloSummary, setMonteCarloSummary] = useState<MonteCarloSummary | null>(null)
  const [stressTestResult, setStressTestResult] = useState<DeterministicStressResult | null>(null)
  const [runningMonteCarlo, setRunningMonteCarlo] = useState(false)
  const [scenarios, setScenarios] = useState<Array<{ id: number; scenario_name: string; is_default: boolean }>>([])
  const [showRothExplanation, setShowRothExplanation] = useState(false)
  const [showTaxSavingsCalculation, setShowTaxSavingsCalculation] = useState(false)
  const [showTaxInputForm, setShowTaxInputForm] = useState(false)
  const [currentGrossIncome, setCurrentGrossIncome] = useState<number | null>(null)
  const [currentTaxBracket, setCurrentTaxBracket] = useState<number | null>(null)
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [savingTaxInfo, setSavingTaxInfo] = useState(false)
  const [currentSettings, setCurrentSettings] = useState<CalculatorSettings | null>(null)

  // Refs to hold latest projections/settings so runMonteCarlo can recalculate score with MC success rate
  const latestProjectionsRef = useRef<ProjectionDetail[]>([])
  const latestSettingsRef = useRef<CalculatorSettings | null>(null)
  const latestAccountsRef = useRef<Account[]>([])

  useEffect(() => {
    loadScenarios()
  }, [planId])

  useEffect(() => {
    // Clear previous analysis when scenario changes
    setScore(null)
    setRisks([])
    setRecommendations([])
    setRmdAnalysis(null)
    setMonteCarloSummary(null)
    setStressTestResult(null)
    
    if (selectedScenarioId) {
      calculateAnalysis()
    }
  }, [planId, selectedScenarioId])

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

  const calculateAnalysis = async () => {
    if (!selectedScenarioId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      console.log('Calculating analysis for scenario:', selectedScenarioId)
      // Load all necessary data
      const [planData, accountsData, expensesData, incomeData, settingsData, projectionsData] = await Promise.all([
        supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, include_spouse, filing_status, spouse_birth_year, spouse_life_expectancy').eq('id', planId).single(),
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
        supabase.from('rp_projection_details').select('*').eq('scenario_id', selectedScenarioId).order('year'),
      ])

      if (planData.error || !planData.data?.birth_year) {
        setLoading(false)
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

      // Build full settings using the shared helper — same as snapshot-tab and details-tab
      // so baseline stress-test / Monte Carlo projections match main projections exactly.
      const _analysisCurrentYear = settingsData.data?.current_year || new Date().getFullYear()
      const _analysisRetirementAge = settingsData.data?.retirement_age || DEFAULT_RETIREMENT_AGE
      const _analysisYearsToRetirement = settingsData.data?.years_to_retirement != null
        ? settingsData.data.years_to_retirement
        : (_analysisRetirementAge - (_analysisCurrentYear - planData.data.birth_year))
      const annualExpensesForSettings = settingsData.data?.annual_retirement_expenses || 0

      const settings: CalculatorSettings = buildCalculatorSettings(
        settingsData.data,
        planData.data,
        _analysisCurrentYear,
        _analysisRetirementAge,
        _analysisYearsToRetirement,
        annualExpensesForSettings
      )

      // Compute SSA parameters — mirrors logic in snapshot-tab.tsx so all three views agree.
      const includePlannerSsa: boolean = (settingsData.data?.planner_ssa_income as boolean) ?? true
      const explicitSpouseSsa: boolean = (settingsData.data?.spouse_ssa_income as boolean) ?? false
      const hasSpouse = planData.data.include_spouse || false
      const isMarriedFilingJointly = planData.data.filing_status === 'Married Filing Jointly'
      const includeSpouseSsa = explicitSpouseSsa || hasSpouse || isMarriedFilingJointly

      const estimatedIncomeForSsa = Number(settingsData.data?.estimated_ssa_annual_income) || 0
      const plannerBenefit = settingsData.data?.planner_ssa_annual_benefit != null
        ? Number(settingsData.data.planner_ssa_annual_benefit)
        : (includePlannerSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, true) : DEFAULT_SSA_ANNUAL_BENEFIT) : 0)
      const spouseBenefit = settingsData.data?.spouse_ssa_annual_benefit != null
        ? Number(settingsData.data.spouse_ssa_annual_benefit)
        : (includeSpouseSsa ? (estimatedIncomeForSsa > 0 ? calculateEstimatedSSA(estimatedIncomeForSsa, false) : DEFAULT_SPOUSE_SSA_BENEFIT) : 0)

      const ssaStartAge = settings.ssa_start_age || settings.retirement_age || DEFAULT_RETIREMENT_AGE
      const projCurrentAge = _analysisCurrentYear - planData.data.birth_year
      const yearsToSsaStart = Math.max(0, ssaStartAge - projCurrentAge)
      const inflationToSsaStart = Math.pow(1 + settings.inflation_rate, yearsToSsaStart)

      const estimatedPlannerSsaAtStart = includePlannerSsa ? plannerBenefit * inflationToSsaStart : undefined
      const estimatedSpouseSsaAtStart = includeSpouseSsa ? spouseBenefit * inflationToSsaStart : undefined

      const projections: ProjectionDetail[] = (projectionsData.data || []).map((p: any) => ({
        year: p.year,
        age: p.age,
        event: p.event,
        ssa_income: p.ssa_income || 0,
        distribution_401k: p.distribution_401k || 0,
        distribution_roth: p.distribution_roth || 0,
        investment_income: p.investment_income || 0,
        other_recurring_income: p.other_recurring_income || 0,
        total_income: p.total_income || 0,
        after_tax_income: p.after_tax_income || 0,
        living_expenses: p.living_expenses || 0,
        total_expenses: p.total_expenses || 0,
        gap_excess: p.gap_excess || 0,
        cumulative_liability: p.cumulative_liability || 0,
        networth: p.networth || 0,
        balance_401k: p.balance_401k || 0,
        balance_roth: p.balance_roth || 0,
        balance_investment: p.balance_investment || 0,
        taxable_income: p.taxable_income || 0,
        tax: p.tax || 0,
        healthcare_expenses: (p as any).healthcare_expenses || 0,
        special_expenses: p.special_expenses || 0,
      }))

      // Store projections/settings/accounts so runMonteCarlo can later refresh the score with the MC rate
      latestProjectionsRef.current = projections
      latestSettingsRef.current = settings
      latestAccountsRef.current = accounts

      // Calculate analysis metrics — analyzeRMDs must run first so identifyRisks can delegate to it
      const calculatedRmdAnalysis = analyzeRMDs(projections, settings, accounts)
      const calculatedRisks = identifyRisks(projections, settings, accounts, calculatedRmdAnalysis)
      const calculatedRecommendations = generateRecommendations(projections, settings, accounts, expenses)
      const calculatedScore = calculateRetirementScore(projections, settings, accounts)
      
      // Deterministic stress test: bear sequence in first years of retirement vs steady growth
      const lifeExpectancy = planData.data?.life_expectancy ?? DEFAULT_LIFE_EXPECTANCY
      try {
        const stress = runDeterministicStressTest(
          planData.data.birth_year,
          accounts,
          expenses,
          otherIncome,
          settings,
          lifeExpectancy,
          planData.data.spouse_birth_year || undefined,
          planData.data.spouse_life_expectancy || undefined,
          includePlannerSsa,
          includeSpouseSsa,
          estimatedPlannerSsaAtStart,
          estimatedSpouseSsaAtStart
        )
        setStressTestResult(stress)
        const extreme = stress.scenarios.find(s => s.name === 'Extreme (40% yr 1)')
        const worstFailing = stress.scenarios.find(s => !s.run.success)
        if (extreme && !extreme.run.success) {
          calculatedRisks.push({
            type: 'Sequence of Returns Risk',
            severity: 'High',
            description: 'Under a simulated 40% crash in year 1 of retirement, your plan may not sustain through life expectancy.',
            recommendation: 'Consider a more conservative withdrawal strategy in early retirement, or maintain a larger cash reserve to weather market downturns.',
          })
        } else if (worstFailing) {
          calculatedRisks.push({
            type: 'Sequence of Returns Risk',
            severity: 'Medium',
            description: `Under the "${worstFailing.name}" bear scenario, your plan may not sustain through life expectancy.`,
            recommendation: 'Consider reducing withdrawals in the first few years of retirement or holding a cash buffer.',
          })
        } else {
          const worst = stress.scenarios.reduce((a, b) => a.run.finalNetworth < b.run.finalNetworth ? a : b)
          if (worst.run.finalNetworth < stress.baseline.finalNetworth * 0.5) {
            calculatedRisks.push({
              type: 'Sequence of Returns Risk',
              severity: 'Low',
              description: 'A severe bear market in early retirement could significantly reduce your ending net worth compared to steady growth.',
              recommendation: 'Consider reducing withdrawals in the first few years of retirement or holding a cash buffer.',
            })
          }
        }
      } catch (e) {
        console.error('Stress test failed', e)
        setStressTestResult(null)
      }

      setScore(calculatedScore)
      setRisks(calculatedRisks)
      setRecommendations(calculatedRecommendations)
      setRmdAnalysis(calculatedRmdAnalysis)
    } catch (error) {
      console.error('Error calculating analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  const runMonteCarlo = useCallback(async (silent = false) => {
    setRunningMonteCarlo(true)
    try {
      const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
        supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, include_spouse, filing_status, spouse_birth_year, spouse_life_expectancy').eq('id', planId).single(),
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
      ])
      if (planData.error) {
        if (!silent) alert(`Failed to load plan data: ${planData.error.message}`)
        else console.error('Monte Carlo: failed to load plan data', planData.error)
        return
      }
      if (!planData.data?.birth_year) {
        if (!silent) alert('Please set birth year in Plan Details first')
        else console.warn('Monte Carlo: birth_year not set')
        return
      }
      const accounts: Account[] = (accountsData.data || []).map(acc => ({ id: acc.id, account_name: acc.account_name, owner: acc.owner || '', balance: acc.balance || 0, account_type: acc.account_type, annual_contribution: acc.annual_contribution || 0 }))
      const expenses: Expense[] = (expensesData.data || []).map(exp => ({ id: exp.id, expense_name: exp.expense_name, amount_after_65: exp.amount_after_65 || 0, amount_before_65: exp.amount_before_65 || 0 }))
      const otherIncome: OtherIncome[] = (incomeData.data || []).map(inc => ({ id: inc.id, income_name: inc.income_source || '', amount: inc.annual_amount || 0, start_year: inc.start_year || undefined, end_year: inc.end_year || undefined, inflation_adjusted: inc.inflation_adjusted || false }))

      const _mcCurrentYear = settingsData.data?.current_year || new Date().getFullYear()
      const _mcRetirementAge = settingsData.data?.retirement_age || DEFAULT_RETIREMENT_AGE
      const _mcYearsToRetirement = settingsData.data?.years_to_retirement != null
        ? settingsData.data.years_to_retirement
        : (_mcRetirementAge - (_mcCurrentYear - planData.data.birth_year))

      const mcSettings: CalculatorSettings = buildCalculatorSettings(
        settingsData.data,
        planData.data,
        _mcCurrentYear,
        _mcRetirementAge,
        _mcYearsToRetirement,
        settingsData.data?.annual_retirement_expenses || 0
      )

      // SSA params — same logic as calculateAnalysis / snapshot-tab
      const mcIncludePlannerSsa: boolean = (settingsData.data?.planner_ssa_income as boolean) ?? true
      const mcExplicitSpouseSsa: boolean = (settingsData.data?.spouse_ssa_income as boolean) ?? false
      const mcHasSpouse = planData.data.include_spouse || false
      const mcIsMarried = planData.data.filing_status === 'Married Filing Jointly'
      const mcIncludeSpouseSsa = mcExplicitSpouseSsa || mcHasSpouse || mcIsMarried

      const mcEstimatedIncome = Number(settingsData.data?.estimated_ssa_annual_income) || 0
      const mcPlannerBenefit = settingsData.data?.planner_ssa_annual_benefit != null
        ? Number(settingsData.data.planner_ssa_annual_benefit)
        : (mcIncludePlannerSsa ? (mcEstimatedIncome > 0 ? calculateEstimatedSSA(mcEstimatedIncome, true) : DEFAULT_SSA_ANNUAL_BENEFIT) : 0)
      const mcSpouseBenefit = settingsData.data?.spouse_ssa_annual_benefit != null
        ? Number(settingsData.data.spouse_ssa_annual_benefit)
        : (mcIncludeSpouseSsa ? (mcEstimatedIncome > 0 ? calculateEstimatedSSA(mcEstimatedIncome, false) : DEFAULT_SPOUSE_SSA_BENEFIT) : 0)

      const mcSsaStartAge = mcSettings.ssa_start_age || mcSettings.retirement_age || DEFAULT_RETIREMENT_AGE
      const mcCurrentAge = _mcCurrentYear - planData.data.birth_year
      const mcYearsToSsa = Math.max(0, mcSsaStartAge - mcCurrentAge)
      const mcInflation = Math.pow(1 + mcSettings.inflation_rate, mcYearsToSsa)
      const mcPlannerSsaAtStart = mcIncludePlannerSsa ? mcPlannerBenefit * mcInflation : undefined
      const mcSpouseSsaAtStart = mcIncludeSpouseSsa ? mcSpouseBenefit * mcInflation : undefined

      const { summary } = runMonteCarloSimulation(
        planData.data.birth_year,
        accounts,
        expenses,
        otherIncome,
        mcSettings,
        planData.data.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
        1000,
        planData.data.spouse_birth_year || undefined,
        planData.data.spouse_life_expectancy || undefined,
        mcIncludePlannerSsa,
        mcIncludeSpouseSsa,
        mcPlannerSsaAtStart,
        mcSpouseSsaAtStart
      )
      setMonteCarloSummary(summary)
      // Recalculate retirement score with the MC success rate now that we have it
      if (latestProjectionsRef.current.length > 0 && latestSettingsRef.current) {
        const updatedScore = calculateRetirementScore(
          latestProjectionsRef.current,
          latestSettingsRef.current,
          latestAccountsRef.current,
          summary.successRate
        )
        setScore(updatedScore)
      }
    } catch (error) {
      console.error('Error running Monte Carlo:', error)
      if (!silent) alert('Failed to run Monte Carlo simulation')
    } finally {
      setRunningMonteCarlo(false)
    }
  }, [planId, selectedScenarioId])

  // When autoRunMonteCarlo is set, trigger MC automatically once the main analysis score loads
  useEffect(() => {
    if (!autoRunMonteCarlo || !score || !selectedScenarioId || monteCarloSummary || runningMonteCarlo) return
    runMonteCarlo(true)
  }, [autoRunMonteCarlo, score, selectedScenarioId, monteCarloSummary, runningMonteCarlo, runMonteCarlo])

  if (loading) {
    return <LoadingState message="Calculating analysis…" />
  }

  if (!selectedScenarioId) {
    return (
      <div className="text-center py-8 text-gray-600">
        Please select a scenario in Plan Details to view analysis.
      </div>
    )
  }

  if (!score) {
    return (
      <div className="text-center py-8 text-gray-600">
        No analysis data available. Please calculate projections first.
      </div>
    )
  }

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <div className="flex items-center justify-between rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2.5">
          <label className="text-sm font-medium text-muted-foreground">Scenario</label>
          <Select
            value={selectedScenarioId?.toString() || ''}
            onValueChange={(v) => setSelectedScenarioId(parseInt(v))}
          >
            <SelectTrigger className="h-8 text-sm w-auto min-w-[160px]">
              <SelectValue placeholder="No scenarios available" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario) => (
                <SelectItem key={scenario.id} value={scenario.id.toString()}>
                  {scenario.scenario_name}{scenario.is_default ? ' (Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Retirement Score */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Retirement Score</h3>
          <p className="text-sm text-gray-600 mb-4">
            The retirement score (0-100) evaluates your plan across multiple dimensions. 
            <strong> Longevity ({(SCORE_WEIGHT_LONGEVITY * 100).toFixed(0)}% weight)</strong> assesses asset preservation - maintaining net worth over time.
            <strong> Market Risk ({(SCORE_WEIGHT_MONTE_CARLO * 100).toFixed(0)}% weight)</strong> reflects Monte Carlo success rate across 1,000 randomised market scenarios — run Monte Carlo below to activate this factor.
            <strong> Cashflow ({(SCORE_WEIGHT_CASHFLOW * 100).toFixed(0)}% weight)</strong> measures cash flow consistency - fewer negative years = higher score.
            <strong> Tax Efficiency ({(SCORE_WEIGHT_TAX_EFFICIENCY * 100).toFixed(0)}% weight)</strong> evaluates how well you minimize taxes over retirement.
            <strong> Inflation ({(SCORE_WEIGHT_INFLATION * 100).toFixed(0)}% weight)</strong> evaluates how well income keeps up with expense growth.
            <strong> Medical ({(SCORE_WEIGHT_MEDICAL * 100).toFixed(0)}% weight)</strong> assesses health care expense risk based on healthcare costs vs total expenses.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-600">{score.overall}</div>
            <div className="text-sm text-gray-600 mt-1">Overall Score</div>
            <div className={`text-xs mt-1 px-2 py-1 rounded inline-block ${
              score.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
              score.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {score.riskLevel} Risk
            </div>
          </div>
          <TooltipProvider>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-3xl font-semibold text-gray-900">{score.longevity}</div>
                    <div className="text-sm text-gray-600 mt-1">Longevity</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_LONGEVITY * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Longevity Score Calculation</p>
                    {score.details?.longevity && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.longevity.split('\n').map((line, i) => (
                          <p key={i} className="text-xs text-green-300">{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Measures asset preservation over retirement period.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Score = min(100, (Final Networth / Initial Networth) × 50 + 50)
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Initial Networth = Networth at retirement age</li>
                      <li>Final Networth = Networth at end of projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Maintaining 100%+ of initial networth = Score of 100</li>
                      <li>Maintaining 0% of initial networth = Score of 50</li>
                      <li>Below 0% (negative) = Score of 0</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Bengen (1994) "Determining Withdrawal Rates Using Historical Data" - 4% rule emphasizes maintaining principal to ensure 30-year sustainability.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className={`text-3xl font-semibold ${monteCarloSummary ? 'text-gray-900' : 'text-gray-400'}`}>{score.monteCarlo}</div>
                    <div className="text-sm text-gray-600 mt-1">Market Risk</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_MONTE_CARLO * 100).toFixed(0)}% weight)</div>
                    {!monteCarloSummary && (
                      <div className="text-xs text-amber-600 mt-1">↓ Run MC below</div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Market Risk Score</p>
                    {score.details?.monteCarlo && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.monteCarlo.split('\n').map((line, i) => (
                          <p key={i} className={`text-xs ${monteCarloSummary ? 'text-green-300' : 'text-yellow-300'}`}>{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Maps the Monte Carlo success rate directly to a 0-100 score. A 70% MC success rate = score of 70.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Score = MC success rate (0–100%)<br/>
                      Default = 50 (neutral) until Monte Carlo is run
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Success = portfolio ends with positive net worth at life expectancy</li>
                      <li>1,000 simulations with σ=12% during retirement, floored at −40%</li>
                      <li>Captures sequence-of-returns risk the deterministic model misses</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Interpretation:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>≥90% — Very strong (Low Risk)</li>
                      <li>70–90% — Adequate (Medium Risk)</li>
                      <li>&lt;70% — Needs attention (High Risk)</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-3xl font-semibold text-gray-900">{score.sustainability}</div>
                    <div className="text-sm text-gray-600 mt-1">Cashflow</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_CASHFLOW * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Cashflow Score Calculation</p>
                    {score.details?.cashflow && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.cashflow.split('\n').map((line, i) => (
                          <p key={i} className="text-xs text-green-300">{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Measures cash flow consistency - fewer negative years = higher score.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Score = max(0, 100 - (Negative Years / Total Years) × 100)
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Negative Years = Count of years where gap_excess &lt; 0</li>
                      <li>Total Years = Total number of projection years</li>
                      <li>Gap/Excess = Total Income - Total Expenses - Tax</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>0% negative years = Score of 100</li>
                      <li>50% negative years = Score of 50</li>
                      <li>100% negative years = Score of 0</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Pfau (2015) "Safe Withdrawal Rates for Retirees" - Consistent positive cash flow is critical for retirement sustainability, with &lt;20% negative years being optimal.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-3xl font-semibold text-gray-900">{score.taxEfficiency}</div>
                    <div className="text-sm text-gray-600 mt-1">Tax Efficiency</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_TAX_EFFICIENCY * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Tax Efficiency Score Calculation</p>
                    {score.details?.taxEfficiency && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.taxEfficiency.split('\n').map((line, i) => (
                          <p key={i} className="text-xs text-green-300">{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Evaluates how well taxes are minimized over retirement.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Score = max(0, 100 - (Total Taxes / Total Income) × 100 × 2)
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Total Taxes = Sum of all tax payments across projections</li>
                      <li>Total Income = Sum of all income (SSA, distributions, other) across projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Tax rate of 0% = Score of 100</li>
                      <li>Tax rate of 25% = Score of 50</li>
                      <li>Tax rate of 50%+ = Score of 0</li>
                      <li>Multiplier of 2 penalizes higher tax rates more severely</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Kitces (2013) "The Tax Torpedo and Social Security Planning" - Strategic withdrawal sequencing from tax-advantaged accounts can reduce lifetime tax burden by 10-30%.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-3xl font-semibold text-gray-900">{score.inflation}</div>
                    <div className="text-sm text-gray-600 mt-1">Inflation</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_INFLATION * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Inflation Score Calculation</p>
                    {score.details?.inflation && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.inflation.split('\n').map((line, i) => (
                          <p key={i} className="text-xs text-green-300">{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Evaluates how well income keeps up with expense growth due to inflation.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Expense Growth Rate = (Late Expenses - Early Expenses) / Early Expenses<br/>
                      Income Growth Rate = (Late Income - Early Income) / Early Income<br/>
                      Gap = Expense Growth Rate - Income Growth Rate<br/>
                      Score = max(0, 100 - (Gap / Expense Growth Rate) × 100)
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Early Period = First 1/3 of retirement years</li>
                      <li>Late Period = Last 1/3 of retirement years</li>
                      <li>Early/Late Expenses = Average expenses in that period</li>
                      <li>Early/Late Income = Average income in that period</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Income growth = Expense growth = Score of 100</li>
                      <li>Income growth = 0, Expense growth &gt; 0 = Lower score</li>
                      <li>Uses scenario inflation rate assumption for projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Blanchett (2014) "Estimating the True Cost of Retirement" - Health care costs grow at 2-3x general inflation rate. Fidelity estimates average retiree needs $315K for health care (2023).</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="text-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-3xl font-semibold text-gray-900">{score.medical}</div>
                    <div className="text-sm text-gray-600 mt-1">Medical</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_MEDICAL * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Medical/Health Care Score Calculation</p>
                    {score.details?.medical && (
                      <div className="mb-3 p-2 bg-gray-800 rounded border border-gray-600">
                        <p className="text-xs font-medium text-gray-200 mb-1">Your plan:</p>
                        {score.details.medical.split('\n').map((line, i) => (
                          <p key={i} className="text-xs text-green-300">{line}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mb-2 text-gray-200">Assesses plan readiness to handle medical expenses across four signals: coverage, healthcare burden, pre-Medicare gap, and HSA buffer.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula (when healthcare configured):</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Score = Coverage×40% + Burden×35% + PreMedicare×25% + HSA bonus<br/>
                      Burden Score = max(0, 100 − healthcare% × 250)<br/>
                      PreMedicare penalty = min(50, yearsBeforeMedicare × 5)
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Coverage = % of retirement years income covers all expenses</li>
                      <li>Healthcare burden = lifetime healthcare ÷ total retirement expenses</li>
                      <li>Pre-Medicare gap = years of private insurance before age 65</li>
                      <li>HSA bonus = up to 15 pts ($10k per 2 pts)</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Fidelity Retiree Health Care Cost Estimate (2023) - Average 65-year-old couple needs $315K for health care. HealthView Services projects 5.5% annual health care inflation vs 2.5% general inflation.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        {!monteCarloSummary && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <strong>Market Risk score is estimated at 50 (neutral)</strong> until you run the Monte Carlo simulation below. Running it will update this factor with real probability data and may change the Overall Score.
          </p>
        )}
      </div>

      {/* Market Risks & Monte Carlo */}
      <div className="rounded-xl border bg-card p-6">
        {/* Section header */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Market Risk Analysis</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stress-test your plan against real-world market volatility and uncertainty.
          </p>
        </div>

        {/* ── Deterministic Stress Test (5 bear scenarios) ── */}
        {stressTestResult && (() => {
          const { baseline, scenarios } = stressTestResult
          const anyFails = scenarios.some(s => !s.run.success) || baseline.finalNetworth < 0 || baseline.yearsWithNegativeCashFlow > 0
          const headerBg = !anyFails ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-destructive/8 border-destructive/20'
          const fmt = (n: number) => n < 0 ? `-$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          return (
            <div className={`mb-6 rounded-xl border overflow-hidden ${headerBg}`}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-inherit">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-semibold text-sm">Deterministic Stress Test</span>
                </div>
                <Badge variant={anyFails ? 'destructive' : 'secondary'} className={!anyFails ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' : ''}>
                  {anyFails ? 'At risk under bear scenarios' : 'Plan survives all 5 bear scenarios'}
                </Badge>
              </div>

              <div className="px-5 py-4 bg-card space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your plan is stress-tested against <strong>5 bear market scenarios</strong> in the first years of retirement (up to 40% single-year drawdown). Each sequence is followed by a recovery rate so the geometric average matches your plan&apos;s assumed rate. This isolates <em>sequence-of-returns risk</em> — same lifetime average, but losses come early when you&apos;re withdrawing the most.
                </p>

                {/* Results table */}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Scenario</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Bear sequence (yr 1, 2…)</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">End net worth</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Yrs shortfall</th>
                        <th className="px-4 py-2.5 text-center font-semibold text-muted-foreground">Survives</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-muted/20">
                        <td className="px-4 py-2.5 font-medium">Steady growth (baseline)</td>
                        <td className="px-4 py-2.5 text-muted-foreground">—</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${baseline.finalNetworth < 0 ? 'text-destructive' : ''}`}>{fmt(baseline.finalNetworth)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{baseline.yearsWithNegativeCashFlow}</td>
                        <td className="px-4 py-2.5 text-center">
                          {baseline.finalNetworth >= 0 && baseline.yearsWithNegativeCashFlow === 0 ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Yes</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">No</Badge>
                          )}
                        </td>
                      </tr>
                      {scenarios.map((s) => (
                        <tr key={s.name} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-2.5 font-medium">{s.name}</td>
                          <td className="px-4 py-2.5">
                            <span className="tabular-nums">
                              {s.bearSequencePct.map((pct, i) => (
                                <span key={i} className={pct < 0 ? 'text-destructive' : 'text-emerald-600'}>
                                  {i > 0 ? ', ' : ''}{pct >= 0 ? '+' : ''}{pct.toFixed(0)}%
                                </span>
                              ))}
                            </span>
                            <span className="text-muted-foreground text-xs ml-1">→ {s.recoveryRatePct.toFixed(1)}%/yr</span>
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${s.run.finalNetworth < 0 ? 'text-destructive' : ''}`}>{fmt(s.run.finalNetworth)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{s.run.yearsWithNegativeCashFlow}</td>
                          <td className="px-4 py-2.5 text-center">
                            {s.run.success ? (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px]">Yes</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">No</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg bg-muted/40 px-4 py-3 flex gap-2.5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    Each bear sequence is forced in the first years of retirement, then a recovery rate applies so the geometric average equals your plan&apos;s assumed growth rate. For many randomised scenarios,{' '}
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs font-semibold text-primary underline-offset-2" onClick={() => runMonteCarlo()} disabled={runningMonteCarlo || !selectedScenarioId}>
                      {runningMonteCarlo ? 'Running…' : 'Run Monte Carlo'}
                    </Button>
                  </p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Monte Carlo Results ── */}
        {monteCarloSummary && (() => {
          const sr = monteCarloSummary.successRate
          const srColor = sr >= SCORE_ON_TRACK_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : sr >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
          const srBarColor = sr >= SCORE_ON_TRACK_THRESHOLD ? 'bg-emerald-500' : sr >= 65 ? 'bg-amber-500' : 'bg-destructive'
          const srLabel = sr >= 90 ? 'Excellent — very resilient plan' : sr >= SCORE_ON_TRACK_THRESHOLD ? 'Good — strong foundation' : sr >= 70 ? 'Fair — consider reducing withdrawals' : sr >= SCORE_CLOSE_THRESHOLD ? 'Marginal — plan needs attention' : 'Poor — high risk of shortfall'
          const median = monteCarloSummary.medianFinalNetworth
          const mean   = monteCarloSummary.averageFinalNetworth
          const p90    = monteCarloSummary.percentile90
          const negCF  = monteCarloSummary.averageYearsWithNegativeCashFlow
          const fmt = (n: number) => n < 0 ? `-$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          const medianMeanGap = Math.abs(mean - median) > Math.abs(median) * 0.3
          return (
            <div className="rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
                <span className="font-semibold text-sm">Monte Carlo Simulation Results</span>
                <span className="text-xs text-muted-foreground">1,000 randomised market scenarios</span>
              </div>

              <div className="p-5 space-y-6">

                {/* ── Hero: Success Rate ── */}
                <div className="flex items-start gap-6">
                  {/* Big number */}
                  <div className="text-center shrink-0 min-w-[80px]">
                    <div className={`text-5xl font-bold tabular-nums leading-none ${srColor}`}>
                      {sr.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 font-medium">Probabilistic success rate</div>
                  </div>

                  {/* Context */}
                  <div className="flex-1 min-w-0 pt-1 space-y-2">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${srBarColor}`} style={{ width: `${Math.min(100, sr)}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      In <strong className="text-foreground">{Math.round(sr * 10)} out of 1,000</strong> simulated markets your retirement plan stays financially sustainable through your life expectancy.
                    </p>
                    <p className={`text-xs font-semibold ${srColor}`}>{srLabel}</p>
                  </div>
                </div>

                <Separator />

                {/* ── Outcomes distribution ── */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                    Final Net Worth at Life Expectancy — Outcome Distribution
                  </p>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 pb-1">
                    <div />
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-right w-28">Final net worth</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-right w-28 hidden sm:block">Worst yr return ①</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-right w-24 hidden sm:block">Net CAGR ②</div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: 'Worst 5% of markets',     sub: 'Only 1 in 20 scenarios are this bad',       detail: monteCarloSummary.detail.p5,      color: 'text-destructive',                        bg: 'bg-destructive/8 border-destructive/20' },
                      { label: '25th percentile',         sub: '1 in 4 scenarios end at or below this',     detail: monteCarloSummary.detail.p25,     color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/8 border-amber-500/20' },
                      { label: 'Median — most likely',    sub: 'Half of scenarios end above, half below',   detail: monteCarloSummary.detail.median,  color: 'text-foreground',                         bg: 'bg-primary/8 border-primary/20', highlight: true },
                      { label: '75th percentile',         sub: '3 in 4 scenarios end at or below this',     detail: monteCarloSummary.detail.p75,     color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-500/8 border-emerald-500/20' },
                      { label: 'Average across all runs', sub: 'Skewed up by a few very strong scenarios',  detail: monteCarloSummary.detail.average, color: 'text-muted-foreground',                   bg: 'bg-muted/40 border-border' },
                    ].map(row => (
                      <div key={row.label} className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 rounded-lg border px-4 py-2.5 ${row.bg} ${row.highlight ? 'ring-1 ring-primary/30' : ''}`}>
                        {/* Label */}
                        <div className="min-w-0">
                          <p className={`text-xs font-medium ${row.highlight ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{row.label}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 hidden sm:block">{row.sub}</p>
                        </div>
                        {/* Final net worth */}
                        <div className={`text-sm tabular-nums shrink-0 text-right w-28 ${row.color}`}>
                          {fmt(row.detail.finalNetworth)}
                        </div>
                        {/* Worst single-year return */}
                        <div className={`text-sm tabular-nums text-right w-28 hidden sm:block ${row.detail.minAnnualReturn < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {row.detail.minAnnualReturn >= 0 ? '+' : ''}{(row.detail.minAnnualReturn * 100).toFixed(2)}%
                        </div>
                        {/* Net CAGR */}
                        <div className="text-sm tabular-nums text-right w-24 text-muted-foreground hidden sm:block">
                          {row.detail.cagr !== null ? `${(row.detail.cagr * 100).toFixed(2)}%` : 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Column footnotes */}
                  <div className="mt-2 space-y-0.5 px-1">
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      <strong className="text-muted-foreground/80">① Worst yr return</strong> — the single worst year&rsquo;s randomised return drawn in this scenario. Worse outcomes tend to have more severe single-year losses because early large drawdowns permanently reduce the portfolio during peak-withdrawal years (<em>sequence-of-returns risk</em>).
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      <strong className="text-muted-foreground/80">② Net CAGR</strong> — annualised change from starting portfolio to final net worth <em>after</em> all withdrawals, expenses, and taxes over the full plan. Shows "N/A" when the plan ends in deficit.
                    </p>
                  </div>

                  {/* Median vs Mean note */}
                  {medianMeanGap && (
                    <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 px-4 py-3">
                      <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        <strong>Why is the average so much higher than the median?</strong>{' '}
                        A small number of exceptionally favourable market runs produce very large net-worth outcomes that pull the average upward.
                        The <strong>median is the more realistic estimate</strong> of what you should expect.
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Secondary stats ── */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Years with negative cash flow (retirement years only) */}
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-2">Avg retirement years with cash shortfall</p>
                    <div className={`text-2xl font-bold tabular-nums ${negCF <= 3 ? 'text-foreground' : negCF <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'}`}>
                      {negCF.toFixed(1)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">yrs</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {negCF <= 2 ? 'Minimal shortfall exposure' : negCF <= 5 ? 'Some lean years expected' : 'Significant cash-flow risk'}
                    </p>
                  </div>

                  {/* Best-case upside */}
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-2">Upside — top 10% of markets</p>
                    <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {fmt(p90)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Your outcome if markets outperform</p>
                  </div>
                </div>

                {/* Methodology footnote */}
                <p className="text-xs text-muted-foreground/60 border-t pt-3 leading-relaxed">
                  Each of 1,000 simulations generates independent random returns for every year (σ&nbsp;=&nbsp;15% pre-retirement, 12% during retirement, floored at −40%).
                  &ldquo;Success&rdquo;&nbsp;= portfolio ends with positive net worth at life expectancy.
                </p>
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {!stressTestResult && !monteCarloSummary && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <Activity className="h-9 w-9 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground mb-1">No simulation data yet</p>
            <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto mb-4">
              Stress-test your plan across 1,000 randomised market scenarios and see how likely your retirement is to succeed in good and bad markets alike.
            </p>
            <Button variant="outline" size="sm" onClick={() => runMonteCarlo()} disabled={runningMonteCarlo || !selectedScenarioId}>
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              {runningMonteCarlo ? 'Running…' : 'Run Monte Carlo'}
            </Button>
          </div>
        )}
      </div>

      {/* Risks */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Analysis</h3>
        {risks.length === 0 ? (
          <p className="text-gray-600">No significant risks identified.</p>
        ) : (
          <div className="space-y-3">
            {risks.map((risk, index) => (
              <div key={index} className={`p-4 rounded-lg border-l-4 ${
                risk.severity === 'High' ? 'border-red-500 bg-red-50' :
                risk.severity === 'Medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{risk.type}</div>
                    <div className="text-sm text-gray-700 mt-1">{risk.description}</div>
                    <div className="text-sm text-gray-600 mt-2">
                      <strong>Recommendation:</strong> {risk.recommendation}
                    </div>
                  </div>
                  <span className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                    risk.severity === 'High' ? 'bg-red-200 text-red-800' :
                    risk.severity === 'Medium' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-blue-200 text-blue-800'
                  }`}>
                    {risk.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        {recommendations.length === 0 ? (
          <p className="text-gray-600">No recommendations at this time.</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="p-4 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-800' :
                        rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {rec.priority}
                      </span>
                      <span className="text-xs text-gray-500">{rec.category}</span>
                    </div>
                    <div className="font-semibold text-gray-900 mt-2">{rec.title}</div>
                    <div className="text-sm text-gray-700 mt-1">{rec.description}</div>
                    <div className="text-sm text-blue-600 mt-2">
                      <strong>Impact:</strong> {rec.impact}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RMD Analysis */}
      {rmdAnalysis && (
        <div className="rounded-xl border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-sm">RMD Analysis</span>
              <Badge variant="outline" className="text-[10px] font-normal ml-1">Age {RMD_START_AGE}+</Badge>
            </div>
          </div>

          <div className="px-5 py-4 bg-card space-y-4">
            {/* Verdict banner */}
            {(() => {
              const v = rmdAnalysis.verdict
              const bannerCls = v === 'no-concern'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40'
                : v === 'minor'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40'
                  : 'bg-destructive/8 border-destructive/20'
              const labelCls = v === 'no-concern'
                ? 'text-emerald-700 dark:text-emerald-400'
                : v === 'minor'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-destructive'
              const detailCls = v === 'no-concern'
                ? 'text-emerald-600 dark:text-emerald-300'
                : v === 'minor'
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-destructive/80'
              return (
                <div className={`flex gap-2.5 rounded-lg px-4 py-3 border ${bannerCls}`}>
                  <Info className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${labelCls}`} />
                  <div>
                    <p className={`text-xs font-semibold ${labelCls}`}>{rmdAnalysis.verdictLabel}</p>
                    <p className={`text-xs mt-0.5 ${detailCls}`}>{rmdAnalysis.verdictDetail}</p>
                  </div>
                </div>
              )
            })()}

            {/* Contextual metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">RMD Starts</div>
                <div className="text-base font-semibold">{rmdAnalysis.firstRmdYear}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Age {RMD_START_AGE} — ${rmdAnalysis.firstRmdAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">RMD Coverage</div>
                <div className={`text-base font-semibold ${rmdAnalysis.firstYearCoveragePercent >= 100 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                  {rmdAnalysis.firstYearCoveragePercent.toFixed(0)}% of needs
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {rmdAnalysis.firstYearCoveragePercent >= 100 ? 'Exceeds expenses — watch taxes' : 'Below expenses — no forced excess'}
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Forced Excess Years</div>
                <div className={`text-base font-semibold ${rmdAnalysis.forcedExcessYears > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {rmdAnalysis.forcedExcessYears === 0 ? 'None' : `${rmdAnalysis.forcedExcessYears} yr${rmdAnalysis.forcedExcessYears > 1 ? 's' : ''}`}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">years RMD &gt; expenses + tax</div>
              </div>
              <div className="rounded-lg bg-muted/30 px-3 py-2.5">
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Net Lifetime Impact</div>
                <div className={`text-base font-semibold ${rmdAnalysis.netLifetimeImpact > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {rmdAnalysis.netLifetimeImpact > 0 ? '+' : ''}{Math.round(rmdAnalysis.netLifetimeImpact).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {rmdAnalysis.netLifetimeImpact > 0 ? 'cumulative forced excess' : 'cumulative shortfall vs expenses'}
                </div>
              </div>
            </div>

            {/* Expand/collapse toggle */}
            {rmdAnalysis.rmdTable?.length > 0 && (
              <div>
                <button
                  onClick={() => setRmdDetailsExpanded(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {rmdDetailsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {rmdDetailsExpanded ? 'Hide' : 'Show'} full RMD breakdown ({rmdAnalysis.rmdTable.length} years)
                </button>

                {rmdDetailsExpanded && (
                  <div className="mt-3 rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Age</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">Year</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">Trad. Balance</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px] text-xs">401k + IRA balance at start of year (before RMD withdrawal)</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">IRS Divisor</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px] text-xs">IRS Uniform Lifetime Table life expectancy factor. RMD = Balance ÷ Divisor.</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">Rate %</th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">Req. RMD</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px] text-xs">IRS-required minimum distribution = Traditional Balance ÷ IRS Divisor</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">Exp. + Tax</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[220px] text-xs">Total projected expenses plus income tax for the year — what you actually need in cash</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">RMD Impact</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] text-xs">RMD minus (Expenses + Tax). Positive = RMD forces more taxable income than you need. Negative = RMD alone doesn't cover your needs.</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground whitespace-nowrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-default border-b border-dashed border-muted-foreground/50">Cumulative</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px] text-xs">Running total of RMD Impact over all RMD years. Positive = net forced-excess withdrawn; negative = net shortfall from RMDs alone.</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rmdAnalysis.rmdTable.map((row: any, idx: number) => {
                            const isLast = idx === rmdAnalysis.rmdTable.length - 1
                            const impactPositive = row.rmdImpact >= 0
                            const cumulativePositive = row.cumulativeImpact >= 0
                            const fmt = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`
                            return (
                              <tr key={row.age} className={`border-b last:border-0 ${isLast ? 'bg-muted/30 font-semibold' : 'hover:bg-muted/10'}`}>
                                <td className="px-3 py-2 font-medium tabular-nums">
                                  {row.age}
                                  {row.isFirstRmdYear && (
                                    <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 text-amber-700 border-amber-300 bg-amber-50">Start</Badge>
                                  )}
                                  {isLast && (
                                    <Badge variant="outline" className="ml-1.5 text-[9px] py-0 px-1 text-muted-foreground">Final</Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.year}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.tradBalanceStart)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.divisor.toFixed(1)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.ratePercent.toFixed(2)}%</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(row.requiredRmd)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{fmt(row.totalExpensesWithTax)}</td>
                                <td className={`px-3 py-2 text-right tabular-nums font-medium ${impactPositive ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {impactPositive ? '+' : '-'}{fmt(row.rmdImpact)}
                                </td>
                                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${cumulativePositive ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                  {cumulativePositive ? '+' : '-'}{fmt(row.cumulativeImpact)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Legend */}
                    <div className="px-4 py-2.5 border-t bg-muted/20 flex flex-wrap gap-x-5 gap-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-sm bg-amber-400/60" />
                        <span>RMD Impact (+): forced excess — RMD exceeds your actual need, creating extra taxable income</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-400/60" />
                        <span>RMD Impact (−): RMD alone doesn't cover expenses; additional withdrawals are needed</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link to Tax Efficiency Tab */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-6">
        <p className="text-sm text-blue-900 mb-2">
          <strong>💡 Tax Optimization:</strong> For detailed tax efficiency analysis, Roth conversion opportunities, and advanced tax strategies, visit the <button onClick={() => { const event = new CustomEvent('switchTab', { detail: 'tax-efficiency' }); window.dispatchEvent(event); }} className="font-semibold text-blue-700 underline hover:text-blue-800">Tax Efficiency</button> tab.
        </p>
      </div>
    </div>
  )
}

// Helper functions for calculations

export function calculateRetirementScore(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[],
  mcSuccessRate?: number
): RetirementScore {
  if (projections.length === 0) {
    return {
      overall: 0,
      sustainability: 0,
      taxEfficiency: 0,
      longevity: 0,
      inflation: 0,
      medical: 0,
      monteCarlo: 0,
      riskLevel: 'High',
      details: {
        longevity: 'No projection data available.',
        cashflow: 'No projection data available.',
        taxEfficiency: 'No projection data available.',
        inflation: 'No projection data available.',
        medical: 'No projection data available.',
        monteCarlo: 'Monte Carlo not yet run.',
      }
    }
  }

  // Cashflow Score (0-100): proportion of retirement years with a meaningful income shortfall.
  // Uses retirement years only (pre-retirement gap_excess is always 0 by design).
  // Threshold: ignore shortfalls smaller than $1,000 or 2% of that year's expenses (sequence-of-returns noise).
  const retirementProjections = projections.filter(p => p.age && p.age >= (settings.retirement_age || DEFAULT_RETIREMENT_AGE))
  const negativeRetirementYears = retirementProjections.filter(
    p => (p.gap_excess || 0) < -Math.max(1000, (p.total_expenses || 0) * 0.02)
  ).length
  const totalRetirementYears = retirementProjections.length
  const cashflowScore = totalRetirementYears > 0
    ? Math.max(0, 100 - (negativeRetirementYears / totalRetirementYears) * 150)
    : 100  // No retirement data → assume fine

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
  const pct = (r: number) => `${(r * 100).toFixed(1)}%`

  const cashflowDetail = totalRetirementYears > 0
    ? `${negativeRetirementYears} of ${totalRetirementYears} retirement years with income shortfall > $1,000`
      + (negativeRetirementYears === 0 ? ' — income covers expenses every year' : '')
    : 'No retirement projection data'

  // Tax Efficiency Score (0-100): compares effective tax rate against the benchmark expected
  // for the user's income level. This avoids penalising high earners just for being high earners —
  // a $300k/yr retiree and a $60k/yr retiree have very different "normal" rates.
  // Benchmark by avg annual retirement income:
  //   < $50k/yr  → expect ~12%  (standard deduction + low brackets)
  //   $50-100k   → expect ~18%
  //   $100-200k  → expect ~22%
  //   $200k+     → expect ~27%
  // Score 100 at or below benchmark; penalty only for meaningful excess above benchmark.
  const retirementTaxes  = retirementProjections.reduce((s, p) => s + (p.tax || 0), 0)
  const retirementIncome = retirementProjections.reduce((s, p) => s + (p.total_income || 0), 0)
  const effectiveTaxRate = retirementIncome > 0 ? retirementTaxes / retirementIncome : 0
  const avgAnnualIncome  = totalRetirementYears > 0 ? retirementIncome / totalRetirementYears : 0
  const expectedTaxRate  = avgAnnualIncome < 50_000 ? 0.12
                         : avgAnnualIncome < 100_000 ? 0.18
                         : avgAnnualIncome < 200_000 ? 0.22
                         : 0.27
  // Penalty only for the portion ABOVE the benchmark (excess is normalised by benchmark).
  // 5% above → 85, 10% above → 70, 33%+ above → 0
  const taxEfficiencyScore = retirementIncome > 0
    ? Math.max(0, Math.min(100, 100 - Math.max(0, effectiveTaxRate - expectedTaxRate) * 300))
    : 70  // No retirement income data → neutral score

  const taxDetail = retirementIncome > 0
    ? `Avg annual income ${fmt(avgAnnualIncome)} → benchmark effective rate ~${pct(expectedTaxRate)}`
      + `\nActual effective rate ${pct(effectiveTaxRate)} on ${fmt(retirementIncome)} total income`
      + (effectiveTaxRate <= expectedTaxRate
          ? ' — at or below benchmark (efficient)'
          : ` — ${pct(effectiveTaxRate - expectedTaxRate)} above benchmark`)
    : 'No retirement income data — using neutral score'

  // Longevity Score (0-100): Did the plan survive to life expectancy?
  // Uses a "Legacy Goal" (default $0) — the plan scores 100 if it ends at or above that goal.
  // This avoids penalising users for responsibly spending their wealth during retirement.
  // Only penalise if the portfolio goes BELOW the legacy goal (default: goes negative).
  //
  // Penalty scale when final < legacyGoal:
  //   deficit / retirementStartNetworth × 500, capped at 100
  //   5% deficit  → 75    (minor shortfall near end of life)
  //   10% deficit → 50    (meaningful shortfall)
  //   20%+ deficit → 0    (plan needed 20%+ more to survive)
  //
  // TODO: expose legacyGoal as a plan setting so users can set a target inheritance amount.
  const legacyGoal = 0
  const finalNetworth = projections[projections.length - 1]?.networth || 0
  const retirementStartNetworth = retirementProjections[0]?.networth || projections[0]?.networth || 0
  const longevityScore = retirementStartNetworth > 0
    ? finalNetworth >= legacyGoal
      ? 100
      : Math.max(0, Math.round(100 - ((legacyGoal - finalNetworth) / retirementStartNetworth) * 500))
    : 0

  const longevityDetail = retirementStartNetworth > 0
    ? `Portfolio at retirement start ${fmt(retirementStartNetworth)} → at life expectancy ${fmt(finalNetworth)}`
      + (finalNetworth >= legacyGoal
          ? finalNetworth >= retirementStartNetworth
            ? ' (wealth preserved or grew)'
            : ' (wealth drawn down — plan survived)'
          : ` (funds depleted — ${fmt(legacyGoal - finalNetworth)} below survival goal)`)
    : 'No net worth data available'

  // Inflation Score (0-100): Based on how well expenses are covered despite inflation
  // Compare early retirement expenses vs late retirement expenses to see inflation impact
  let inflationScore = 50 // Default score
  let inflationDetail = 'Insufficient retirement data — using default score'
  if (retirementProjections.length > 0) {
    const earlyPeriod = retirementProjections.slice(0, Math.floor(retirementProjections.length / 3))
    const latePeriod = retirementProjections.slice(-Math.floor(retirementProjections.length / 3))

    const earlyExpenses = earlyPeriod.length > 0
      ? earlyPeriod.reduce((sum, p) => sum + (p.total_expenses || 0), 0) / earlyPeriod.length
      : 0
    const lateExpenses = latePeriod.length > 0
      ? latePeriod.reduce((sum, p) => sum + (p.total_expenses || 0), 0) / latePeriod.length
      : 0

    // If expenses grow faster than income, inflation risk is higher
    const earlyIncome = earlyPeriod.length > 0
      ? earlyPeriod.reduce((sum, p) => sum + (p.total_income || 0), 0) / earlyPeriod.length
      : 0
    const lateIncome = latePeriod.length > 0
      ? latePeriod.reduce((sum, p) => sum + (p.total_income || 0), 0) / latePeriod.length
      : 0

    const expenseGrowthRate = earlyExpenses > 0 ? (lateExpenses - earlyExpenses) / earlyExpenses : 0
    const incomeGrowthRate = earlyIncome > 0 ? (lateIncome - earlyIncome) / earlyIncome : 0

    // Score is higher if income keeps up with expense growth
    if (expenseGrowthRate > 0) {
      const gap = expenseGrowthRate - incomeGrowthRate
      // Cap at 100: when income grows *faster* than expenses (gap < 0) the plan is excellent,
      // but an uncapped formula would produce scores > 100 and inflate the overall score.
      inflationScore = Math.max(0, Math.min(100, 100 - (gap / expenseGrowthRate) * 100))
      inflationDetail = `Avg early expenses ${fmt(earlyExpenses)}/yr → late ${fmt(lateExpenses)}/yr (+${pct(expenseGrowthRate)})`
        + `\nAvg early income ${fmt(earlyIncome)}/yr → late ${fmt(lateIncome)}/yr (+${pct(Math.max(0, incomeGrowthRate))})`
        + (gap > 0.01 ? `\nExpenses outpacing income by ${pct(gap)} — inflation eroding purchasing power` : '\nIncome keeping pace with expenses')
    } else {
      inflationScore = 100
      inflationDetail = `Expenses stable or declining in later years (avg early ${fmt(earlyExpenses)}/yr vs late ${fmt(lateExpenses)}/yr)`
    }
  } else {
    // Simplified: Check if inflation rate assumption is reasonable
    const inflationRate = settings.inflation_rate || DEFAULT_INFLATION_RATE
    // Higher inflation rate = lower score (more risk)
    inflationScore = Math.max(0, 100 - (inflationRate * 1000)) // Penalize high inflation assumptions
    inflationDetail = `No retirement projections — based on ${pct(inflationRate)} inflation assumption`
  }

  // Medical Readiness Score (0-100): Plan-specific assessment of readiness to handle medical costs.
  // Four signals — all drawn from the user's own plan data:
  //   1. Coverage      : do projected incomes actually cover healthcare costs each year?
  //   2. Burden        : what fraction of total retirement spending is healthcare?
  //   3. Pre-Medicare  : years of expensive private insurance before Medicare at 65
  //   4. HSA buffer    : dedicated healthcare account provides a cushion
  const MEDICARE_AGE = MEDICARE_ELIGIBILITY_AGE   // 65, from constants
  const retirementAge = settings.retirement_age || DEFAULT_RETIREMENT_AGE

  // Read healthcare_expenses (the correct field written by the projection engine)
  const totalHealthcare = retirementProjections.reduce(
    (s, p) => s + ((p as any).healthcare_expenses || p.special_expenses || 0), 0
  )
  const totalRetExpenses = retirementProjections.reduce((s, p) => s + (p.total_expenses || 0), 0)

  // Signal 1 — Pre-Medicare gap (years without Medicare coverage)
  const preMedicareYears = Math.max(0, MEDICARE_AGE - retirementAge)
  // Penalty: 0 yrs → 0, 1 yr → 8, 3 yrs → 20, 5 yrs → 30, 10+ yrs → 50 (capped)
  const preMedicareRisk = Math.min(50, preMedicareYears * 5)

  // Signal 4 — HSA buffer (plan-specific healthcare savings)
  const hsaBalance = accounts
    .filter(a => (a.account_type || '').trim() === 'HSA')
    .reduce((s, a) => s + (a.balance || 0), 0)
  // Each $10k in HSA gives ~2 pts, up to 15 pts bonus
  const hsaBonus = Math.min(15, Math.floor(hsaBalance / 10_000) * 2)

  let medicalScore: number
  let medicalDetail: string
  if (totalHealthcare > 0 && totalRetExpenses > 0) {
    // Plan has explicit healthcare costs configured — full plan-specific assessment

    // Signal 2 — Healthcare burden (% of total retirement expenses)
    const healthcarePct = totalHealthcare / totalRetExpenses
    // 5% burden → 90, 15% → 70, 25% → 50, 40% → 20
    const burdenScore = Math.max(0, Math.min(100, 100 - healthcarePct * 250))

    // Signal 1b — Coverage ratio: how many retirement years does the plan successfully cover ALL expenses?
    // Use the same meaningful threshold as cashflow to avoid noise penalties.
    const uncoveredYears = retirementProjections.filter(
      p => (p.gap_excess || 0) < -Math.max(1000, (p.total_expenses || 0) * 0.02)
    ).length
    const coverageScore = retirementProjections.length > 0
      ? Math.max(0, 100 - (uncoveredYears / retirementProjections.length) * 150)
      : 100

    // Weighted composite: coverage 40%, burden 35%, pre-Medicare 25%
    medicalScore = Math.max(0, Math.min(100,
      coverageScore * 0.40 +
      burdenScore   * 0.35 +
      (100 - preMedicareRisk) * 0.25 +
      hsaBonus
    ))

    medicalDetail = `Lifetime healthcare ${fmt(totalHealthcare)} = ${pct(healthcarePct)} of total retirement expenses`
      + `\n${uncoveredYears === 0 ? 'All' : `${totalRetirementYears - uncoveredYears} of ${totalRetirementYears}`} retirement years fully covered`
      + (preMedicareYears > 0 ? `\n${preMedicareYears} year${preMedicareYears > 1 ? 's' : ''} before Medicare (age ${MEDICARE_AGE}) — private insurance needed` : '\nMedicare-eligible at retirement — no private insurance gap')
      + (hsaBalance > 0 ? `\nHSA balance ${fmt(hsaBalance)} — dedicated healthcare buffer` : '')
  } else {
    // No healthcare costs entered — the user hasn't planned for medical expenses.
    // Score reflects that unknown exposure, penalised more for early retirement.
    // Base 60 (neutral-ish) minus pre-Medicare gap risk, plus any HSA cushion they have.
    medicalScore = Math.max(20, Math.min(100, 60 - preMedicareRisk + hsaBonus))

    medicalDetail = 'No healthcare premiums configured in plan'
      + (preMedicareYears > 0 ? `\n${preMedicareYears} year${preMedicareYears > 1 ? 's' : ''} before Medicare — private insurance cost not planned` : '\nMedicare-eligible at retirement')
      + (hsaBalance > 0 ? `\nHSA balance ${fmt(hsaBalance)} provides some cushion` : '\nNo HSA account found')
  }

  // Monte Carlo Score (0-100): maps the MC success rate directly to 0-100.
  // If MC has not been run yet, it is EXCLUDED from the overall score computation (rather than
  // dragging the score down with a static 50 placeholder). The other 5 weights are re-scaled to 100%.
  const mcHasRun = mcSuccessRate !== undefined && mcSuccessRate !== null
  const monteCarloScore = mcHasRun
    ? Math.round(Math.max(0, Math.min(100, mcSuccessRate!)))
    : 50  // display-only placeholder — not used in overall when MC hasn't run
  const monteCarloDetail = mcHasRun
    ? `${mcSuccessRate!.toFixed(1)}% of 1,000 randomised market scenarios end with positive net worth`
    : 'Monte Carlo not yet run — excluded from overall score until first run (other weights scaled to 100%)'

  // Overall Score
  // When MC has run:     Longevity 40% + MC 20% + Cashflow 10% + Tax 10% + Inflation 10% + Medical 10%
  // When MC hasn't run:  same 5 non-MC components re-scaled by ÷ (1 − MC_WEIGHT) so they still sum to 100%
  const otherWeightTotal = 1 - SCORE_WEIGHT_MONTE_CARLO   // 0.80
  const overallScore = Math.round(
    mcHasRun
      ? (longevityScore     * SCORE_WEIGHT_LONGEVITY
       + monteCarloScore    * SCORE_WEIGHT_MONTE_CARLO
       + cashflowScore      * SCORE_WEIGHT_CASHFLOW
       + taxEfficiencyScore * SCORE_WEIGHT_TAX_EFFICIENCY
       + inflationScore     * SCORE_WEIGHT_INFLATION
       + medicalScore       * SCORE_WEIGHT_MEDICAL)
      : (longevityScore     * (SCORE_WEIGHT_LONGEVITY       / otherWeightTotal)
       + cashflowScore      * (SCORE_WEIGHT_CASHFLOW         / otherWeightTotal)
       + taxEfficiencyScore * (SCORE_WEIGHT_TAX_EFFICIENCY   / otherWeightTotal)
       + inflationScore     * (SCORE_WEIGHT_INFLATION        / otherWeightTotal)
       + medicalScore       * (SCORE_WEIGHT_MEDICAL          / otherWeightTotal))
  )

  // Risk Level
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
  if (overallScore < SCORE_AT_RISK_THRESHOLD) riskLevel = 'High'
  else if (overallScore < SCORE_MEDIUM_RISK_THRESHOLD) riskLevel = 'Medium'
  
  return {
    overall: overallScore,
    sustainability: Math.round(cashflowScore),
    taxEfficiency: Math.round(taxEfficiencyScore),
    longevity: Math.round(longevityScore),
    inflation: Math.round(inflationScore),
    medical: Math.round(medicalScore),
    monteCarlo: monteCarloScore,
    riskLevel,
    details: {
      longevity: longevityDetail,
      cashflow: cashflowDetail,
      taxEfficiency: taxDetail,
      inflation: inflationDetail,
      medical: medicalDetail,
      monteCarlo: monteCarloDetail,
    }
  }
}

function identifyRisks(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[],
  rmdAnalysis?: ReturnType<typeof analyzeRMDs>
): Risk[] {
  const risks: Risk[] = []
  
  if (projections.length === 0) return risks
  
  // Check for negative cash flow
  const negativeYears = projections.filter(p => (p.gap_excess || 0) < 0).length
  if (negativeYears > 0) {
    risks.push({
      type: 'Cash Flow Shortfall',
      severity: negativeYears > projections.length * 0.2 ? 'High' : 'Medium',
      description: `${negativeYears} years with negative cash flow (expenses exceed income).`,
      recommendation: 'Consider reducing expenses, increasing income sources, or adjusting retirement age.'
    })
  }
  
  // Check for depletion of assets
  const finalNetworth = projections[projections.length - 1]?.networth || 0
  const initialNetworth = projections[0]?.networth || 0
  if (finalNetworth < initialNetworth * 0.3) {
    risks.push({
      type: 'Asset Depletion Risk',
      severity: 'High',
      description: `Net worth may decline significantly by end of retirement (${((1 - finalNetworth/initialNetworth) * 100).toFixed(0)}% reduction).`,
      recommendation: 'Consider reducing withdrawal rates, increasing growth assumptions, or working longer.'
    })
  }
  
  // RMD risk — delegate to analyzeRMDs so the risk list and the detailed RMD section
  // always use the same formula and can never produce contradictory verdicts.
  if (rmdAnalysis) {
    if (rmdAnalysis.verdict === 'attention') {
      risks.push({
        type: 'High RMD Risk',
        severity: rmdAnalysis.forcedExcessYears > 5 ? 'High' : 'Medium',
        description: `RMDs exceed expenses + tax in ${rmdAnalysis.forcedExcessYears} year${rmdAnalysis.forcedExcessYears > 1 ? 's' : ''} after age ${RMD_START_AGE}, forcing extra taxable income.`,
        recommendation: `Consider Roth conversions before age ${RMD_START_AGE} to reduce future RMDs and tax burden.`
      })
    } else if (rmdAnalysis.verdict === 'minor') {
      risks.push({
        type: 'Minor RMD Impact',
        severity: 'Medium',
        description: `RMDs exceed expenses + tax in ${rmdAnalysis.forcedExcessYears} year${rmdAnalysis.forcedExcessYears > 1 ? 's' : ''} after age ${RMD_START_AGE}, creating modest forced taxable income.`,
        recommendation: `Consider light Roth conversion planning before age ${RMD_START_AGE}.`
      })
    }
    // verdict === 'no-concern' → no risk entry added
  }
  
  // Check for low tax-advantaged accounts
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const rothBalance = accounts
    .filter(acc => acc.account_type === 'Roth IRA' || acc.account_type === 'Roth')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0)
  if (totalBalance > 0 && rothBalance / totalBalance < 0.2) {
    risks.push({
      type: 'Low Roth Allocation',
      severity: 'Low',
      description: `Only ${((rothBalance / totalBalance) * 100).toFixed(0)}% of assets are in Roth accounts.`,
      recommendation: 'Consider Roth conversions or increasing Roth contributions to improve tax flexibility in retirement.'
    })
  }
  
  // Check for inflation risk
  const retirementProjections = projections.filter(p => p.age && p.age >= (settings.retirement_age || DEFAULT_RETIREMENT_AGE))
  if (retirementProjections.length > 0) {
    const earlyPeriod = retirementProjections.slice(0, Math.floor(retirementProjections.length / 3))
    const latePeriod = retirementProjections.slice(-Math.floor(retirementProjections.length / 3))
    
    const earlyExpenses = earlyPeriod.length > 0
      ? earlyPeriod.reduce((sum, p) => sum + (p.total_expenses || 0), 0) / earlyPeriod.length
      : 0
    const lateExpenses = latePeriod.length > 0
      ? latePeriod.reduce((sum, p) => sum + (p.total_expenses || 0), 0) / latePeriod.length
      : 0
    
    const earlyIncome = earlyPeriod.length > 0
      ? earlyPeriod.reduce((sum, p) => sum + (p.total_income || 0), 0) / earlyPeriod.length
      : 0
    const lateIncome = latePeriod.length > 0
      ? latePeriod.reduce((sum, p) => sum + (p.total_income || 0), 0) / latePeriod.length
      : 0
    
    const expenseGrowthRate = earlyExpenses > 0 ? (lateExpenses - earlyExpenses) / earlyExpenses : 0
    const incomeGrowthRate = earlyIncome > 0 ? (lateIncome - earlyIncome) / earlyIncome : 0
    
    // If expenses grow significantly faster than income, inflation risk is high
    if (expenseGrowthRate > 0.05 && expenseGrowthRate > incomeGrowthRate * 1.5) {
      const inflationRisk = ((expenseGrowthRate - incomeGrowthRate) / expenseGrowthRate) * 100
      risks.push({
        type: 'Inflation Risk',
        severity: inflationRisk > 30 ? 'High' : inflationRisk > 15 ? 'Medium' : 'Low',
        description: `Expenses are growing ${((expenseGrowthRate - incomeGrowthRate) * 100).toFixed(2)}% faster than income, indicating inflation may erode purchasing power.`,
        recommendation: 'Consider increasing growth assumptions, reducing expenses, or adding inflation-protected income sources (e.g., TIPS, inflation-adjusted annuities).'
      })
    }
  }
  
  // Check for health care expenses risk using actual healthcare data
  const retProjForRisk = projections.filter(p => p.age && p.age >= (settings.retirement_age || DEFAULT_RETIREMENT_AGE))
  const totalHealthcareRisk = retProjForRisk.reduce((sum, p) => sum + (p.special_expenses || 0), 0)
  const totalRetExpensesRisk = retProjForRisk.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
  
  if (totalHealthcareRisk > 0 && totalRetExpensesRisk > 0) {
    const healthcarePct = totalHealthcareRisk / totalRetExpensesRisk
    if (healthcarePct > 0.2) {
      risks.push({
        type: 'Health Care Expenses Risk',
        severity: healthcarePct > 0.4 ? 'High' : healthcarePct > 0.3 ? 'Medium' : 'Low',
        description: `Healthcare costs make up ${(healthcarePct * 100).toFixed(0)}% of total retirement expenses ($${totalHealthcareRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })} lifetime).`,
        recommendation: 'Consider setting aside funds for health care, reviewing Medicare coverage options, or purchasing long-term care insurance.'
      })
    }
  } else {
    // No specific healthcare data — skip the fallback rather than misattributing
    // general inflation to healthcare cost increases
  }
  
  return risks
}

function generateRecommendations(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[],
  expenses: Expense[]
): Recommendation[] {
  const recommendations: Recommendation[] = []
  
  if (projections.length === 0) return recommendations
  
  // Check for Roth conversion opportunities
  const traditionalBalance = accounts
    .filter(acc => acc.account_type === '401k' || acc.account_type === 'IRA' || acc.account_type === 'Traditional IRA')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  if (traditionalBalance > 100000) {
    recommendations.push({
      category: 'Tax Strategy',
      priority: 'High',
      title: 'Consider Roth Conversions',
      description: `You have $${traditionalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} in traditional retirement accounts. Converting some to Roth now could reduce future RMDs and taxes.`,
      impact: 'Could save significant taxes in later years and provide more tax-free income flexibility.'
    })
  }
  
  // Check for expense optimization
  const totalExpenses = expenses.reduce((sum, exp) => {
    const amount = settings.retirement_age >= 65 ? exp.amount_after_65 : exp.amount_before_65
    return sum + (amount || 0)
  }, 0) * 12
  
  const avgIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0) / projections.length
  if (totalExpenses > avgIncome * 1.1) {
    recommendations.push({
      category: 'Expense Management',
      priority: 'Medium',
      title: 'Review Expenses',
      description: `Annual expenses ($${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}) may exceed average income.`,
      impact: 'Reducing expenses by 10-15% could significantly improve retirement sustainability.'
    })
  }
  
  // Check for growth rate assumptions
  if (settings.growth_rate_during_retirement < 0.04) {
    recommendations.push({
      category: 'Investment Strategy',
      priority: 'Medium',
      title: 'Review Growth Assumptions',
      description: `Current growth rate assumption (${(settings.growth_rate_during_retirement * 100).toFixed(2)}%) may be conservative.`,
      impact: 'Consider if a slightly higher growth rate is appropriate for your risk tolerance and time horizon.'
    })
  }
  
  return recommendations
}

function analyzeRMDs(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[]
): any {
  // RMDs apply to tax-deferred accounts (401k + IRA) starting at RMD_START_AGE
  const rmdProjections = projections.filter(p => p.age && p.age >= RMD_START_AGE)
  
  if (rmdProjections.length === 0) {
    return {
      firstRmdYear: 'N/A',
      firstRmdAmount: 0,
      peakRmdYear: 'N/A',
      peakRmdAmount: 0,
      totalRmds: 0,
      rmdTable: [],
      recommendation: `RMDs will begin at age ${RMD_START_AGE}. Consider Roth conversions before then to reduce future RMDs.`
    }
  }
  
  const rmdAmount = (p: ProjectionDetail) => (p.distribution_401k || 0) + (p.distribution_ira || 0)
  
  const firstRmd = rmdProjections[0]
  const peakRmd = rmdProjections.reduce((max, p) => rmdAmount(p) > rmdAmount(max) ? p : max, rmdProjections[0])
  const totalRmds = rmdProjections.reduce((sum, p) => sum + rmdAmount(p), 0)

  // Build per-year RMD table
  let cumulativeImpact = 0
  const rmdTable = rmdProjections.map((p, idx) => {
    const age = p.age ?? 0
    // Start-of-year traditional balance: use prior year's end balance if available
    const prevP = projections.find(pp => pp.age === age - 1)
    const tradBalanceStart = prevP
      ? (prevP.balance_401k || 0) + (prevP.balance_ira || 0)
      : (p.balance_401k || 0) + (p.balance_ira || 0) + rmdAmount(p) // approximate

    const divisor = Math.max(1, 27.4 - (age - RMD_START_AGE))
    const ratePercent = (1 / divisor) * 100
    const requiredRmd = tradBalanceStart > 0 ? tradBalanceStart / divisor : 0
    const totalExpensesWithTax = (p.total_expenses || 0) + (p.tax || 0)
    const rmdImpact = requiredRmd - totalExpensesWithTax
    cumulativeImpact += rmdImpact

    return {
      age,
      year: p.year,
      tradBalanceStart,
      divisor,
      ratePercent,
      requiredRmd,
      actualDistribution: rmdAmount(p),
      totalExpensesWithTax,
      rmdImpact,
      cumulativeImpact,
      isFirstRmdYear: idx === 0,
    }
  })
  
  let recommendation = ''
  if (rmdAmount(peakRmd) > 100000) {
    recommendation = `High RMDs detected (peak ${peakRmd.year}: $${rmdAmount(peakRmd).toLocaleString(undefined, { maximumFractionDigits: 0 })}). Consider Roth conversions before age ${RMD_START_AGE} to reduce future tax burden.`
  } else {
    recommendation = 'RMDs are manageable. Continue monitoring as account balances grow.'
  }

  // Derived summary metrics
  const netLifetimeImpact = rmdTable.length > 0 ? rmdTable[rmdTable.length - 1].cumulativeImpact : 0
  const forcedExcessYears = rmdTable.filter(r => r.rmdImpact > 0).length
  const totalLifetimeExpenses = rmdTable.reduce((s, r) => s + r.totalExpensesWithTax, 0)
  const totalRequiredRmds = rmdTable.reduce((s, r) => s + r.requiredRmd, 0)
  // Lifetime aggregate (kept for internal use)
  const avgCoveragePercent = totalLifetimeExpenses > 0
    ? Math.min(100, (totalRequiredRmds / totalLifetimeExpenses) * 100)
    : 0
  // First-year coverage: directly verifiable from the "RMD Starts" card values shown next to it.
  // A user can divide the two visible numbers (first RMD / first year expenses+tax) and get this figure.
  const firstYearRow = rmdTable[0]
  const firstYearCoveragePercent = firstYearRow && firstYearRow.totalExpensesWithTax > 0
    ? Math.min(100, (firstYearRow.requiredRmd / firstYearRow.totalExpensesWithTax) * 100)
    : avgCoveragePercent

  // Verdict
  let verdict: 'no-concern' | 'minor' | 'attention'
  let verdictLabel: string
  let verdictDetail: string
  if (forcedExcessYears === 0) {
    verdict = 'no-concern'
    verdictLabel = 'No RMD concern'
    verdictDetail = `Your RMDs never exceed your expenses + tax in any year. You'll withdraw more than the minimum anyway to meet your needs — the IRS mandate adds no extra tax burden.`
  } else if (forcedExcessYears <= 2 || netLifetimeImpact < 20000) {
    verdict = 'minor'
    verdictLabel = 'Minor RMD impact'
    verdictDetail = `RMDs exceed your expenses + tax in ${forcedExcessYears} year${forcedExcessYears > 1 ? 's' : ''}, creating modest forced taxable income. Consider light Roth conversion planning.`
  } else {
    verdict = 'attention'
    verdictLabel = 'RMD planning needed'
    verdictDetail = `RMDs exceed expenses + tax in ${forcedExcessYears} years, forcing $${Math.round(netLifetimeImpact).toLocaleString()} in excess taxable withdrawals over your lifetime. Roth conversions before age ${RMD_START_AGE} could reduce this.`
  }
  
  return {
    firstRmdYear: firstRmd.year,
    firstRmdAmount: rmdAmount(firstRmd),
    peakRmdYear: peakRmd.year,
    peakRmdAmount: rmdAmount(peakRmd),
    totalRmds,
    rmdTable,
    recommendation,
    // Verdict / contextual fields
    verdict,
    verdictLabel,
    verdictDetail,
    netLifetimeImpact,
    forcedExcessYears,
    avgCoveragePercent,
    firstYearCoveragePercent,
    totalLifetimeExpenses,
    totalRequiredRmds,
  }
}

export function analyzeTaxEfficiency(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[],
  // Optional — when provided, run the projection engine with tax_roth_conversion so the
  // "Total Taxes With Roth Conversion" figure exactly matches the Strategy Comparison table.
  expenses?: Expense[],
  otherIncome?: OtherIncome[],
  birthYear?: number,
  lifeExpectancy?: number,
  spouseBirthYear?: number,
  spouseLifeExpectancy?: number,
  includePlannerSsa?: boolean,
  includeSpouseSsa?: boolean,
  estimatedPlannerSsaAtStart?: number,
  estimatedSpouseSsaAtStart?: number,
): any {
  if (projections.length === 0) {
    return {
      totalTaxes: 0,
      avgAnnualTax: 0,
      efficiencyScore: 0,
      rothConversion: null,
      taxesWithRothConversion: null
    }
  }

  // Use retirement years only for tax metrics (match Advanced Projections / Details tab)
  const retirementAge = settings.retirement_age || DEFAULT_RETIREMENT_AGE
  const retirementProjections = projections.filter(p => (p.age || 0) >= retirementAge)

  // Current projections are WITHOUT Roth conversion (baseline)
  const totalTaxesWithoutRoth = retirementProjections.length > 0
    ? retirementProjections.reduce((sum, p) => sum + (p.tax || 0), 0)
    : 0
  const avgAnnualTaxWithoutRoth = retirementProjections.length > 0
    ? totalTaxesWithoutRoth / retirementProjections.length
    : 0

  const totalIncome = retirementProjections.length > 0
    ? retirementProjections.reduce((sum, p) => sum + (p.total_income || 0), 0)
    : 0
  const taxRate = totalIncome > 0 ? (totalTaxesWithoutRoth / totalIncome) * 100 : 0
  const efficiencyScore = Math.max(0, 100 - taxRate * 2)
  
  // Roth conversion analysis
  const traditionalBalance = accounts
    .filter(acc => acc.account_type === '401k' || acc.account_type === 'IRA' || acc.account_type === 'Traditional IRA')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  let rothConversion = null
  let taxesWithRothConversion = null
  
  if (traditionalBalance > 50000) {
    const optimalAmount = Math.min(ROTH_CONVERSION_MAX, traditionalBalance * ROTH_CONVERSION_FRACTION)
    const currentYear = settings.current_year || new Date().getFullYear()
    const retirementStartYear = (settings.retirement_start_year && settings.retirement_start_year > 0) 
      ? settings.retirement_start_year
      : (currentYear + (settings.years_to_retirement || 0))
    const yearsUntilRmd = Math.max(0, RMD_START_AGE - retirementAge)
    const rmdStartYear = retirementStartYear + yearsUntilRmd
    const conversionStartYear = retirementStartYear
    const conversionEndYear = rmdStartYear - 1
    const conversionYears = Math.max(1, conversionEndYear - conversionStartYear + 1)
    const totalConverted = optimalAmount * conversionYears

    // -----------------------------------------------------------------------
    // Roth simulation: run the full projection engine with tax_roth_conversion
    // when caller has supplied the required inputs.  This produces the same
    // number as the Strategy Comparison table (same engine, same parameters).
    // -----------------------------------------------------------------------
    let totalTaxesWithRoth: number
    let avgAnnualTaxWithRoth: number
    let conversionTaxes: number
    let futureSavings: number

    const canSimulate = !!(birthYear && lifeExpectancy && expenses && otherIncome)
    if (canSimulate) {
      const rothSettings = { ...settings, withdrawal_strategy_type: 'tax_roth_conversion' as const }
      const rothProjections = calculateRetirementProjections(
        birthYear!,
        accounts,
        expenses!,
        otherIncome!,
        rothSettings,
        lifeExpectancy!,
        spouseBirthYear,
        spouseLifeExpectancy,
        includePlannerSsa ?? true,
        includeSpouseSsa,
        estimatedPlannerSsaAtStart,
        estimatedSpouseSsaAtStart,
      )
      const rothRetirementProj = rothProjections.filter(p => (p.age || 0) >= retirementAge)
      totalTaxesWithRoth = rothRetirementProj.reduce((s, p) => s + (p.tax || 0), 0)
      avgAnnualTaxWithRoth = rothRetirementProj.length > 0 ? totalTaxesWithRoth / rothRetirementProj.length : 0
      // When using the simulation, the total already captures both the conversion tax cost
      // AND the future savings from reduced RMDs — no need to show them as separate lines.
      conversionTaxes = 0
      futureSavings = 0
    } else {
      // Analytical fallback (no simulation inputs supplied)
      const conversionWindow = projections.filter(p => {
        const y = p.year || 0
        return y >= conversionStartYear && y < rmdStartYear
      })

      const calculateTaxOnConversion = (taxableIncome: number, conversionAmount: number, filingStatus: string): number => {
        const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
        const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]
        let taxWithout = 0, taxWith = 0
        let rem = taxableIncome
        for (const b of bracketList) {
          if (rem <= 0) break
          const amt = Math.min(rem, b.max - b.min)
          taxWithout += amt * b.rate
          rem -= amt
        }
        rem = taxableIncome + conversionAmount
        for (const b of bracketList) {
          if (rem <= 0) break
          const amt = Math.min(rem, b.max - b.min)
          taxWith += amt * b.rate
          rem -= amt
        }
        return taxWith - taxWithout
      }

      let annualTaxCost = 0
      if (conversionWindow.length > 0) {
        const total = conversionWindow.reduce((s, p) => s + calculateTaxOnConversion(p.taxable_income || 0, optimalAmount, settings.filing_status || DEFAULT_FILING_STATUS), 0)
        annualTaxCost = total / conversionWindow.length
      } else {
        const allRet = projections.filter(p => (p.age || 0) >= retirementAge)
        if (allRet.length > 0) {
          const avgTaxable = allRet.reduce((s, p) => s + (p.taxable_income || 0), 0) / allRet.length
          annualTaxCost = calculateTaxOnConversion(avgTaxable, optimalAmount, settings.filing_status || DEFAULT_FILING_STATUS)
        } else {
          annualTaxCost = optimalAmount * DEFAULT_MARGINAL_TAX_RATE
        }
      }
      conversionTaxes = annualTaxCost * conversionYears

      const avgRmdRate = 0.05
      const rmdProjections = projections.filter(p => (p.age || 0) >= RMD_START_AGE)
      let avgRmdTaxRate = 0.25
      if (rmdProjections.length > 0) {
        const avgRmdTaxableIncome = rmdProjections.reduce((s, p) => s + (p.taxable_income || 0), 0) / rmdProjections.length
        const status = (settings.filing_status || DEFAULT_FILING_STATUS) as FilingStatus
        const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]
        for (const b of bracketList) {
          if (avgRmdTaxableIncome >= b.min && avgRmdTaxableIncome < b.max) { avgRmdTaxRate = b.rate; break }
        }
        avgRmdTaxRate = Math.min(TOP_MARGINAL_RATE, avgRmdTaxRate + 0.02)
      }
      const annualRmdOnConverted = totalConverted * avgRmdRate
      futureSavings = annualRmdOnConverted * avgRmdTaxRate * 20

      totalTaxesWithRoth = totalTaxesWithoutRoth + conversionTaxes - futureSavings
      avgAnnualTaxWithRoth = retirementProjections.length > 0 ? totalTaxesWithRoth / retirementProjections.length : 0
    }

    const netTaxBenefit = totalTaxesWithoutRoth - totalTaxesWithRoth!

    taxesWithRothConversion = {
      totalTaxes: totalTaxesWithRoth!,
      avgAnnualTax: avgAnnualTaxWithRoth!,
      conversionTaxes: conversionTaxes!,
      estimatedSavings: futureSavings!,
      netBenefit: netTaxBenefit,
      simulatedTotal: canSimulate,   // flag so UI can show "from simulation" label
    }

    let recommendation = ''
    if (netTaxBenefit > 1000) {
      recommendation = `Consider converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year to Roth accounts over ${conversionYears} years. This costs additional taxes during conversion but could save approximately $${netTaxBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })} in total lifetime taxes.`
    } else if (netTaxBenefit > 0) {
      recommendation = `Consider converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year to Roth accounts over ${conversionYears} years. While net tax savings may be modest ($${netTaxBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}), Roth conversions provide tax diversification, reduce future RMDs, and offer estate planning benefits.`
    } else {
      recommendation = `Roth conversion may not provide net tax savings at current rates. However, converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year over ${conversionYears} years could still be beneficial for tax diversification, RMD reduction, and estate planning.`
    }
    
    rothConversion = {
      optimalAmount,
      taxCost: canSimulate ? 0 : (conversionTaxes! / conversionYears),
      futureSavings: futureSavings!,
      totalConverted,
      conversionYears,
      conversionStartYear,
      conversionEndYear,
      netBenefit: netTaxBenefit,
      recommendation
    }
  }
  
  return {
    totalTaxes: totalTaxesWithoutRoth,
    avgAnnualTax: avgAnnualTaxWithoutRoth,
    efficiencyScore: Math.round(efficiencyScore),
    rothConversion,
    taxesWithRothConversion
  }
}

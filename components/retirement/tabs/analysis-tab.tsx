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
  calculateRetirementProjections,
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'
import { 
  runMonteCarloSimulation, 
  analyzeSequenceOfReturnsRisk,
  type MonteCarloSummary 
} from '@/lib/utils/monte-carlo'
import { Calculator, Play, Save, TrendingDown, TrendingUp, Activity, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  INCOME_TAX_BRACKETS,
  CAPITAL_GAINS_BRACKETS,
  getStandardDeduction,
  DEFAULT_MARGINAL_TAX_RATE,
  SSA_TAXABLE_PORTION,
  TOP_MARGINAL_RATE,
  type FilingStatus,
} from '@/lib/constants/tax-brackets'
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
  RMD_START_AGE,
  SAFE_WITHDRAWAL_RATE,
  SCORE_ON_TRACK_THRESHOLD,
  SCORE_CLOSE_THRESHOLD,
  SCORE_MEDIUM_RISK_THRESHOLD,
  SCORE_AT_RISK_THRESHOLD,
  SCORE_WEIGHT_LONGEVITY,
  SCORE_WEIGHT_TAX_EFFICIENCY,
  SCORE_WEIGHT_INFLATION_MEDICAL,
  SCORE_WEIGHT_CASHFLOW,
} from '@/lib/constants/retirement-defaults'

interface AnalysisTabProps {
  planId: number
}

interface RetirementScore {
  overall: number
  sustainability: number
  taxEfficiency: number
  longevity: number
  inflation: number
  medical: number
  riskLevel: 'Low' | 'Medium' | 'High'
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

export default function AnalysisTab({ planId }: AnalysisTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<RetirementScore | null>(null)
  const [risks, setRisks] = useState<Risk[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [rmdAnalysis, setRmdAnalysis] = useState<any>(null)
  const [taxEfficiency, setTaxEfficiency] = useState<any>(null)
  const [monteCarloSummary, setMonteCarloSummary] = useState<MonteCarloSummary | null>(null)
  const [sequenceRisk, setSequenceRisk] = useState<any>(null)
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

  // Calculate tax bracket from income based on 2024 tax brackets
  const calculateTaxBracket = (income: number, filingStatus: string): number => {
    const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
    const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]
    
    for (const bracket of bracketList) {
      if (income >= bracket.min && income < bracket.max) {
        return bracket.rate
      }
    }
    
    return TOP_MARGINAL_RATE
  }

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
    setSequenceRisk(null)
    
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
        supabase.from('rp_retirement_plans').select('birth_year').eq('id', planId).single(),
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

      // Get plan data for filing_status
      const { data: planDataForSettings } = await supabase
        .from('rp_retirement_plans')
        .select('filing_status')
        .eq('id', planId)
        .single()

      const settings: CalculatorSettings = {
        current_year: settingsData.data?.current_year || new Date().getFullYear(),
        retirement_age: settingsData.data?.retirement_age || DEFAULT_RETIREMENT_AGE,
        retirement_start_year: settingsData.data?.retirement_start_year || 0,
        years_to_retirement: settingsData.data?.years_to_retirement || 0,
        annual_retirement_expenses: settingsData.data?.annual_retirement_expenses || 0,
        growth_rate_before_retirement: parseFloat(settingsData.data?.growth_rate_before_retirement?.toString() || String(DEFAULT_GROWTH_RATE_PRE_RETIREMENT)),
        growth_rate_during_retirement: parseFloat(settingsData.data?.growth_rate_during_retirement?.toString() || String(DEFAULT_GROWTH_RATE_DURING_RETIREMENT)),
        inflation_rate: parseFloat(settingsData.data?.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE)),
        filing_status: (planDataForSettings?.filing_status as any) || DEFAULT_FILING_STATUS,
      }

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
      }))

      // Calculate analysis metrics
      const calculatedScore = calculateRetirementScore(projections, settings, accounts)
      const calculatedRisks = identifyRisks(projections, settings, accounts)
      const calculatedRecommendations = generateRecommendations(projections, settings, accounts, expenses)
      const calculatedRmdAnalysis = analyzeRMDs(projections, settings, accounts)
      
      // Analyze sequence of returns risk (always calculate, even if Low risk)
      if (projections.length > 0) {
        const seqRisk = analyzeSequenceOfReturnsRisk(projections, settings.retirement_age)
        setSequenceRisk(seqRisk)
        
        // Add market risk to risks list if Medium or High
        if (seqRisk.riskLevel === 'High' || seqRisk.riskLevel === 'Medium') {
          calculatedRisks.push({
            type: 'Sequence of Returns Risk',
            severity: seqRisk.riskLevel,
            description: seqRisk.description,
            recommendation: 'Consider a more conservative withdrawal strategy in early retirement years, or maintain a larger cash reserve to weather market downturns.',
          })
        }
      } else {
        setSequenceRisk(null)
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

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Calculating analysis...</div>
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
            <strong> Tax Efficiency ({(SCORE_WEIGHT_TAX_EFFICIENCY * 100).toFixed(0)}% weight)</strong> evaluates how well you minimize taxes over retirement. 
            <strong> Cashflow ({(SCORE_WEIGHT_CASHFLOW * 100).toFixed(0)}% weight)</strong> measures cash flow consistency - fewer negative years = higher score. 
            <strong> Inflation ({(SCORE_WEIGHT_INFLATION_MEDICAL * 100).toFixed(0)}% weight)</strong> evaluates how well income keeps up with expense growth. 
            <strong> Medical ({(SCORE_WEIGHT_INFLATION_MEDICAL * 100).toFixed(0)}% weight)</strong> assesses health care expense risk in later years.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                    <div className="text-3xl font-semibold text-gray-900">{score.taxEfficiency}</div>
                    <div className="text-sm text-gray-600 mt-1">Tax Efficiency</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_TAX_EFFICIENCY * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Tax Efficiency Score Calculation</p>
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
                    <div className="text-3xl font-semibold text-gray-900">{score.sustainability}</div>
                    <div className="text-sm text-gray-600 mt-1">Cashflow</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_CASHFLOW * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Cashflow Score Calculation</p>
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
                    <div className="text-3xl font-semibold text-gray-900">{score.inflation}</div>
                    <div className="text-sm text-gray-600 mt-1">Inflation</div>
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_INFLATION_MEDICAL * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Inflation Score Calculation</p>
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
                    <div className="text-xs text-gray-500 mt-1">({(SCORE_WEIGHT_INFLATION_MEDICAL * 100).toFixed(0)}% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700">
                  <div className="text-sm">
                    <p className="font-semibold mb-2 text-gray-100">Medical/Health Care Score Calculation</p>
                    <p className="text-xs mb-2 text-gray-200">Assesses health care expense risk in later retirement years.</p>
                    <p className="text-xs font-medium mt-2 text-gray-100">Formula:</p>
                    <p className="text-xs font-mono bg-gray-800 text-gray-100 p-2 rounded border border-gray-600">
                      Average Expenses = Total Expenses / Total Years<br/>
                      Late Year Expenses = Average of last 1/3 of years<br/>
                      Medical Expense Ratio = (Late Year Expenses - Average Expenses) / Average Expenses<br/>
                      Score = max(0, 100 - (Medical Expense Ratio × 200))
                    </p>
                    <p className="text-xs mt-2 text-gray-200">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>Late Year Expenses = Average expenses in final 1/3 of projection years</li>
                      <li>Medical Expense Ratio = Percentage increase in late-year expenses</li>
                      <li>Multiplier of 200 penalizes high medical cost increases</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1 text-gray-200">
                      <li>No increase in late years = Score of 100</li>
                      <li>50% increase in late years = Score of 0</li>
                      <li>Uses expense growth as proxy for medical costs (not explicitly tracked)</li>
                    </ul>
                    <p className="text-xs font-medium mt-2 text-gray-100">Research Reference:</p>
                    <p className="text-xs text-gray-200">Fidelity Retiree Health Care Cost Estimate (2023) - Average 65-year-old couple needs $315K for health care. HealthView Services projects 5.5% annual health care inflation vs 2.5% general inflation.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Market Risks & Monte Carlo */}
      <div className="rounded-xl border bg-card p-6">
        {/* Section header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Market Risk Analysis</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Stress-test your plan against real-world market volatility and uncertainty.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setRunningMonteCarlo(true)
              try {
                const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
                  supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, filing_status').eq('id', planId).single(),
                  supabase.from('rp_accounts').select('*').eq('plan_id', planId),
                  supabase.from('rp_expenses').select('*').eq('plan_id', planId),
                  supabase.from('rp_other_income').select('*').eq('plan_id', planId),
                  supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
                ])
                if (planData.error) { alert(`Failed to load plan data: ${planData.error.message}`); return }
                if (!planData.data?.birth_year) { alert('Please set birth year in Plan Details first'); return }
                const accounts: Account[] = (accountsData.data || []).map(acc => ({ id: acc.id, account_name: acc.account_name, owner: acc.owner || '', balance: acc.balance || 0, account_type: acc.account_type, annual_contribution: acc.annual_contribution || 0 }))
                const expenses: Expense[] = (expensesData.data || []).map(exp => ({ id: exp.id, expense_name: exp.expense_name, amount_after_65: exp.amount_after_65 || 0, amount_before_65: exp.amount_before_65 || 0 }))
                const otherIncome: OtherIncome[] = (incomeData.data || []).map(inc => ({ id: inc.id, income_name: inc.income_source || '', amount: inc.annual_amount || 0, start_year: inc.start_year || undefined, end_year: inc.end_year || undefined, inflation_adjusted: inc.inflation_adjusted || false }))
                const settings: CalculatorSettings = { current_year: settingsData.data?.current_year || new Date().getFullYear(), retirement_age: settingsData.data?.retirement_age || DEFAULT_RETIREMENT_AGE, retirement_start_year: settingsData.data?.retirement_start_year || 0, years_to_retirement: settingsData.data?.years_to_retirement || 0, annual_retirement_expenses: settingsData.data?.annual_retirement_expenses || 0, growth_rate_before_retirement: parseFloat(settingsData.data?.growth_rate_before_retirement?.toString() || String(DEFAULT_GROWTH_RATE_PRE_RETIREMENT)), growth_rate_during_retirement: parseFloat(settingsData.data?.growth_rate_during_retirement?.toString() || String(DEFAULT_GROWTH_RATE_DURING_RETIREMENT)), inflation_rate: parseFloat(settingsData.data?.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE)), filing_status: (planData.data.filing_status as any) || DEFAULT_FILING_STATUS }
                const { summary } = runMonteCarloSimulation(planData.data.birth_year, accounts, expenses, otherIncome, settings, planData.data.life_expectancy || DEFAULT_LIFE_EXPECTANCY, 1000)
                setMonteCarloSummary(summary)
              } catch (error) {
                console.error('Error running Monte Carlo:', error)
                alert('Failed to run Monte Carlo simulation')
              } finally {
                setRunningMonteCarlo(false)
              }
            }}
            disabled={runningMonteCarlo || !selectedScenarioId}
            className="shrink-0"
          >
            <Activity className="h-3.5 w-3.5" />
            {runningMonteCarlo ? 'Running…' : 'Run Monte Carlo'}
          </Button>
        </div>

        {/* ── Sequence of Returns Risk ── */}
        {sequenceRisk && (() => {
          const rl = sequenceRisk.riskLevel as 'Low' | 'Medium' | 'High'
          const headerBg = rl === 'High' ? 'bg-destructive/8 border-destructive/20' : rl === 'Medium' ? 'bg-amber-500/8 border-amber-500/20' : 'bg-emerald-500/8 border-emerald-500/20'
          const iconColor = rl === 'High' ? 'text-destructive' : rl === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
          const badgeVariant = rl === 'High' ? 'destructive' : 'secondary' as const
          const badgeClass = rl === 'Medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' : rl === 'Low' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' : ''
          const worst = sequenceRisk.worstCaseSequence
          const best = sequenceRisk.bestCaseSequence
          const avg = sequenceRisk.averageSequence
          return (
            <div className={`mb-6 rounded-xl border overflow-hidden ${headerBg}`}>
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-inherit">
                <div className="flex items-center gap-2">
                  <TrendingDown className={`h-4 w-4 shrink-0 ${iconColor}`} />
                  <span className="font-semibold text-sm">Sequence of Returns Risk</span>
                </div>
                <Badge variant={badgeVariant} className={badgeClass}>{rl} Risk</Badge>
              </div>

              {/* Body */}
              <div className="px-5 py-4 bg-card space-y-4">
                <p className="text-sm text-muted-foreground">{sequenceRisk.description}</p>

                {/* Stat chips — worst / avg / best */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Worst year', value: worst, positive: worst >= 0, chipBg: worst < 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-emerald-500/10 border-emerald-500/20', textColor: worst < 0 ? 'text-destructive' : 'text-emerald-600' },
                    { label: 'Average year', value: avg,   positive: avg >= 0,   chipBg: avg < 0   ? 'bg-amber-500/10 border-amber-500/20'    : 'bg-muted/60 border-border',               textColor: avg < 0   ? 'text-amber-600'  : 'text-foreground'   },
                    { label: 'Best year',  value: best, positive: best >= 0, chipBg: 'bg-emerald-500/10 border-emerald-500/20', textColor: 'text-emerald-600' },
                  ].map(chip => (
                    <div key={chip.label} className={`rounded-lg border px-4 py-3 text-center ${chip.chipBg}`}>
                      <div className={`text-xl font-bold tabular-nums ${chip.textColor}`}>
                        {chip.value >= 0 ? '+' : ''}{chip.value.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{chip.label}</div>
                    </div>
                  ))}
                </div>

                {/* Plain-English explanation */}
                <div className="rounded-lg bg-muted/40 px-4 py-3 flex gap-2.5">
                  <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    These figures are derived from your plan's <strong>fixed growth-rate assumption</strong> applied to the first 10 years of retirement.
                    Because your plan uses a constant rate, worst ≈ best ≈ average — this reflects steady projected growth, not real market swings.
                    For a true stress-test of how bad markets could affect your plan, run the <strong>Monte Carlo simulation</strong> below, which randomises returns across 1,000 scenarios.
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
                    <div className="text-xs text-muted-foreground mt-1.5 font-medium">Success rate</div>
                  </div>

                  {/* Context */}
                  <div className="flex-1 min-w-0 pt-1 space-y-2">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${srBarColor}`} style={{ width: `${Math.min(100, sr)}%` }} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      In <strong className="text-foreground">{sr.toFixed(0)} out of 100</strong> simulated markets your retirement plan stays financially sustainable through your life expectancy.
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
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 text-right w-28 hidden sm:block">Gross growth rate ①</div>
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
                        {/* Gross growth rate */}
                        <div className="text-sm tabular-nums text-right w-28 text-muted-foreground hidden sm:block">
                          {(row.detail.avgAnnualReturn * 100).toFixed(2)}%
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
                      <strong className="text-muted-foreground/80">① Gross growth rate</strong> — the randomised annual return applied to portfolio assets in this scenario, <em>before</em> any withdrawals, expenses, or taxes.
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
                  {/* Years with negative cash flow */}
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground mb-2">Avg years with cash shortfall</p>
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
                  Returns modelled using normal distribution (σ = 15% before retirement, 12% during retirement).
                  "Success" = positive final net worth <em>and</em> fewer than 20% of retirement years with negative cash flow.
                </p>
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {!sequenceRisk && !monteCarloSummary && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <Activity className="h-9 w-9 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground mb-1">No simulation data yet</p>
            <p className="text-xs text-muted-foreground/70 max-w-sm mx-auto">
              Click <strong>Run Monte Carlo</strong> above to stress-test your plan across 1,000 randomised market
              scenarios and see how likely your retirement is to succeed in good and bad markets alike.
            </p>
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
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">RMD Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-700 font-medium">First RMD Year</div>
              <div className="text-lg font-semibold text-gray-900">{rmdAnalysis.firstRmdYear}</div>
            </div>
            <div>
              <div className="text-sm text-gray-700 font-medium">First RMD Amount</div>
              <div className="text-lg font-semibold text-gray-900">
                ${rmdAnalysis.firstRmdAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-700 font-medium">Peak RMD Year</div>
              <div className="text-lg font-semibold text-gray-900">{rmdAnalysis.peakRmdYear}</div>
            </div>
            <div>
              <div className="text-sm text-gray-700 font-medium">Peak RMD Amount</div>
              <div className="text-lg font-semibold text-gray-900">
                ${rmdAnalysis.peakRmdAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm text-gray-700 font-medium mb-2">Total RMDs Over Lifetime</div>
              <div className="text-lg font-semibold text-gray-900">
                ${rmdAnalysis.totalRmds.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
          {rmdAnalysis.recommendation && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900">Recommendation</div>
              <div className="text-sm text-blue-700 mt-1">{rmdAnalysis.recommendation}</div>
            </div>
          )}
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

function calculateRetirementScore(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[]
): RetirementScore {
  if (projections.length === 0) {
    return {
      overall: 0,
      sustainability: 0,
      taxEfficiency: 0,
      longevity: 0,
      inflation: 0,
      medical: 0,
      riskLevel: 'High'
    }
  }

  // Cashflow Score (0-100): Based on gap/excess and cumulative liability (renamed from sustainability)
  const negativeYears = projections.filter(p => (p.gap_excess || 0) < 0).length
  const cashflowScore = Math.max(0, 100 - (negativeYears / projections.length) * 100)
  
  // Tax Efficiency Score (0-100): Based on tax rates and tax-advantaged account usage
  const totalTaxes = projections.reduce((sum, p) => sum + (p.tax || 0), 0)
  const totalIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0)
  const taxEfficiencyScore = totalIncome > 0 ? Math.max(0, 100 - (totalTaxes / totalIncome) * 100 * 2) : 50
  
  // Longevity Score (0-100): Based on net worth trends and asset preservation
  const finalNetworth = projections[projections.length - 1]?.networth || 0
  const initialNetworth = projections[0]?.networth || 0
  const longevityScore = initialNetworth > 0 
    ? Math.min(100, (finalNetworth / initialNetworth) * 50 + 50)
    : 0
  
  // Inflation Score (0-100): Based on how well expenses are covered despite inflation
  // Compare early retirement expenses vs late retirement expenses to see inflation impact
  const retirementProjections = projections.filter(p => p.age && p.age >= (settings.retirement_age || DEFAULT_RETIREMENT_AGE))
  let inflationScore = 50 // Default score
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
      inflationScore = Math.max(0, 100 - (gap / expenseGrowthRate) * 100)
    } else {
      inflationScore = 100
    }
  } else {
    // Simplified: Check if inflation rate assumption is reasonable
    const inflationRate = settings.inflation_rate || DEFAULT_INFLATION_RATE
    // Higher inflation rate = lower score (more risk)
    inflationScore = Math.max(0, 100 - (inflationRate * 1000)) // Penalize high inflation assumptions
  }
  
  // Medical/Health Care Score (0-100): Based on medical expenses as % of total expenses
  const totalExpenses = projections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
  // Estimate medical expenses (we'll need to check if we have this data)
  // For now, use a proxy: if expenses grow significantly in later years, assume medical costs
  const avgExpenses = totalExpenses / projections.length
  const lateYearExpenses = projections.slice(-Math.floor(projections.length / 3))
    .reduce((sum, p) => sum + (p.total_expenses || 0), 0) / (projections.length / 3)
  
  // If late year expenses are much higher, likely due to medical costs
  const medicalExpenseRatio = avgExpenses > 0 ? (lateYearExpenses - avgExpenses) / avgExpenses : 0
  // Higher medical expense growth = lower score
  const medicalScore = Math.max(0, 100 - (medicalExpenseRatio * 200))
  
  // Overall Score: Weighted average
  const overallScore = Math.round(
    longevityScore * SCORE_WEIGHT_LONGEVITY + 
    taxEfficiencyScore * SCORE_WEIGHT_TAX_EFFICIENCY + 
    cashflowScore * SCORE_WEIGHT_CASHFLOW + 
    inflationScore * SCORE_WEIGHT_INFLATION_MEDICAL + 
    medicalScore * SCORE_WEIGHT_INFLATION_MEDICAL
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
    riskLevel
  }
}

function identifyRisks(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[]
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
  
  // Check for high RMDs
  const rmdYears = projections.filter(p => p.age && p.age >= RMD_START_AGE)
  if (rmdYears.length > 0) {
    const maxRmd = Math.max(...rmdYears.map(p => p.distribution_401k || 0))
    const avgIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0) / projections.length
    if (maxRmd > avgIncome * 0.5) {
      risks.push({
        type: 'High RMD Risk',
        severity: 'Medium',
        description: `RMDs may push you into higher tax brackets after age ${RMD_START_AGE}.`,
        recommendation: `Consider Roth conversions before age ${RMD_START_AGE} to reduce future RMDs and tax burden.`
      })
    }
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
  
  // Check for health care expenses risk
  const totalExpenses = projections.reduce((sum, p) => sum + (p.total_expenses || 0), 0)
  const avgExpenses = totalExpenses / projections.length
  const lateYearExpenses = projections.slice(-Math.floor(projections.length / 3))
    .reduce((sum, p) => sum + (p.total_expenses || 0), 0) / Math.max(1, Math.floor(projections.length / 3))
  
  // If late year expenses are significantly higher, likely due to medical costs
  const medicalExpenseRatio = avgExpenses > 0 ? (lateYearExpenses - avgExpenses) / avgExpenses : 0
  if (medicalExpenseRatio > 0.2) {
    risks.push({
      type: 'Health Care Expenses Risk',
      severity: medicalExpenseRatio > 0.5 ? 'High' : medicalExpenseRatio > 0.3 ? 'Medium' : 'Low',
      description: `Late-year expenses are ${(medicalExpenseRatio * 100).toFixed(0)}% higher than average, indicating potential health care cost increases.`,
      recommendation: 'Consider setting aside funds for health care, reviewing Medicare coverage options, or purchasing long-term care insurance.'
    })
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
  const rmdProjections = projections.filter(p => p.age && p.age >= RMD_START_AGE)
  
  if (rmdProjections.length === 0) {
    return {
      firstRmdYear: 'N/A',
      firstRmdAmount: 0,
      peakRmdYear: 'N/A',
      peakRmdAmount: 0,
      totalRmds: 0,
      recommendation: `RMDs will begin at age ${RMD_START_AGE}. Consider Roth conversions before then to reduce future RMDs.`
    }
  }
  
  const firstRmd = rmdProjections[0]
  const peakRmd = rmdProjections.reduce((max, p) => 
    (p.distribution_401k || 0) > (max.distribution_401k || 0) ? p : max
  , rmdProjections[0])
  
  const totalRmds = rmdProjections.reduce((sum, p) => sum + (p.distribution_401k || 0), 0)
  
  let recommendation = ''
  if (peakRmd.distribution_401k && peakRmd.distribution_401k > 100000) {
    recommendation = `High RMDs detected. Consider Roth conversions before age ${RMD_START_AGE} to reduce future tax burden.`
  } else {
    recommendation = 'RMDs are manageable. Continue monitoring as account balances grow.'
  }
  
  return {
    firstRmdYear: firstRmd.year,
    firstRmdAmount: firstRmd.distribution_401k || 0,
    peakRmdYear: peakRmd.year,
    peakRmdAmount: peakRmd.distribution_401k || 0,
    totalRmds,
    recommendation
  }
}

export function analyzeTaxEfficiency(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[]
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
  
  // Current projections are WITHOUT Roth conversion (baseline)
  const totalTaxesWithoutRoth = projections.reduce((sum, p) => sum + (p.tax || 0), 0)
  const avgAnnualTaxWithoutRoth = totalTaxesWithoutRoth / projections.length
  
  const totalIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0)
  const taxRate = totalIncome > 0 ? (totalTaxesWithoutRoth / totalIncome) * 100 : 0
  const efficiencyScore = Math.max(0, 100 - taxRate * 2)
  
  // Roth conversion analysis
  const traditionalBalance = accounts
    .filter(acc => acc.account_type === '401k' || acc.account_type === 'IRA' || acc.account_type === 'Traditional IRA')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  let rothConversion = null
  let taxesWithRothConversion = null
  
  if (traditionalBalance > 50000) {
    // Suggest converting up to $50k per year in lower tax brackets
    const optimalAmount = Math.min(50000, traditionalBalance * 0.1)
    
    // Calculate estimated taxes WITH Roth conversion
    // This is a simplified estimate: assume conversions reduce RMDs and future taxable distributions
    const retirementAge = settings.retirement_age || DEFAULT_RETIREMENT_AGE
    const currentYear = settings.current_year || new Date().getFullYear()
    
    // Use retirement_start_year from scenario settings to determine conversion start year
    // If not set (0 or undefined), calculate it from current year and years_to_retirement
    const retirementStartYear = (settings.retirement_start_year && settings.retirement_start_year > 0) 
      ? settings.retirement_start_year
      : (currentYear + (settings.years_to_retirement || 0))
    
    // Calculate the year when RMDs start (retirement start year + years until RMD_START_AGE)
    const yearsUntilRmd = Math.max(0, RMD_START_AGE - retirementAge)
    const rmdStartYear = retirementStartYear + yearsUntilRmd
    
    // Conversion window: from retirement start year to year before RMD starts
    const conversionStartYear = retirementStartYear
    const conversionEndYear = rmdStartYear - 1
    const conversionYears = Math.max(1, conversionEndYear - conversionStartYear + 1)
    
    // Filter projections for the conversion window (years between retirement start and RMD start)
    const retirementProjections = projections.filter(p => {
      const projectionYear = p.year || 0
      return projectionYear >= conversionStartYear && projectionYear < rmdStartYear
    })
    
    const totalConverted = optimalAmount * conversionYears
    
    // Calculate actual tax on conversion amount for each year based on taxable income
    // Use tax bracket calculation to determine incremental tax
    const calculateTaxOnConversion = (taxableIncome: number, conversionAmount: number, filingStatus: string): number => {
      const status = (filingStatus || DEFAULT_FILING_STATUS) as FilingStatus
      const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]
      
      // Calculate tax on income without conversion
      let taxWithoutConversion = 0
      let remainingIncome = taxableIncome
      for (const bracket of bracketList) {
        if (remainingIncome <= 0) break
        const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
        taxWithoutConversion += taxableInBracket * bracket.rate
        remainingIncome -= taxableInBracket
      }
      
      // Calculate tax on income with conversion
      let taxWithConversion = 0
      remainingIncome = taxableIncome + conversionAmount
      for (const bracket of bracketList) {
        if (remainingIncome <= 0) break
        const taxableInBracket = Math.min(remainingIncome, bracket.max - bracket.min)
        taxWithConversion += taxableInBracket * bracket.rate
        remainingIncome -= taxableInBracket
      }
      
      // Return incremental tax on conversion amount
      return taxWithConversion - taxWithoutConversion
    }
    
    // Calculate conversion taxes for each year based on actual taxable income
    let totalConversionTaxes = 0
    let annualTaxCost = 0
    
    if (retirementProjections.length > 0) {
      // Calculate average tax cost per year
      let totalAnnualTax = 0
      retirementProjections.forEach(proj => {
        const taxableIncome = proj.taxable_income || 0
        const taxOnConversion = calculateTaxOnConversion(taxableIncome, optimalAmount, settings.filing_status || DEFAULT_FILING_STATUS)
        totalAnnualTax += taxOnConversion
      })
      annualTaxCost = retirementProjections.length > 0 ? totalAnnualTax / retirementProjections.length : 0
      totalConversionTaxes = annualTaxCost * conversionYears
    } else {
      // Fallback: use average taxable income from all retirement projections
      const allRetirementProj = projections.filter(p => (p.age || 0) >= retirementAge)
      if (allRetirementProj.length > 0) {
        const avgTaxableIncome = allRetirementProj.reduce((sum, p) => sum + (p.taxable_income || 0), 0) / allRetirementProj.length
        annualTaxCost = calculateTaxOnConversion(avgTaxableIncome, optimalAmount, settings.filing_status || DEFAULT_FILING_STATUS)
        totalConversionTaxes = annualTaxCost * conversionYears
      } else {
        // Last resort: use estimated marginal rate (common middle bracket)
        annualTaxCost = optimalAmount * DEFAULT_MARGINAL_TAX_RATE
        totalConversionTaxes = annualTaxCost * conversionYears
      }
    }
    
    // Estimate future tax savings:
    // The key benefit of Roth conversion isn't always net tax savings (if rates are the same),
    // but rather: tax diversification, RMD reduction, and avoiding higher brackets later.
    // However, we can estimate savings if:
    // 1. RMDs might push you into a higher bracket (assume 2-5% higher rate)
    // 2. Tax rates may increase in the future
    // 3. Reduced RMDs mean less taxable income, potentially keeping you in lower brackets
    
    // Average RMD rate estimate: ~5% over typical retirement (1/life-expectancy factor at 73 ≈ 3.65%, increases with age)
    const avgRmdRate = 0.05
    // Calculate average tax rate that would apply to RMDs
    const rmdProjections = projections.filter(p => (p.age || 0) >= RMD_START_AGE)
    let avgRmdTaxRate = 0.25 // Default
    if (rmdProjections.length > 0) {
      const avgRmdTaxableIncome = rmdProjections.reduce((sum, p) => sum + (p.taxable_income || 0), 0) / rmdProjections.length
      const status = (settings.filing_status || DEFAULT_FILING_STATUS) as FilingStatus
      const bracketList = INCOME_TAX_BRACKETS[status] ?? INCOME_TAX_BRACKETS[DEFAULT_FILING_STATUS as FilingStatus]
      for (const bracket of bracketList) {
        if (avgRmdTaxableIncome >= bracket.min && avgRmdTaxableIncome < bracket.max) {
          avgRmdTaxRate = bracket.rate
          break
        }
      }
      // Add potential future tax rate increase
      avgRmdTaxRate = Math.min(TOP_MARGINAL_RATE, avgRmdTaxRate + 0.02)
    }
    
    const annualRmdOnConverted = totalConverted * avgRmdRate
    const annualTaxSavings = annualRmdOnConverted * avgRmdTaxRate
    const futureSavings = annualTaxSavings * 20 // Over 20 years of RMDs
    
    // Estimate total taxes WITH Roth conversion:
    // Current taxes + conversion taxes - future tax savings
    // Note: This assumes some tax rate increase or bracket creep benefit
    const totalTaxesWithRoth = totalTaxesWithoutRoth + totalConversionTaxes - futureSavings
    const avgAnnualTaxWithRoth = totalTaxesWithRoth / projections.length
    
    // Calculate net benefit
    const netTaxBenefit = totalTaxesWithoutRoth - totalTaxesWithRoth
    
    taxesWithRothConversion = {
      totalTaxes: totalTaxesWithRoth,
      avgAnnualTax: avgAnnualTaxWithRoth,
      conversionTaxes: totalConversionTaxes,
      estimatedSavings: futureSavings,
      netBenefit: netTaxBenefit
    }
    
    // Create recommendation based on whether there's a net tax benefit
    let recommendation = ''
    if (netTaxBenefit > 1000) {
      recommendation = `Consider converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year to Roth accounts over ${conversionYears} years. This will cost a total of $${totalConversionTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })} in conversion taxes ($${annualTaxCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year) but could save approximately $${futureSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} in future taxes, with a net benefit of $${netTaxBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
    } else if (netTaxBenefit > 0) {
      recommendation = `Consider converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year to Roth accounts over ${conversionYears} years. While net tax savings may be modest ($${netTaxBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}), Roth conversions provide tax diversification, reduce future RMDs, and offer estate planning benefits.`
    } else {
      recommendation = `Roth conversion may not provide significant net tax savings if tax rates remain similar. However, converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year over ${conversionYears} years could still be beneficial for tax diversification, RMD reduction, and estate planning. Consider if you expect tax rates to increase or if you want more flexibility in managing taxable income.`
    }
    
    rothConversion = {
      optimalAmount,
      taxCost: annualTaxCost,
      futureSavings,
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

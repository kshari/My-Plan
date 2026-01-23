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

  useEffect(() => {
    loadScenarios()
  }, [planId])

  useEffect(() => {
    // Clear previous analysis when scenario changes
    setScore(null)
    setRisks([])
    setRecommendations([])
    setRmdAnalysis(null)
    setTaxEfficiency(null)
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
        retirement_age: settingsData.data?.retirement_age || 65,
        retirement_start_year: settingsData.data?.retirement_start_year || 0,
        years_to_retirement: settingsData.data?.years_to_retirement || 0,
        annual_retirement_expenses: settingsData.data?.annual_retirement_expenses || 0,
        growth_rate_before_retirement: parseFloat(settingsData.data?.growth_rate_before_retirement?.toString() || '0.1'),
        growth_rate_during_retirement: parseFloat(settingsData.data?.growth_rate_during_retirement?.toString() || '0.05'),
        capital_gains_tax_rate: parseFloat(settingsData.data?.capital_gains_tax_rate?.toString() || '0.2'),
        income_tax_rate_retirement: parseFloat(settingsData.data?.income_tax_rate_retirement?.toString() || '0.25'),
        inflation_rate: parseFloat(settingsData.data?.inflation_rate?.toString() || '0.04'),
        filing_status: (planDataForSettings?.filing_status as any) || 'Single',
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
      const calculatedTaxEfficiency = analyzeTaxEfficiency(projections, settings, accounts)
      
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
      setTaxEfficiency(calculatedTaxEfficiency)
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
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
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
        {selectedScenario && (
          <div className="text-sm text-gray-600">
            Viewing analysis for: <span className="font-medium text-gray-900">{selectedScenario.scenario_name}</span>
          </div>
        )}
      </div>

      {/* Retirement Score */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Retirement Score</h3>
          <p className="text-sm text-gray-600 mb-4">
            The retirement score (0-100) evaluates your plan across multiple dimensions. 
            <strong> Longevity (60% weight)</strong> assesses asset preservation - maintaining net worth over time. 
            <strong> Tax Efficiency (15% weight)</strong> evaluates how well you minimize taxes over retirement. 
            <strong> Cashflow (5% weight)</strong> measures cash flow consistency - fewer negative years = higher score. 
            <strong> Inflation (10% weight)</strong> evaluates how well income keeps up with expense growth. 
            <strong> Medical (10% weight)</strong> assesses health care expense risk in later years.
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
                    <div className="text-xs text-gray-500 mt-1">(60% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm">
                    <p className="font-semibold mb-2">Longevity Score Calculation</p>
                    <p className="text-xs mb-2">Measures asset preservation over retirement period.</p>
                    <p className="text-xs font-medium mt-2">Formula:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                      Score = min(100, (Final Networth / Initial Networth) × 50 + 50)
                    </p>
                    <p className="text-xs mt-2">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Initial Networth = Networth at retirement age</li>
                      <li>Final Networth = Networth at end of projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Maintaining 100%+ of initial networth = Score of 100</li>
                      <li>Maintaining 0% of initial networth = Score of 50</li>
                      <li>Below 0% (negative) = Score of 0</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Research Reference:</p>
                    <p className="text-xs">Bengen (1994) "Determining Withdrawal Rates Using Historical Data" - 4% rule emphasizes maintaining principal to ensure 30-year sustainability.</p>
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
                    <div className="text-xs text-gray-500 mt-1">(15% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm">
                    <p className="font-semibold mb-2">Tax Efficiency Score Calculation</p>
                    <p className="text-xs mb-2">Evaluates how well taxes are minimized over retirement.</p>
                    <p className="text-xs font-medium mt-2">Formula:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                      Score = max(0, 100 - (Total Taxes / Total Income) × 100 × 2)
                    </p>
                    <p className="text-xs mt-2">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Total Taxes = Sum of all tax payments across projections</li>
                      <li>Total Income = Sum of all income (SSA, distributions, other) across projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Tax rate of 0% = Score of 100</li>
                      <li>Tax rate of 25% = Score of 50</li>
                      <li>Tax rate of 50%+ = Score of 0</li>
                      <li>Multiplier of 2 penalizes higher tax rates more severely</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Research Reference:</p>
                    <p className="text-xs">Kitces (2013) "The Tax Torpedo and Social Security Planning" - Strategic withdrawal sequencing from tax-advantaged accounts can reduce lifetime tax burden by 10-30%.</p>
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
                    <div className="text-xs text-gray-500 mt-1">(5% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm">
                    <p className="font-semibold mb-2">Cashflow Score Calculation</p>
                    <p className="text-xs mb-2">Measures cash flow consistency - fewer negative years = higher score.</p>
                    <p className="text-xs font-medium mt-2">Formula:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                      Score = max(0, 100 - (Negative Years / Total Years) × 100)
                    </p>
                    <p className="text-xs mt-2">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Negative Years = Count of years where gap_excess &lt; 0</li>
                      <li>Total Years = Total number of projection years</li>
                      <li>Gap/Excess = Total Income - Total Expenses - Tax</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>0% negative years = Score of 100</li>
                      <li>50% negative years = Score of 50</li>
                      <li>100% negative years = Score of 0</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Research Reference:</p>
                    <p className="text-xs">Pfau (2015) "Safe Withdrawal Rates for Retirees" - Consistent positive cash flow is critical for retirement sustainability, with &lt;20% negative years being optimal.</p>
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
                    <div className="text-xs text-gray-500 mt-1">(10% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm">
                    <p className="font-semibold mb-2">Inflation Score Calculation</p>
                    <p className="text-xs mb-2">Evaluates how well income keeps up with expense growth due to inflation.</p>
                    <p className="text-xs font-medium mt-2">Formula:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                      Expense Growth Rate = (Late Expenses - Early Expenses) / Early Expenses<br/>
                      Income Growth Rate = (Late Income - Early Income) / Early Income<br/>
                      Gap = Expense Growth Rate - Income Growth Rate<br/>
                      Score = max(0, 100 - (Gap / Expense Growth Rate) × 100)
                    </p>
                    <p className="text-xs mt-2">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Early Period = First 1/3 of retirement years</li>
                      <li>Late Period = Last 1/3 of retirement years</li>
                      <li>Early/Late Expenses = Average expenses in that period</li>
                      <li>Early/Late Income = Average income in that period</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Income growth = Expense growth = Score of 100</li>
                      <li>Income growth = 0, Expense growth &gt; 0 = Lower score</li>
                      <li>Uses scenario inflation rate assumption for projections</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Research Reference:</p>
                    <p className="text-xs">Blanchett (2014) "Estimating the True Cost of Retirement" - Health care costs grow at 2-3x general inflation rate. Fidelity estimates average retiree needs $315K for health care (2023).</p>
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
                    <div className="text-xs text-gray-500 mt-1">(10% weight)</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div className="text-sm">
                    <p className="font-semibold mb-2">Medical/Health Care Score Calculation</p>
                    <p className="text-xs mb-2">Assesses health care expense risk in later retirement years.</p>
                    <p className="text-xs font-medium mt-2">Formula:</p>
                    <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                      Average Expenses = Total Expenses / Total Years<br/>
                      Late Year Expenses = Average of last 1/3 of years<br/>
                      Medical Expense Ratio = (Late Year Expenses - Average Expenses) / Average Expenses<br/>
                      Score = max(0, 100 - (Medical Expense Ratio × 200))
                    </p>
                    <p className="text-xs mt-2">Where:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>Late Year Expenses = Average expenses in final 1/3 of projection years</li>
                      <li>Medical Expense Ratio = Percentage increase in late-year expenses</li>
                      <li>Multiplier of 200 penalizes high medical cost increases</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Assumptions:</p>
                    <ul className="text-xs list-disc list-inside ml-2 space-y-1">
                      <li>No increase in late years = Score of 100</li>
                      <li>50% increase in late years = Score of 0</li>
                      <li>Uses expense growth as proxy for medical costs (not explicitly tracked)</li>
                    </ul>
                    <p className="text-xs font-medium mt-2">Research Reference:</p>
                    <p className="text-xs">Fidelity Retiree Health Care Cost Estimate (2023) - Average 65-year-old couple needs $315K for health care. HealthView Services projects 5.5% annual health care inflation vs 2.5% general inflation.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>

      {/* Market Risks & Monte Carlo */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Market Risk Analysis</h3>
          <button
            onClick={async () => {
              setRunningMonteCarlo(true)
              try {
                // Load data for Monte Carlo
                const [planData, accountsData, expensesData, incomeData, settingsData] = await Promise.all([
                  supabase.from('rp_retirement_plans').select('birth_year, life_expectancy, filing_status').eq('id', planId).single(),
                  supabase.from('rp_accounts').select('*').eq('plan_id', planId),
                  supabase.from('rp_expenses').select('*').eq('plan_id', planId),
                  supabase.from('rp_other_income').select('*').eq('plan_id', planId),
                  supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
                ])

                if (planData.error) {
                  console.error('Error loading plan data:', planData.error)
                  alert(`Failed to load plan data: ${planData.error.message}`)
                  return
                }
                
                if (!planData.data) {
                  alert('Plan data not found')
                  return
                }
                
                if (!planData.data.birth_year) {
                  alert('Please set birth year in Plan Details before running Monte Carlo simulation')
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

                const settings: CalculatorSettings = {
                  current_year: settingsData.data?.current_year || new Date().getFullYear(),
                  retirement_age: settingsData.data?.retirement_age || 65,
                  retirement_start_year: settingsData.data?.retirement_start_year || 0,
                  years_to_retirement: settingsData.data?.years_to_retirement || 0,
                  annual_retirement_expenses: settingsData.data?.annual_retirement_expenses || 0,
                  growth_rate_before_retirement: parseFloat(settingsData.data?.growth_rate_before_retirement?.toString() || '0.1'),
                  growth_rate_during_retirement: parseFloat(settingsData.data?.growth_rate_during_retirement?.toString() || '0.05'),
                  capital_gains_tax_rate: parseFloat(settingsData.data?.capital_gains_tax_rate?.toString() || '0.2'),
                  income_tax_rate_retirement: parseFloat(settingsData.data?.income_tax_rate_retirement?.toString() || '0.25'),
                  inflation_rate: parseFloat(settingsData.data?.inflation_rate?.toString() || '0.04'),
                  filing_status: (planData.data.filing_status as any) || 'Single',
                }

                const { summary } = runMonteCarloSimulation(
                  planData.data.birth_year,
                  accounts,
                  expenses,
                  otherIncome,
                  settings,
                  planData.data.life_expectancy || 90,
                  1000 // Run 1000 simulations
                )

                setMonteCarloSummary(summary)
              } catch (error) {
                console.error('Error running Monte Carlo:', error)
                alert('Failed to run Monte Carlo simulation')
              } finally {
                setRunningMonteCarlo(false)
              }
            }}
            disabled={runningMonteCarlo || !selectedScenarioId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {runningMonteCarlo ? 'Running Simulation...' : 'Run Monte Carlo Simulation'}
          </button>
        </div>

        {sequenceRisk && (
          <div className="mb-4 p-4 rounded-lg border-l-4 bg-gray-50" style={{
            borderLeftColor: sequenceRisk.riskLevel === 'High' ? '#ef4444' : 
                            sequenceRisk.riskLevel === 'Medium' ? '#f59e0b' : '#10b981'
          }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-semibold text-gray-900 mb-1">Sequence of Returns Risk</div>
                <div className="text-sm text-gray-700 mb-2">{sequenceRisk.description}</div>
                <div className="text-xs text-gray-600 mb-2">
                  <strong>Worst case:</strong> {sequenceRisk.worstCaseSequence.toFixed(1)}% | 
                  <strong> Best case:</strong> {sequenceRisk.bestCaseSequence.toFixed(1)}% | 
                  <strong> Average:</strong> {sequenceRisk.averageSequence.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-2 p-2 bg-white rounded border border-gray-200">
                  <strong>What these percentages mean:</strong> These represent the annual returns during the first 10 years of retirement. 
                  A negative worst case (e.g., -20%) means your portfolio could lose 20% in a bad year early in retirement, which is particularly 
                  dangerous because you're withdrawing money at the same time. This "sequence risk" can deplete your savings faster than average 
                  returns would suggest, even if your long-term average return is positive.
                </div>
              </div>
              <span className={`ml-4 px-2 py-1 rounded text-xs font-medium ${
                sequenceRisk.riskLevel === 'High' ? 'bg-red-200 text-red-800' :
                sequenceRisk.riskLevel === 'Medium' ? 'bg-yellow-200 text-yellow-800' :
                'bg-green-200 text-green-800'
              }`}>
                {sequenceRisk.riskLevel} Risk
              </span>
            </div>
          </div>
        )}

        {monteCarloSummary && (
          <div className="mt-4 p-4 rounded-lg border border-blue-200 bg-blue-50">
            <h4 className="font-semibold text-gray-900 mb-3">Monte Carlo Simulation Results (1,000 runs)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Success Rate</div>
                <div className={`text-lg font-semibold ${
                  monteCarloSummary.successRate >= 80 ? 'text-green-600' :
                  monteCarloSummary.successRate >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {monteCarloSummary.successRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-600">Avg Final Net Worth</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${monteCarloSummary.averageFinalNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Median Final Net Worth</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${monteCarloSummary.medianFinalNetworth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Worst Case (5th percentile)</div>
                <div className="text-lg font-semibold text-red-600">
                  ${monteCarloSummary.percentile95.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">25th Percentile</div>
                <div className="text-base font-medium text-gray-900">
                  ${monteCarloSummary.percentile25.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-gray-600">75th Percentile</div>
                <div className="text-base font-medium text-gray-900">
                  ${monteCarloSummary.percentile75.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-gray-600">90th Percentile</div>
                <div className="text-base font-medium text-gray-900">
                  ${monteCarloSummary.percentile90.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Avg Years with Negative Cash Flow</div>
                <div className="text-base font-medium text-gray-900">
                  {monteCarloSummary.averageYearsWithNegativeCashFlow.toFixed(1)}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-gray-600">
              <strong>Note:</strong> Monte Carlo simulation models market volatility by varying returns using normal distribution 
              (15% std dev before retirement, 12% during retirement). Success rate indicates percentage of simulations where 
              plan remains sustainable (final net worth &gt; 0 and &lt; 20% of years with negative cash flow).
            </p>
          </div>
        )}

        {!sequenceRisk && !monteCarloSummary && (
          <p className="text-gray-600 text-sm">
            Click "Run Monte Carlo Simulation" to analyze market risks and sequence of returns risk for this scenario.
          </p>
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

      {/* Tax Efficiency Levers */}
      {taxEfficiency && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Efficiency Levers</h3>
          
          {/* Roth Conversion Analysis */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Roth Conversion Opportunities</h4>
            {taxEfficiency.rothConversion && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Optimal Conversion Amount</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${taxEfficiency.rothConversion.optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Tax Cost</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${taxEfficiency.rothConversion.taxCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-700 font-medium">Future Tax Savings</div>
                    <div className="text-lg font-semibold text-green-800">
                      ${taxEfficiency.rothConversion.futureSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-700 mt-2">
                  {taxEfficiency.rothConversion.recommendation}
                </div>
              </div>
            )}
          </div>

          {/* Tax Summary */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Tax Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-700 font-medium">Total Taxes Over Retirement</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${taxEfficiency.totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">Average Annual Tax</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${taxEfficiency.avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700 font-medium">Tax Efficiency Score</div>
                <div className="text-lg font-semibold text-gray-900">
                  {taxEfficiency.efficiencyScore}/100
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const retirementProjections = projections.filter(p => p.age && p.age >= (settings.retirement_age || 65))
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
    const inflationRate = settings.inflation_rate || 0.04
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
  // Longevity: 60%, Tax Efficiency: 15%, Cashflow: 5%, Inflation: 10%, Medical: 10%
  const overallScore = Math.round(
    longevityScore * 0.60 + 
    taxEfficiencyScore * 0.15 + 
    cashflowScore * 0.05 + 
    inflationScore * 0.10 + 
    medicalScore * 0.10
  )
  
  // Risk Level
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Low'
  if (overallScore < 50) riskLevel = 'High'
  else if (overallScore < 75) riskLevel = 'Medium'
  
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
  const rmdYears = projections.filter(p => p.age && p.age >= 73)
  if (rmdYears.length > 0) {
    const maxRmd = Math.max(...rmdYears.map(p => p.distribution_401k || 0))
    const avgIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0) / projections.length
    if (maxRmd > avgIncome * 0.5) {
      risks.push({
        type: 'High RMD Risk',
        severity: 'Medium',
        description: `RMDs may push you into higher tax brackets after age 73.`,
        recommendation: 'Consider Roth conversions before age 73 to reduce future RMDs and tax burden.'
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
  const retirementProjections = projections.filter(p => p.age && p.age >= (settings.retirement_age || 65))
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
        description: `Expenses are growing ${((expenseGrowthRate - incomeGrowthRate) * 100).toFixed(1)}% faster than income, indicating inflation may erode purchasing power.`,
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
      description: `Current growth rate assumption (${(settings.growth_rate_during_retirement * 100).toFixed(1)}%) may be conservative.`,
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
  const rmdProjections = projections.filter(p => p.age && p.age >= 73)
  
  if (rmdProjections.length === 0) {
    return {
      firstRmdYear: 'N/A',
      firstRmdAmount: 0,
      peakRmdYear: 'N/A',
      peakRmdAmount: 0,
      totalRmds: 0,
      recommendation: 'RMDs will begin at age 73. Consider Roth conversions before then to reduce future RMDs.'
    }
  }
  
  const firstRmd = rmdProjections[0]
  const peakRmd = rmdProjections.reduce((max, p) => 
    (p.distribution_401k || 0) > (max.distribution_401k || 0) ? p : max
  , rmdProjections[0])
  
  const totalRmds = rmdProjections.reduce((sum, p) => sum + (p.distribution_401k || 0), 0)
  
  let recommendation = ''
  if (peakRmd.distribution_401k && peakRmd.distribution_401k > 100000) {
    recommendation = 'High RMDs detected. Consider Roth conversions before age 73 to reduce future tax burden.'
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

function analyzeTaxEfficiency(
  projections: ProjectionDetail[],
  settings: CalculatorSettings,
  accounts: Account[]
): any {
  if (projections.length === 0) {
    return {
      totalTaxes: 0,
      avgAnnualTax: 0,
      efficiencyScore: 0,
      rothConversion: null
    }
  }
  
  const totalTaxes = projections.reduce((sum, p) => sum + (p.tax || 0), 0)
  const avgAnnualTax = totalTaxes / projections.length
  
  const totalIncome = projections.reduce((sum, p) => sum + (p.total_income || 0), 0)
  const taxRate = totalIncome > 0 ? (totalTaxes / totalIncome) * 100 : 0
  const efficiencyScore = Math.max(0, 100 - taxRate * 2)
  
  // Roth conversion analysis
  const traditionalBalance = accounts
    .filter(acc => acc.account_type === '401k' || acc.account_type === 'IRA' || acc.account_type === 'Traditional IRA')
    .reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  let rothConversion = null
  if (traditionalBalance > 50000) {
    // Suggest converting up to $50k per year in lower tax brackets
    const optimalAmount = Math.min(50000, traditionalBalance * 0.1)
    const taxCost = optimalAmount * settings.income_tax_rate_retirement
    // Estimate future savings (simplified: assume 20% tax savings over 20 years)
    const futureSavings = optimalAmount * 0.2 * 20
    
    rothConversion = {
      optimalAmount,
      taxCost,
      futureSavings,
      recommendation: `Consider converting $${optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year to Roth accounts. This will cost $${taxCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} in taxes now but could save $${futureSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} in future taxes.`
    }
  }
  
  return {
    totalTaxes,
    avgAnnualTax,
    efficiencyScore: Math.round(efficiencyScore),
    rothConversion
  }
}

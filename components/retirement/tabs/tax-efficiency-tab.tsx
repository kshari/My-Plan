'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import { Save, Edit, X, Check } from 'lucide-react'
import {
  type Account,
  type Expense,
  type OtherIncome,
  type CalculatorSettings,
  type ProjectionDetail
} from '@/lib/utils/retirement-projections'
import { analyzeTaxEfficiency } from './analysis-tab'

interface TaxEfficiencyTabProps {
  planId: number
}

export default function TaxEfficiencyTab({ planId }: TaxEfficiencyTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [taxEfficiency, setTaxEfficiency] = useState<any>(null)
  const [scenarios, setScenarios] = useState<Array<{ id: number; scenario_name: string; is_default: boolean }>>([])
  const [showRothExplanation, setShowRothExplanation] = useState(false)
  const [showTaxSavingsCalculation, setShowTaxSavingsCalculation] = useState(false)
  const [showTaxInputForm, setShowTaxInputForm] = useState(false)
  const [currentGrossIncome, setCurrentGrossIncome] = useState<number | null>(null)
  const [currentTaxBracket, setCurrentTaxBracket] = useState<number | null>(null)
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [savingTaxInfo, setSavingTaxInfo] = useState(false)
  const [currentSettings, setCurrentSettings] = useState<CalculatorSettings | null>(null)
  const [showTaxSummaryDetails, setShowTaxSummaryDetails] = useState(false)
  const [showAdditionalStrategies, setShowAdditionalStrategies] = useState(false)
  const [showTaxAssumptions, setShowTaxAssumptions] = useState(false)
  const [showContributionAnalysis, setShowContributionAnalysis] = useState(true)
  const [contributionAnalysis, setContributionAnalysis] = useState<any>(null)
  const [showRetirementBracketExplanation, setShowRetirementBracketExplanation] = useState(false)

  // Calculate tax bracket from income based on 2024 tax brackets
  const calculateTaxBracket = (income: number, filingStatus: string): number => {
    // 2024 tax brackets (marginal rates)
    const brackets: Record<string, Array<{min: number, max: number, rate: number}>> = {
      'Single': [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
      ],
      'Married Filing Jointly': [
        { min: 0, max: 23200, rate: 0.10 },
        { min: 23200, max: 94300, rate: 0.12 },
        { min: 94300, max: 201050, rate: 0.22 },
        { min: 201050, max: 383900, rate: 0.24 },
        { min: 383900, max: 487450, rate: 0.32 },
        { min: 487450, max: 731200, rate: 0.35 },
        { min: 731200, max: Infinity, rate: 0.37 }
      ],
      'Married Filing Separately': [
        { min: 0, max: 11600, rate: 0.10 },
        { min: 11600, max: 47150, rate: 0.12 },
        { min: 47150, max: 100525, rate: 0.22 },
        { min: 100525, max: 191950, rate: 0.24 },
        { min: 191950, max: 243725, rate: 0.32 },
        { min: 243725, max: 365600, rate: 0.35 },
        { min: 365600, max: Infinity, rate: 0.37 }
      ],
      'Head of Household': [
        { min: 0, max: 16550, rate: 0.10 },
        { min: 16550, max: 63100, rate: 0.12 },
        { min: 63100, max: 100500, rate: 0.22 },
        { min: 100500, max: 191950, rate: 0.24 },
        { min: 191950, max: 243700, rate: 0.32 },
        { min: 243700, max: 609350, rate: 0.35 },
        { min: 609350, max: Infinity, rate: 0.37 }
      ]
    }
    
    const status = filingStatus || 'Single'
    const bracketList = brackets[status] || brackets['Single']
    
    for (const bracket of bracketList) {
      if (income >= bracket.min && income < bracket.max) {
        return bracket.rate
      }
    }
    
    return 0.37 // Top bracket
  }

  // Analyze traditional vs Roth contribution strategy
  const analyzeContributionStrategy = (
    accounts: Account[],
    settings: CalculatorSettings,
    projections: ProjectionDetail[],
    planData: any,
    currentGrossIncome: number | null,
    currentTaxBracket: number | null,
    effectiveTaxRate: number
  ): any => {
    // Get current tax bracket
    const currentBracket = currentTaxBracket || effectiveTaxRate || 0.22
    const filingStatus = settings.filing_status || planData?.filing_status || 'Single'
    
    // Estimate retirement tax bracket from projections
    // Look at average taxable income in retirement years
    const retirementProjections = projections.filter(p => {
      const age = p.age || 0
      return age >= (settings.retirement_age || 65) && age < 80 // First 15 years of retirement
    })
    
    let avgRetirementTaxableIncome = 0
    if (retirementProjections.length > 0) {
      const totalTaxableIncome = retirementProjections.reduce((sum, p) => sum + (p.taxable_income || 0), 0)
      avgRetirementTaxableIncome = totalTaxableIncome / retirementProjections.length
    } else {
      // Fallback: estimate based on expenses and SSA
      avgRetirementTaxableIncome = (settings.annual_retirement_expenses || 0) * 0.7 // Assume 70% from taxable sources
    }
    
    // Calculate expected retirement tax bracket
    const retirementTaxBracket = calculateTaxBracket(avgRetirementTaxableIncome, filingStatus)
    
    // Calculate years until retirement
    const currentYear = settings.current_year || new Date().getFullYear()
    const yearsToRetirement = settings.years_to_retirement || 0
    
    // Calculate tax savings and future tax for a $1,000 contribution
    const contributionAmount = 1000
    const traditionalTaxSavings = contributionAmount * currentBracket
    const growthRate = settings.growth_rate_before_retirement || 0.1
    const yearsOfGrowth = Math.max(1, yearsToRetirement)
    const futureValue = contributionAmount * Math.pow(1 + growthRate, yearsOfGrowth)
    const traditionalFutureTax = futureValue * retirementTaxBracket
    
    // Net benefit comparison
    const traditionalNetBenefit = traditionalTaxSavings - traditionalFutureTax
    const rothNetBenefit = 0 // Pay tax now, no tax later
    
    // Determine recommendation
    let recommendation: 'Traditional' | 'Roth' | 'Both' = 'Both'
    let recommendationText = ''
    let considerations: string[] = []
    let traditionalSplit = 50
    let rothSplit = 50
    
    const bracketDifference = currentBracket - retirementTaxBracket
    
    if (bracketDifference > 0.05) {
      // Current bracket is significantly higher - recommend Traditional
      recommendation = 'Traditional'
      recommendationText = `Your current tax bracket (${(currentBracket * 100).toFixed(0)}%) is significantly higher than your expected retirement bracket (${(retirementTaxBracket * 100).toFixed(0)}%). Contributing to traditional accounts now will give you an immediate tax deduction at a higher rate, and you'll pay taxes in retirement at a lower rate.`
      traditionalSplit = 80
      rothSplit = 20
      considerations = [
        `Save ${(currentBracket * 100).toFixed(0)}% in taxes now vs. paying ${(retirementTaxBracket * 100).toFixed(0)}% later`,
        'Maximize employer match if available (usually goes to traditional 401k)',
        'Consider Roth for tax diversification (20% of contributions)',
        'Traditional contributions reduce current taxable income, potentially keeping you in a lower bracket'
      ]
    } else if (bracketDifference < -0.05) {
      // Retirement bracket is higher - recommend Roth
      recommendation = 'Roth'
      recommendationText = `Your expected retirement tax bracket (${(retirementTaxBracket * 100).toFixed(0)}%) is higher than your current bracket (${(currentBracket * 100).toFixed(0)}%). Contributing to Roth accounts now means paying taxes at today's lower rate, and all future withdrawals will be tax-free.`
      traditionalSplit = 20
      rothSplit = 80
      considerations = [
        `Pay ${(currentBracket * 100).toFixed(0)}% tax now vs. avoiding ${(retirementTaxBracket * 100).toFixed(0)}% tax later`,
        'Roth accounts have no Required Minimum Distributions (RMDs)',
        'Tax-free growth and withdrawals in retirement',
        'Better for estate planning - heirs receive tax-free distributions',
        'Consider traditional for employer match if available'
      ]
    } else {
      // Brackets are similar - recommend both for diversification
      recommendation = 'Both'
      recommendationText = `Your current tax bracket (${(currentBracket * 100).toFixed(0)}%) is similar to your expected retirement bracket (${(retirementTaxBracket * 100).toFixed(0)}%). A balanced approach provides tax diversification and flexibility in retirement.`
      traditionalSplit = 50
      rothSplit = 50
      considerations = [
        'Tax diversification gives you flexibility to manage taxable income in retirement',
        'Traditional accounts provide immediate tax deduction',
        'Roth accounts provide tax-free withdrawals and no RMDs',
        'Having both account types helps optimize tax brackets year-by-year in retirement',
        'Consider your time horizon - more years until retirement may favor Roth due to tax-free growth'
      ]
    }
    
    // Additional considerations based on account balances
    const traditionalBalance = accounts
      .filter(acc => {
        const type = (acc.account_type || '').trim().toLowerCase()
        return type === '401k' || type === 'ira' || type === 'traditional ira'
      })
      .reduce((sum, acc) => sum + (acc.balance || 0), 0)
    
    const rothBalance = accounts
      .filter(acc => {
        const type = (acc.account_type || '').trim().toLowerCase()
        return type === 'roth' || type === 'roth ira'
      })
      .reduce((sum, acc) => sum + (acc.balance || 0), 0)
    
    const totalBalance = traditionalBalance + rothBalance
    if (totalBalance > 0) {
      const traditionalPercentage = (traditionalBalance / totalBalance) * 100
      if (traditionalPercentage > 80) {
        considerations.push('You have a high percentage in traditional accounts - consider increasing Roth contributions for better tax diversification')
      } else if (traditionalPercentage < 20) {
        considerations.push('You have mostly Roth accounts - consider traditional contributions to get current tax deductions')
      }
    }
    
    // Age-based considerations
    if (yearsToRetirement > 20) {
      considerations.push('With many years until retirement, Roth contributions benefit from decades of tax-free growth')
    } else if (yearsToRetirement < 10) {
      considerations.push('With retirement approaching, traditional contributions may provide more immediate tax benefits')
    }
    
    return {
      recommendation,
      recommendationText,
      currentTaxBracket: currentBracket,
      retirementTaxBracket,
      avgRetirementTaxableIncome: Math.round(avgRetirementTaxableIncome),
      retirementProjectionsCount: retirementProjections.length,
      traditionalTaxSavings: Math.round(traditionalTaxSavings),
      traditionalFutureTax: Math.round(traditionalFutureTax),
      traditionalNetBenefit: Math.round(traditionalNetBenefit),
      rothNetBenefit: 0,
      traditionalSplit,
      rothSplit,
      considerations
    }
  }

  useEffect(() => {
    loadScenarios()
  }, [planId])

  useEffect(() => {
    // Clear previous analysis when scenario changes
    setTaxEfficiency(null)
    if (selectedScenarioId) {
      calculateTaxEfficiencyAnalysis()
    }
  }, [planId, selectedScenarioId])

  const loadScenarios = async () => {
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('id, scenario_name, is_default')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('scenario_name')

      if (error) throw error
      setScenarios(data || [])
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const calculateTaxEfficiencyAnalysis = async () => {
    if (!selectedScenarioId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Load all necessary data
      const [accountsData, settingsData, projectionsData] = await Promise.all([
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
        supabase.from('rp_projection_details').select('*').eq('scenario_id', selectedScenarioId).order('year'),
      ])

      const accounts: Account[] = (accountsData.data || []).map(acc => ({
        id: acc.id,
        account_name: acc.account_name,
        owner: acc.owner || '',
        balance: acc.balance || 0,
        account_type: acc.account_type,
        annual_contribution: acc.annual_contribution || 0,
      }))

      // Get plan data for filing_status and tax info
      const { data: planDataForSettings } = await supabase
        .from('rp_retirement_plans')
        .select('filing_status, current_gross_income, current_tax_bracket')
        .eq('id', planId)
        .single()
      
      // Load saved tax info if available
      if (planDataForSettings?.current_gross_income && !currentGrossIncome) {
        setCurrentGrossIncome(planDataForSettings.current_gross_income)
      }
      if (planDataForSettings?.current_tax_bracket && !currentTaxBracket) {
        setCurrentTaxBracket(planDataForSettings.current_tax_bracket)
      }
      
      // Use current tax bracket from profile if available, otherwise use estimated 22% bracket
      const effectiveTaxRate = currentTaxBracket || planDataForSettings?.current_tax_bracket || 0.22

      const settings: CalculatorSettings = {
        current_year: settingsData.data?.current_year || new Date().getFullYear(),
        retirement_age: settingsData.data?.retirement_age || 65,
        retirement_start_year: settingsData.data?.retirement_start_year || 0,
        years_to_retirement: settingsData.data?.years_to_retirement || 0,
        annual_retirement_expenses: settingsData.data?.annual_retirement_expenses || 0,
        growth_rate_before_retirement: parseFloat(settingsData.data?.growth_rate_before_retirement?.toString() || '0.1'),
        growth_rate_during_retirement: parseFloat(settingsData.data?.growth_rate_during_retirement?.toString() || '0.05'),
        inflation_rate: parseFloat(settingsData.data?.inflation_rate?.toString() || '0.04'),
        filing_status: (planDataForSettings?.filing_status as any) || 'Single',
      }
      
      setCurrentSettings(settings)

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

      // Calculate tax efficiency
      const calculatedTaxEfficiency = analyzeTaxEfficiency(projections, settings, accounts)
      setTaxEfficiency(calculatedTaxEfficiency)
      
      // Calculate traditional vs Roth contribution analysis
      const contributionAnalysisResult = analyzeContributionStrategy(
        accounts,
        settings,
        projections,
        planDataForSettings,
        currentGrossIncome,
        currentTaxBracket,
        effectiveTaxRate
      )
      setContributionAnalysis(contributionAnalysisResult)
    } catch (error) {
      console.error('Error calculating tax efficiency:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Calculating tax efficiency analysis...</div>
  }

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)

  if (!selectedScenarioId) {
    return (
      <div className="relative min-h-screen pb-32">
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
          </div>
          <div className="text-center py-8 text-gray-600">
            Please select a scenario to view tax efficiency analysis.
          </div>
        </div>
        
        {/* Important Disclaimer - Always Visible at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-300 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Important Disclaimer:</p>
                <p className="text-xs sm:text-sm text-gray-700">
                  This tax efficiency analysis and the strategies discussed are for educational purposes only and should not be considered as personalized tax, legal, or financial advice. Tax laws change frequently, and individual circumstances vary significantly. These strategies have significant legal, tax, and financial implications and require careful planning and coordination with qualified professionals including estate attorneys, tax advisors, and financial planners. Consult with qualified professionals before implementing any of these strategies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!taxEfficiency) {
    return (
      <div className="relative min-h-screen pb-32">
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
          <div className="text-center py-8 text-gray-600">
            Please calculate projections first to view tax efficiency analysis.
          </div>
        </div>
        
        {/* Important Disclaimer - Always Visible at Bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-300 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Important Disclaimer:</p>
                <p className="text-xs sm:text-sm text-gray-700">
                  This tax efficiency analysis and the strategies discussed are for educational purposes only and should not be considered as personalized tax, legal, or financial advice. Tax laws change frequently, and individual circumstances vary significantly. These strategies have significant legal, tax, and financial implications and require careful planning and coordination with qualified professionals including estate attorneys, tax advisors, and financial planners. Consult with qualified professionals before implementing any of these strategies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-32">
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
        
        <div className="rounded-lg border border-gray-200 bg-white p-6">
        {/* Tax Summary */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Tax Summary</h4>
          <p className="text-xs sm:text-sm text-gray-700 mb-4">
            The summary below is based on your current <strong>tax-efficient withdrawal strategy</strong>, which prioritizes withdrawing from taxable accounts first, then tax-deferred accounts (401k/IRA), and finally tax-free accounts (Roth) to minimize taxes over your retirement. 
            <button
              onClick={() => setShowTaxAssumptions(!showTaxAssumptions)}
              className="text-blue-600 hover:text-blue-800 underline font-medium ml-1"
            >
              Tax Bracket & Rate Assumptions
              <span className="ml-1 text-xs">{showTaxAssumptions ? '▼' : '▶'}</span>
            </button>
          </p>
          
          {/* Summary - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
          
          {/* Tax Bracket & Rate Assumptions - Expandable */}
          {showTaxAssumptions && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h5 className="font-semibold text-gray-900 mb-3">Tax Bracket & Rate Assumptions</h5>
              <p className="text-xs sm:text-sm text-gray-700 mb-2">
                Current analysis uses the following assumptions:
              </p>
              <ul className="text-xs sm:text-sm text-gray-700 list-disc list-inside ml-2 space-y-1 mb-3">
                <li><strong>Tax Calculation:</strong> Using IRS tax brackets for each year</li>
                <li><strong>Filing Status:</strong> {currentSettings?.filing_status || 'Single'}</li>
                {currentGrossIncome && (
                  <li><strong>Current Gross Income:</strong> ${currentGrossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} (from profile)</li>
                )}
                {currentTaxBracket && (
                  <li><strong>Current Tax Bracket:</strong> {(currentTaxBracket * 100).toFixed(0)}% (from profile)</li>
                )}
              </ul>
              
              {!currentGrossIncome && !currentTaxBracket && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-700 mb-3">
                    For more accurate tax analysis, you can provide your current gross income or tax bracket. 
                    This will help calculate more precise Roth conversion recommendations and tax projections.
                  </p>
                  <button
                    onClick={() => setShowTaxInputForm(!showTaxInputForm)}
                    className="flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-xs sm:text-sm font-medium text-blue-700 hover:bg-blue-200"
                  >
                    {showTaxInputForm ? '▼' : '▶'} {showTaxInputForm ? 'Hide' : 'Enter Tax Information'}
                  </button>
                </div>
              )}
              
              {showTaxInputForm && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-yellow-300">
                  <h5 className="font-semibold text-gray-900 mb-3 text-sm">Enter Your Tax Information</h5>
                  <div className="space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Current Gross Income (Annual)
                  </label>
                  <input
                    type="number"
                    value={currentGrossIncome || ''}
                    onChange={(e) => {
                      const income = e.target.value ? parseFloat(e.target.value) : null
                      setCurrentGrossIncome(income)
                      // Auto-calculate tax bracket when income changes
                      if (income && income > 0 && currentSettings) {
                        const calculatedBracket = calculateTaxBracket(income, currentSettings.filing_status || 'Single')
                        setCurrentTaxBracket(calculatedBracket)
                      } else if (!income) {
                        setCurrentTaxBracket(null)
                      }
                    }}
                    placeholder="e.g., 100000"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Your total annual income before taxes. Tax bracket will be calculated automatically.</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Current Tax Bracket (%)
                  </label>
                  <input
                    type="number"
                    value={currentTaxBracket ? (currentTaxBracket * 100).toFixed(2) : ''}
                    onChange={(e) => setCurrentTaxBracket(e.target.value ? parseFloat(e.target.value) / 100 : null)}
                    placeholder="e.g., 22 (for 22%)"
                    min="0"
                    max="100"
                    step="0.1"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Your current marginal tax bracket percentage. 
                    {currentGrossIncome && currentTaxBracket && (
                      <span className="text-blue-600"> Calculated from income, but you can adjust if needed.</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="saveToProfile"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="saveToProfile" className="ml-2 block text-xs sm:text-sm text-gray-700">
                    Save this information to my retirement profile (will be used for all calculations)
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setSavingTaxInfo(true)
                      try {
                        const updateData: any = {}
                        // Save both income and tax bracket together
                        if (currentGrossIncome) {
                          updateData.current_gross_income = currentGrossIncome
                        }
                        if (currentTaxBracket) {
                          updateData.current_tax_bracket = currentTaxBracket
                        }
                        
                        if (saveToProfile && Object.keys(updateData).length > 0) {
                          const { error } = await supabase
                            .from('rp_retirement_plans')
                            .update(updateData)
                            .eq('id', planId)
                          
                          if (error) throw error
                        }
                        
                        setShowTaxInputForm(false)
                        // Recalculate analysis with new tax info
                        await calculateTaxEfficiencyAnalysis()
                      } catch (error: any) {
                        console.error('Error saving tax info:', error)
                        alert('Error saving tax information: ' + error.message)
                      } finally {
                        setSavingTaxInfo(false)
                      }
                    }}
                    disabled={savingTaxInfo || (!currentGrossIncome || !currentTaxBracket)}
                    className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-xs sm:text-sm font-medium text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {savingTaxInfo ? 'Saving...' : 'Save & Update Analysis'}
                  </button>
                  <button
                    onClick={() => {
                      setShowTaxInputForm(false)
                      setCurrentGrossIncome(null)
                      setCurrentTaxBracket(null)
                      setSaveToProfile(false)
                    }}
                    className="rounded-md bg-gray-200 px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
                  </div>
                </div>
              )}
              
              {(currentGrossIncome || currentTaxBracket) && !showTaxInputForm && (
                <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-xs sm:text-sm text-green-800 mb-2">
                    ✓ Using saved tax information from your profile
                  </p>
                  <button
                    onClick={() => setShowTaxInputForm(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    Edit tax information
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
        
        {/* Tax Efficiency Levers */}
        <h3 className="text-lg font-semibold text-gray-900 mb-4 mt-6">Tax Efficiency Levers</h3>
        
        {/* Roth Conversion Analysis */}
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="font-semibold text-gray-900">Roth Conversion Strategy</h4>
            {taxEfficiency.rothConversion && (
              <button
                onClick={() => setShowRothExplanation(!showRothExplanation)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 underline"
              >
                {showRothExplanation ? 'Hide' : 'Explain'}
                <span className="ml-1 text-xs">{showRothExplanation ? '▼' : '▶'}</span>
              </button>
            )}
          </div>
          {taxEfficiency.rothConversion ? (
            <>
              {/* Detailed Explanation */}
              {showRothExplanation && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-semibold text-gray-900 mb-3">Detailed Explanation</h5>
                  <div className="space-y-3 text-sm text-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 mb-1">What is a Roth Conversion?</p>
                      <p className="text-xs sm:text-sm">
                        A Roth conversion involves transferring funds from a traditional IRA or 401(k) to a Roth IRA. 
                        You pay income tax on the converted amount now, but all future withdrawals (including earnings) 
                        are tax-free, provided you meet the 5-year holding period and are at least 59½ years old.
                      </p>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 mb-1">Why Convert Now?</p>
                      <ul className="text-xs sm:text-sm list-disc list-inside ml-2 space-y-1">
                        <li><strong>Lower Tax Rates:</strong> You're likely in a lower tax bracket now than you will be when RMDs begin at age 73</li>
                        <li><strong>Reduce RMDs:</strong> Converting traditional accounts to Roth reduces the balance subject to Required Minimum Distributions (RMDs)</li>
                        <li><strong>Tax-Free Growth:</strong> All future earnings in the Roth account grow tax-free</li>
                        <li><strong>Tax Diversification:</strong> Having both traditional and Roth accounts gives you flexibility to manage your tax bracket in retirement</li>
                        <li><strong>Estate Planning:</strong> Roth IRAs don't have RMDs for the original owner, and beneficiaries can stretch distributions over their lifetime</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 mb-1">How the Recommendation is Calculated:</p>
                      <div className="bg-white p-3 rounded border border-blue-200">
                        <p className="text-xs font-mono text-gray-800 mb-2">
                          Optimal Amount = min($50,000, Traditional Balance × 10%)
                        </p>
                        <p className="text-xs font-mono text-gray-800 mb-2">
                          Tax Cost = Optimal Amount × Current Tax Rate
                        </p>
                        <p className="text-xs font-mono text-gray-800">
                          Future Savings = Estimated tax savings over 20 years
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm mt-2">
                        The system suggests converting up to $50,000 per year (or 10% of your traditional balance, whichever is less) 
                        to stay within lower tax brackets. This conservative approach helps you:
                      </p>
                      <ul className="text-xs sm:text-sm list-disc list-inside ml-2 space-y-1 mt-1">
                        <li>Avoid jumping into higher tax brackets during conversion</li>
                        <li>Spread the tax burden over multiple years</li>
                        <li>Maximize the benefit while minimizing immediate tax impact</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 mb-1">Key Considerations:</p>
                      <ul className="text-xs sm:text-sm list-disc list-inside ml-2 space-y-1">
                        <li><strong>Tax Bracket Management:</strong> Convert only enough to fill your current tax bracket without pushing into the next one</li>
                        <li><strong>Timing:</strong> Best done between retirement and age 73 (RMD age) when income may be lower</li>
                        <li><strong>5-Year Rule:</strong> Converted funds must stay in Roth for 5 years before tax-free withdrawal (unless you're 59½+)</li>
                        <li><strong>Medicare Premiums:</strong> Large conversions can increase Medicare Part B and D premiums (IRMAA surcharges)</li>
                        <li><strong>State Taxes:</strong> Consider state income tax implications if you plan to move to a different state</li>
                      </ul>
                    </div>
                    
                    <div>
                      <p className="font-medium text-gray-900 mb-1">When NOT to Convert:</p>
                      <ul className="text-xs sm:text-sm list-disc list-inside ml-2 space-y-1">
                        <li>You expect to be in a significantly lower tax bracket in retirement</li>
                        <li>You don't have funds outside retirement accounts to pay the conversion tax</li>
                        <li>You're close to RMD age and the conversion would push you into a much higher bracket</li>
                        <li>You're already in the highest tax bracket and expect to stay there</li>
                      </ul>
                    </div>
                    
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
                      <p className="text-xs sm:text-sm font-medium text-yellow-900 mb-1">⚠️ Important Note:</p>
                      <p className="text-xs sm:text-sm text-yellow-800">
                        This analysis is for illustration purposes. Consult with a tax professional or financial advisor 
                        before making Roth conversion decisions, as individual circumstances vary significantly. Consider 
                        factors like your current tax bracket, expected future tax rates, state taxes, Medicare premiums, 
                        and estate planning goals.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Recommendation Text */}
              {taxEfficiency.rothConversion && (
                <div className="text-sm text-gray-700 mb-4">
                  {taxEfficiency.rothConversion.recommendation}
                </div>
              )}
              
              {/* Net Savings - Clickable to expand details */}
              {taxEfficiency.rothConversion && (() => {
                // Use conversion years from the analysis (calculated based on retirement_start_year from scenario)
                // Fallback calculation if not available
                const conversionStartYear = taxEfficiency.rothConversion.conversionStartYear || 
                  ((currentSettings?.retirement_start_year && currentSettings.retirement_start_year > 0)
                    ? currentSettings.retirement_start_year
                    : ((currentSettings?.current_year || new Date().getFullYear()) + (currentSettings?.years_to_retirement || 0)))
                const conversionEndYear = conversionStartYear + (taxEfficiency.rothConversion.conversionYears || 0) - 1
                const netBenefit = taxEfficiency.rothConversion.netBenefit || 0
                
                return (
                  <div className="mb-4">
                    <button
                      onClick={() => setShowTaxSummaryDetails(!showTaxSummaryDetails)}
                      className="w-full p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700 font-medium">Total Net Savings</div>
                        <div className={`text-xl font-bold ${
                          netBenefit > 0 ? 'text-green-800' : 'text-orange-700'
                        }`}>
                          ${netBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <span className="ml-2 text-sm">{showTaxSummaryDetails ? '▼' : '▶'}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })()}
              
              {/* Impact Details - Expandable */}
              {showTaxSummaryDetails && taxEfficiency.rothConversion && taxEfficiency.taxesWithRothConversion && (
                <>
                  {/* Conversion Details Table */}
                  {(() => {
                    // Use conversion years from the analysis (calculated based on retirement_start_year from scenario)
                    const conversionStartYear = taxEfficiency.rothConversion.conversionStartYear || 
                      ((currentSettings?.retirement_start_year && currentSettings.retirement_start_year > 0)
                        ? currentSettings.retirement_start_year
                        : ((currentSettings?.current_year || new Date().getFullYear()) + (currentSettings?.years_to_retirement || 0)))
                    const conversionEndYear = taxEfficiency.rothConversion.conversionEndYear || 
                      (conversionStartYear + (taxEfficiency.rothConversion.conversionYears || 0) - 1)
                    
                    return (
                      <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <h5 className="font-semibold text-gray-900 mb-3">Conversion Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <div className="text-sm text-gray-700 font-medium">Annual Conversion Amount</div>
                            <div className="text-lg font-semibold text-gray-900">
                              ${taxEfficiency.rothConversion.optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-700 font-medium">Conversion Start Year</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {conversionStartYear}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-700 font-medium">Conversion End Year</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {conversionEndYear}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-700 font-medium">Total Conversion Amount</div>
                            <div className="text-lg font-semibold text-gray-900">
                              ${taxEfficiency.rothConversion.totalConverted.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-300">
                          <p className="text-xs sm:text-sm text-gray-700 mb-2">
                            <strong>Why these conversion years?</strong>
                          </p>
                          <ul className="text-xs sm:text-sm text-gray-700 space-y-1 list-disc list-inside ml-2">
                            <li>
                              <strong>Start Year ({conversionStartYear}):</strong> Begins at your retirement year when your income typically drops, 
                              placing you in a lower tax bracket. This is the optimal window to convert traditional retirement funds to Roth accounts.
                            </li>
                            <li>
                              <strong>End Year ({conversionEndYear}):</strong> Concludes the year before Required Minimum Distributions (RMDs) begin at age 73. 
                              After RMDs start, you're required to take distributions anyway, reducing the benefit of conversion. Converting before RMD age 
                              helps reduce the balance subject to mandatory distributions and gives you more control over your tax situation.
                            </li>
                            <li>
                              <strong>Conversion Window:</strong> This {taxEfficiency.rothConversion.conversionYears || 0}-year period between retirement and RMD age 
                              is often called the "Roth conversion window" - a strategic opportunity to optimize your tax situation when income is lower 
                              and before mandatory distributions begin.
                            </li>
                          </ul>
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Comparison with Roth Conversion */}
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h5 className="font-semibold text-gray-900 mb-3">Estimated Impact of Roth Conversion</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-gray-600 font-medium mb-2">Without Roth Conversion</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Total Taxes:</span>
                            <span className="font-semibold text-gray-900">
                              ${taxEfficiency.totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Avg Annual Tax:</span>
                            <span className="font-semibold text-gray-900">
                              ${taxEfficiency.avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 font-medium mb-2">With Roth Conversion</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Total Taxes:</span>
                            <span className="font-semibold text-green-800">
                              ${taxEfficiency.taxesWithRothConversion.totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Avg Annual Tax:</span>
                            <span className="font-semibold text-green-800">
                              ${taxEfficiency.taxesWithRothConversion.avgAnnualTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm pt-1 border-t border-green-300">
                            <span className="text-gray-700">Conversion Taxes:</span>
                            <span className="font-medium text-orange-700">
                              +${taxEfficiency.taxesWithRothConversion.conversionTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-700">Estimated Savings:</span>
                            <span className="font-medium text-green-700">
                              -${taxEfficiency.taxesWithRothConversion.estimatedSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-900">Net Tax Impact:</span>
                        <span className={`text-lg font-bold ${
                          (taxEfficiency.taxesWithRothConversion.netBenefit || 0) > 0
                            ? 'text-green-700' 
                            : 'text-orange-700'
                        }`}>
                          {(taxEfficiency.taxesWithRothConversion.netBenefit || 0) > 0 ? '↓' : '↑'} 
                          ${Math.abs(taxEfficiency.taxesWithRothConversion.netBenefit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {taxEfficiency.taxesWithRothConversion.netBenefit > 1000 
                          ? `Roth conversion could reduce total lifetime taxes by $${taxEfficiency.taxesWithRothConversion.netBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}.` 
                          : taxEfficiency.taxesWithRothConversion.netBenefit > 0
                          ? `Roth conversion may provide modest tax savings of $${taxEfficiency.taxesWithRothConversion.netBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })}, plus additional benefits like tax diversification and RMD reduction.`
                          : 'Roth conversion may not reduce total taxes if rates remain similar, but it provides tax diversification, RMD reduction, and estate planning benefits.'}
                      </p>
                    </div>
                  </div>
                  
                  {/* How Future Tax Savings Are Calculated */}
                  {taxEfficiency.rothConversion && (() => {
                    const taxRate = taxEfficiency.rothConversion.optimalAmount > 0 
                      ? (taxEfficiency.rothConversion.taxCost / taxEfficiency.rothConversion.optimalAmount) 
                      : 0.25
                    const annualRmdAmount = taxEfficiency.rothConversion.totalConverted * 0.05
                    const annualTaxSavings = annualRmdAmount * taxRate
                    return (
                      <div className="mt-4">
                        <button
                          onClick={() => setShowTaxSavingsCalculation(!showTaxSavingsCalculation)}
                          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 mb-2"
                        >
                          <span className="text-lg">?</span>
                          <span>How are future tax savings calculated?</span>
                          <span className="text-xs">{showTaxSavingsCalculation ? '▼' : '▶'}</span>
                        </button>
                        
                        {showTaxSavingsCalculation && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="font-semibold text-gray-900 mb-2">How Future Tax Savings Are Calculated</h5>
                            <div className="text-xs sm:text-sm text-gray-700 space-y-2">
                              <p>
                                <strong>Step 1 - Conversion Amount:</strong> We recommend converting ${taxEfficiency.rothConversion.optimalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} per year 
                                for {taxEfficiency.rothConversion.conversionYears} years (from retirement age to RMD age), 
                                totaling ${taxEfficiency.rothConversion.totalConverted.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
                              </p>
                              <p>
                                <strong>Step 2 - Conversion Tax Cost:</strong> You pay ${taxEfficiency.rothConversion.taxCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} in taxes per year 
                                on the converted amount (at your current tax rate of {(taxRate * 100).toFixed(0)}%).
                              </p>
                              <p>
                                <strong>Step 3 - Future Tax Savings:</strong> The converted amount would have been subject to RMDs starting at age 73. 
                                We estimate an average RMD rate of 5% per year over 20 years. Without conversion, you'd pay taxes on these RMDs. 
                                With conversion, Roth withdrawals are tax-free.
                              </p>
                              <div className="bg-white p-3 rounded border border-gray-300 mt-2">
                                <p className="text-xs font-mono text-gray-800 mb-1">
                                  Annual RMD on Converted Amount = ${taxEfficiency.rothConversion.totalConverted.toLocaleString(undefined, { maximumFractionDigits: 0 })} × 5% = ${annualRmdAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs font-mono text-gray-800 mb-1">
                                  Annual Tax Savings = ${annualRmdAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} × {(taxRate * 100).toFixed(0)}% = ${annualTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs font-mono text-gray-800">
                                  Total Savings (20 years) = ${annualTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} × 20 = ${taxEfficiency.rothConversion.futureSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                              </div>
                              <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                <p className="text-xs font-medium text-blue-900 mb-1">Why Roth Conversion May Still Be Beneficial Even If Net Taxes Are Similar:</p>
                                <ul className="text-xs text-blue-800 list-disc list-inside space-y-1">
                                  <li><strong>Tax Diversification:</strong> Having both traditional and Roth accounts gives you flexibility to manage your tax bracket each year</li>
                                  <li><strong>RMD Reduction:</strong> Converting reduces your traditional account balance, lowering mandatory RMDs that could push you into higher brackets</li>
                                  <li><strong>Tax Rate Increases:</strong> If tax rates increase in the future, you'll have locked in today's rates</li>
                                  <li><strong>Estate Planning:</strong> Roth IRAs don't have RMDs for the original owner and offer better inheritance benefits</li>
                                  <li><strong>Medicare Premiums:</strong> Lower RMDs mean lower taxable income, potentially reducing Medicare Part B and D premiums (IRMAA)</li>
                                </ul>
                              </div>
                              <p className="text-xs text-gray-600 mt-2 italic">
                                Note: This is a simplified estimate. Actual savings depend on your tax bracket at RMD age, 
                                account growth, withdrawal patterns, and future tax law changes. Consult a tax professional for personalized analysis.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </> 
              )}
            </>
          ) : (
            <div className="text-sm text-gray-700">
              <p className="mb-3">
                Roth conversion analysis is not available because you don't have sufficient traditional retirement account balances (401k, IRA, or Traditional IRA) to make conversions worthwhile.
              </p>
              <p className="text-xs text-gray-600">
                Roth conversions are typically recommended when you have at least $50,000 in traditional retirement accounts. 
                This allows for meaningful conversions that can reduce future RMDs and provide tax diversification.
              </p>
              <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs font-medium text-blue-900 mb-1">Why Roth Conversions Matter:</p>
                <ul className="text-xs text-blue-800 list-disc list-inside space-y-1">
                  <li>Reduce Required Minimum Distributions (RMDs) starting at age 73</li>
                  <li>Provide tax diversification in retirement</li>
                  <li>Lock in current tax rates if you expect rates to increase</li>
                  <li>Offer estate planning benefits</li>
                </ul>
              </div>
            </div>
          )}
        </div>
        
        {/* Traditional vs Roth Contribution Analysis */}
        <div className="mb-6 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Traditional vs Roth Contribution Analysis</h4>
            <button
              onClick={() => setShowContributionAnalysis(!showContributionAnalysis)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              {showContributionAnalysis ? 'Hide' : 'Show'} Details
              <span className="ml-1 text-xs">{showContributionAnalysis ? '▼' : '▶'}</span>
            </button>
          </div>
          
          {showContributionAnalysis && contributionAnalysis && (
            <div className="space-y-4">
              {/* Recommendation Summary */}
              <div className={`p-4 rounded-lg border-2 ${
                contributionAnalysis.recommendation === 'Roth' 
                  ? 'bg-green-50 border-green-300' 
                  : contributionAnalysis.recommendation === 'Traditional'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-yellow-50 border-yellow-300'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">
                      {contributionAnalysis.recommendation === 'Roth' ? '✓' : 
                       contributionAnalysis.recommendation === 'Traditional' ? '✓' : '⚖️'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h5 className="font-semibold text-gray-900 mb-2">
                      Recommendation: {contributionAnalysis.recommendation === 'Roth' ? 'Prioritize Roth Contributions' :
                                      contributionAnalysis.recommendation === 'Traditional' ? 'Prioritize Traditional Contributions' :
                                      'Consider Both (Tax Diversification)'}
                    </h5>
                    <p className="text-sm text-gray-700 mb-3">
                      {contributionAnalysis.recommendationText}
                    </p>
                    {contributionAnalysis.recommendation === 'Both' && (
                      <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                        <p className="text-xs font-medium text-gray-900 mb-2">Suggested Split:</p>
                        <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                          <li>Traditional: {contributionAnalysis.traditionalSplit}% - Take advantage of current tax deduction</li>
                          <li>Roth: {contributionAnalysis.rothSplit}% - Build tax-free retirement income</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factor</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Traditional</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Roth</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Winner</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">Current Tax Bracket</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {(contributionAnalysis.currentTaxBracket * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {(contributionAnalysis.currentTaxBracket * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-blue-600 font-semibold">Traditional</span>
                        <p className="text-xs text-gray-500 mt-1">Tax deduction now</p>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span>Expected Retirement Tax Bracket</span>
                          <button
                            onClick={() => setShowRetirementBracketExplanation(!showRetirementBracketExplanation)}
                            className="text-blue-600 hover:text-blue-800 text-xs underline"
                            title="How is this calculated?"
                          >
                            ?
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        {(contributionAnalysis.retirementTaxBracket * 100).toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        0% (tax-free)
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-green-600 font-semibold">Roth</span>
                        <p className="text-xs text-gray-500 mt-1">No tax in retirement</p>
                      </td>
                    </tr>
                    {showRetirementBracketExplanation && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 bg-blue-50 border-t border-blue-200">
                          <div className="space-y-3">
                            <h6 className="font-semibold text-gray-900 text-sm">How Expected Retirement Tax Bracket is Calculated:</h6>
                            <div className="text-xs sm:text-sm text-gray-700 space-y-2">
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Step 1: Analyze Retirement Projections</p>
                                <p>
                                  The system examines your retirement projections for the first 15 years of retirement (ages {currentSettings?.retirement_age || 65} to 80). 
                                  {contributionAnalysis.retirementProjectionsCount > 0 ? (
                                    <> It found <strong>{contributionAnalysis.retirementProjectionsCount} years</strong> of projection data in this range.</>
                                  ) : (
                                    <> No projection data was available in this range, so an estimate was used.</>
                                  )}
                                </p>
                              </div>
                              
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Step 2: Calculate Average Taxable Income</p>
                                {contributionAnalysis.retirementProjectionsCount > 0 ? (
                                  <>
                                    <p className="mb-1">
                                      For each retirement year, the system looks at your <strong>taxable income</strong>, which includes:
                                    </p>
                                    <ul className="list-disc list-inside ml-2 space-y-1 mb-2">
                                      <li>Distributions from traditional 401(k) and IRA accounts</li>
                                      <li>Distributions from taxable investment accounts (capital gains)</li>
                                      <li>Other recurring income (pensions, rental income, etc.)</li>
                                      <li>Partially taxable Social Security income (if applicable)</li>
                                    </ul>
                                    <p>
                                      The average taxable income across these {contributionAnalysis.retirementProjectionsCount} years is calculated: 
                                      <strong> ${contributionAnalysis.avgRetirementTaxableIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="mb-1">
                                      Since projection data wasn't available, the system estimates taxable income as:
                                    </p>
                                    <p className="font-mono text-xs bg-white p-2 rounded border border-gray-300 mb-2">
                                      Estimated Taxable Income = Annual Retirement Expenses × 70%
                                    </p>
                                    <p>
                                      This assumes that approximately 70% of your retirement expenses will come from taxable sources 
                                      (traditional account distributions, taxable investments, etc.), while 30% comes from tax-free sources 
                                      (Roth withdrawals, Social Security, etc.).
                                    </p>
                                    <p className="mt-2">
                                      Estimated: <strong>${contributionAnalysis.avgRetirementTaxableIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                                    </p>
                                  </>
                                )}
                              </div>
                              
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Step 3: Determine Tax Bracket</p>
                                <p className="mb-1">
                                  Using the calculated average taxable income and your filing status ({currentSettings?.filing_status || 'Single'}), 
                                  the system applies the 2024 federal tax brackets to determine which marginal tax bracket 
                                  this income level falls into.
                                </p>
                                <p>
                                  The result: <strong>{(contributionAnalysis.retirementTaxBracket * 100).toFixed(0)}% marginal tax bracket</strong>
                                </p>
                              </div>
                              
                              <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                                <p className="text-xs font-medium text-yellow-900 mb-1">⚠️ Important Notes:</p>
                                <ul className="text-xs text-yellow-800 list-disc list-inside space-y-1">
                                  <li>This is an <strong>estimate</strong> based on your current plan assumptions and projections</li>
                                  <li>Actual retirement tax bracket will depend on many factors: withdrawal strategy, RMDs, Social Security timing, other income sources, and future tax law changes</li>
                                  <li>The calculation uses <strong>marginal tax bracket</strong> (the rate on your last dollar of income), not effective tax rate</li>
                                  <li>State taxes are not included in this calculation</li>
                                  <li>If your projections change or you update your retirement strategy, this bracket may change</li>
                                </ul>
                              </div>
                              
                              <div className="mt-2">
                                <button
                                  onClick={() => setShowRetirementBracketExplanation(false)}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  Hide explanation
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">Tax Savings (per $1,000 contribution)</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        ${(contributionAnalysis.traditionalTaxSavings).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        $0 (pay tax now)
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-blue-600 font-semibold">Traditional</span>
                        <p className="text-xs text-gray-500 mt-1">Immediate savings</p>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">Future Tax on Withdrawals</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        ${(contributionAnalysis.traditionalFutureTax).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        $0 (tax-free)
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-green-600 font-semibold">Roth</span>
                        <p className="text-xs text-gray-500 mt-1">No future tax</p>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">RMD Impact</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        Subject to RMDs at 73
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700">
                        No RMDs required
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-green-600 font-semibold">Roth</span>
                        <p className="text-xs text-gray-500 mt-1">More flexibility</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Key Considerations */}
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h5 className="font-semibold text-gray-900 mb-3">Key Considerations</h5>
                <div className="space-y-2 text-sm text-gray-700">
                  {contributionAnalysis.considerations.map((consideration: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{consideration}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Additional Tax Efficiency Strategies */}
        <div className="mt-6">
          <button
            onClick={() => setShowAdditionalStrategies(!showAdditionalStrategies)}
            className="flex items-center justify-between w-full mb-4"
          >
            <h4 className="font-semibold text-gray-900">Additional Tax Efficiency Strategies</h4>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-600">{showAdditionalStrategies ? 'Hide' : 'Show'} Details</span>
              <span className="text-xs">{showAdditionalStrategies ? '▼' : '▶'}</span>
            </div>
          </button>
          
          {showAdditionalStrategies && (
            <>
              <p className="text-xs sm:text-sm text-gray-700 mb-4">
                Explore these advanced strategies to further reduce taxes and maximize wealth for yourself and your heirs.
              </p>
              
              <div className="space-y-4">
            {/* Borrow, Spend, Die Strategy */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">1. Borrow, Spend, Die (BSD) Strategy</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">Advanced</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Use loans against appreciated assets to access cash without triggering capital gains taxes. The loan is paid off by your estate, which receives a step-up in basis, effectively eliminating capital gains taxes.
              </p>
              <div className="bg-white p-3 rounded border border-purple-200 mb-3">
                <p className="text-xs font-semibold text-gray-900 mb-2">How It Works:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Borrow against appreciated assets (stocks, real estate) using margin loans, securities-backed lines of credit, or home equity</li>
                  <li>Use loan proceeds for living expenses instead of selling assets</li>
                  <li>Interest payments may be tax-deductible (subject to limitations)</li>
                  <li>Upon death, assets receive step-up in basis, eliminating capital gains</li>
                  <li>Estate pays off the loan with stepped-up assets (no capital gains tax)</li>
                </ul>
              </div>
              <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                <p className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Considerations:</p>
                <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Requires substantial asset base and good credit</li>
                  <li>Interest rates and margin calls are risks</li>
                  <li>Best for high-net-worth individuals with significant appreciated assets</li>
                  <li>Estate tax implications must be considered</li>
                  <li>Requires careful planning with estate attorney and financial advisor</li>
                </ul>
              </div>
            </div>

            {/* Qualified Charitable Distributions */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">2. Qualified Charitable Distributions (QCDs)</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">Age 70½+</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                After age 70½, you can donate up to $105,000 per year directly from your IRA to qualified charities. This satisfies RMDs without adding to taxable income.
              </p>
              <div className="bg-white p-3 rounded border border-green-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Benefits:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Counts toward RMD requirement but doesn't increase taxable income</li>
                  <li>Reduces adjusted gross income (AGI), potentially lowering Medicare premiums</li>
                  <li>No itemization required (standard deduction can still be used)</li>
                  <li>Up to $105,000 per year (2024 limit, indexed for inflation)</li>
                  <li>Can be used for both traditional and inherited IRAs</li>
                </ul>
              </div>
            </div>

            {/* Charitable Remainder Trust */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">3. Charitable Remainder Trust (CRT)</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Estate Planning</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Transfer appreciated assets to an irrevocable trust, receive income for life, and donate remainder to charity. Provides immediate tax deduction and avoids capital gains on the sale.
              </p>
              <div className="bg-white p-3 rounded border border-blue-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">How It Works:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Transfer appreciated assets (stocks, real estate) to CRT</li>
                  <li>Trust sells assets tax-free (no capital gains)</li>
                  <li>Receive annual income payments (5-50% of trust value) for life or fixed term</li>
                  <li>Immediate income tax deduction for present value of remainder interest</li>
                  <li>Remaining assets go to charity upon death or term end</li>
                </ul>
              </div>
              <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mt-2">
                <p className="text-xs font-semibold text-yellow-900 mb-1">⚠️ Considerations:</p>
                <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Irrevocable - cannot get assets back</li>
                  <li>Requires minimum $100,000 contribution typically</li>
                  <li>Complex setup requiring attorney and tax advisor</li>
                  <li>Best for charitably-inclined individuals with highly appreciated assets</li>
                </ul>
              </div>
            </div>

            {/* Tax-Loss Harvesting */}
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">4. Tax-Loss Harvesting</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">Ongoing</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Strategically sell investments at a loss to offset capital gains and reduce taxes. Can offset up to $3,000 of ordinary income per year.
              </p>
              <div className="bg-white p-3 rounded border border-indigo-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Strategy:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Sell losing positions to realize capital losses</li>
                  <li>Use losses to offset capital gains (dollar-for-dollar)</li>
                  <li>Excess losses can offset up to $3,000 of ordinary income annually</li>
                  <li>Unused losses carry forward indefinitely</li>
                  <li>Rebuy similar (but not identical) investments to maintain market exposure</li>
                  <li>Beware of wash-sale rules (30-day waiting period)</li>
                </ul>
              </div>
            </div>

            {/* Gifting Strategies */}
            <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">5. Annual Gifting & Estate Tax Reduction</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-teal-100 text-teal-800">Estate Planning</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Gift assets during your lifetime to reduce estate size and transfer wealth tax-efficiently to heirs.
              </p>
              <div className="bg-white p-3 rounded border border-teal-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Gifting Options:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li><strong>Annual Exclusion:</strong> Gift up to $18,000 per recipient per year (2024, $36,000 for married couples) - no gift tax</li>
                  <li><strong>Lifetime Exemption:</strong> $13.61 million per person (2024) - can gift above annual exclusion using lifetime exemption</li>
                  <li><strong>529 Plans:</strong> Front-load up to 5 years of annual exclusions ($90,000 per beneficiary, $180,000 for couples)</li>
                  <li><strong>Direct Payments:</strong> Pay medical/educational expenses directly - unlimited and gift-tax-free</li>
                  <li><strong>Appreciated Assets:</strong> Gift assets with low basis - recipient gets your basis but removes future appreciation from your estate</li>
                </ul>
              </div>
            </div>

            {/* Donor-Advised Funds */}
            <div className="p-4 bg-pink-50 rounded-lg border border-pink-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">6. Donor-Advised Funds (DAF)</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-pink-100 text-pink-800">Charitable</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Contribute appreciated assets to a DAF, get immediate tax deduction, and distribute to charities over time. Avoids capital gains and provides flexibility.
              </p>
              <div className="bg-white p-3 rounded border border-pink-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Benefits:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Immediate tax deduction (up to 30% of AGI for appreciated assets, 60% for cash)</li>
                  <li>Avoid capital gains tax on appreciated assets</li>
                  <li>Grants can be made to charities over time (no deadline)</li>
                  <li>Simpler and cheaper than private foundation</li>
                  <li>Minimum contributions typically $5,000-$25,000</li>
                </ul>
              </div>
            </div>

            {/* Life Insurance Strategies */}
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">7. Life Insurance for Estate Planning</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">Estate Tax</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Use life insurance to provide liquidity for estate taxes and create tax-free wealth transfer to heirs.
              </p>
              <div className="bg-white p-3 rounded border border-amber-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Strategies:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li><strong>Irrevocable Life Insurance Trust (ILIT):</strong> Removes policy from estate, provides tax-free death benefit to heirs</li>
                  <li><strong>Second-to-Die Policy:</strong> Covers both spouses, pays on second death - lower premiums</li>
                  <li><strong>Premium Financing:</strong> Borrow to pay premiums, estate pays loan with policy proceeds</li>
                  <li>Death benefit is income-tax-free to beneficiaries</li>
                  <li>If properly structured, not included in estate for estate tax purposes</li>
                </ul>
              </div>
            </div>

            {/* Step-Up Basis Planning */}
            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="flex items-start justify-between mb-2">
                <h5 className="font-semibold text-gray-900">8. Step-Up Basis Planning</h5>
                <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-100 text-cyan-800">Inheritance</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 mb-3">
                Hold appreciated assets until death to pass them to heirs with stepped-up basis, eliminating capital gains taxes.
              </p>
              <div className="bg-white p-3 rounded border border-cyan-200">
                <p className="text-xs font-semibold text-gray-900 mb-2">Strategy:</p>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>Don't sell highly appreciated assets during lifetime</li>
                  <li>Heirs receive assets with basis stepped up to fair market value at date of death</li>
                  <li>Heirs can sell immediately with no capital gains tax</li>
                  <li>Best for assets with large unrealized gains</li>
                  <li>Consider estate tax implications (estate exemption is $13.61M per person in 2024)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-300">
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">⚠️ Important Disclaimer:</p>
            <p className="text-xs sm:text-sm text-gray-700">
              These strategies are complex and have significant legal, tax, and financial implications. They require careful planning and coordination with qualified professionals including estate attorneys, tax advisors, and financial planners. Tax laws change frequently, and individual circumstances vary significantly. This information is for educational purposes only and should not be considered as personalized tax, legal, or financial advice. Consult with qualified professionals before implementing any of these strategies.
            </p>
          </div>
            </>
          )}
        </div>
      </div>
      
      {/* Important Disclaimer - Always Visible at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-300 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <span className="text-lg">⚠️</span>
            </div>
            <div className="flex-1">
              <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Important Disclaimer:</p>
              <p className="text-xs sm:text-sm text-gray-700">
                This tax efficiency analysis and the strategies discussed are for educational purposes only and should not be considered as personalized tax, legal, or financial advice. Tax laws change frequently, and individual circumstances vary significantly. These strategies have significant legal, tax, and financial implications and require careful planning and coordination with qualified professionals including estate attorneys, tax advisors, and financial planners. Consult with qualified professionals before implementing any of these strategies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

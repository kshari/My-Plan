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
import { buildProjectionInputs } from '@/lib/utils/projection-inputs'
import {
  DEFAULT_MARGINAL_TAX_RATE,
} from '@/lib/constants/tax-brackets'
import { calculateMarginalTaxRate } from '@/lib/utils/tax-calculations'
import { INCOME_TAX_BRACKETS } from '@/lib/constants/tax-brackets'
import {
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT,
  DEFAULT_INFLATION_RATE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_FILING_STATUS,
  RMD_START_AGE,
} from '@/lib/constants/retirement-defaults'
import { analyzeTaxEfficiency } from './analysis-tab'
import { LoadingState } from '@/components/ui/loading-state'

interface TaxEfficiencyTabProps {
  planId: number
  /** When true, pre-expands the Total Net Savings / Roth conversion details section. */
  initialShowRothDetails?: boolean
}

export default function TaxEfficiencyTab({ planId, initialShowRothDetails }: TaxEfficiencyTabProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [taxEfficiency, setTaxEfficiency] = useState<any>(null)
  const [scenarios, setScenarios] = useState<Array<{ id: number; scenario_name: string; is_default: boolean }>>([])
  const [showRothExplanation, setShowRothExplanation] = useState(false)
  const [showTaxSavingsCalculation, setShowTaxSavingsCalculation] = useState(false)
  const [showTaxInputForm, setShowTaxInputForm] = useState(false)
  const [showInlineBracketEdit, setShowInlineBracketEdit] = useState(false)
  const [inlineBracketInput, setInlineBracketInput] = useState<string>('')
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [currentGrossIncome, setCurrentGrossIncome] = useState<number | null>(null)
  const [currentTaxBracket, setCurrentTaxBracket] = useState<number | null>(null)
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [savingTaxInfo, setSavingTaxInfo] = useState(false)
  const [currentSettings, setCurrentSettings] = useState<CalculatorSettings | null>(null)
  const [showTaxSummaryDetails, setShowTaxSummaryDetails] = useState(initialShowRothDetails ?? false)
  const [showAdditionalStrategies, setShowAdditionalStrategies] = useState(false)
  const [showTaxAssumptions, setShowTaxAssumptions] = useState(false)
  const [showContributionAnalysis, setShowContributionAnalysis] = useState(true)
  const [contributionAnalysis, setContributionAnalysis] = useState<any>(null)
  const [showRetirementBracketExplanation, setShowRetirementBracketExplanation] = useState(false)

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
    const currentBracket = currentTaxBracket || effectiveTaxRate || DEFAULT_MARGINAL_TAX_RATE
    const filingStatus = settings.filing_status || planData?.filing_status || DEFAULT_FILING_STATUS
    
    // Estimate retirement tax bracket from projections
    // Look at average taxable income in retirement years
    const retirementProjections = projections.filter(p => {
      const age = p.age || 0
      return age >= (settings.retirement_age || DEFAULT_RETIREMENT_AGE) && age < 80 // First 15 years of retirement
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
    const retirementTaxBracket = calculateMarginalTaxRate(avgRetirementTaxableIncome, filingStatus)
    
    // Calculate years until retirement
    const currentYear = settings.current_year || new Date().getFullYear()
    const yearsToRetirement = settings.years_to_retirement || 0
    
    // Calculate tax savings and future tax for legacy fields (kept for compatibility)
    const contributionAmount = 1000
    const traditionalTaxSavings = contributionAmount * currentBracket
    const growthRate = settings.growth_rate_before_retirement || 0.1
    const yearsOfGrowth = Math.max(1, yearsToRetirement)
    const futureValue = contributionAmount * Math.pow(1 + growthRate, yearsOfGrowth)
    const traditionalFutureTax = futureValue * retirementTaxBracket
    const traditionalNetBenefit = traditionalTaxSavings - traditionalFutureTax
    const rothNetBenefit = 0
    
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

    // Annual contribution amounts from accounts
    const traditionalAnnualContrib = accounts
      .filter(acc => {
        const type = (acc.account_type || '').trim().toLowerCase()
        return type === '401k' || type === 'ira' || type === 'traditional ira'
      })
      .reduce((sum, acc) => sum + (acc.annual_contribution || 0), 0)
    const rothAnnualContrib = accounts
      .filter(acc => {
        const type = (acc.account_type || '').trim().toLowerCase()
        return type === 'roth' || type === 'roth ira'
      })
      .reduce((sum, acc) => sum + (acc.annual_contribution || 0), 0)
    const totalAnnualContrib = traditionalAnnualContrib + rothAnnualContrib

    // Per-contribution-dollar tax numbers (for actual contribution if available, else per $1k)
    const basisAmount = totalAnnualContrib > 0 ? totalAnnualContrib : contributionAmount
    const actualTaxSavings = basisAmount * currentBracket
    const actualFutureValue = basisAmount * Math.pow(1 + growthRate, yearsOfGrowth)
    const actualFutureTax = actualFutureValue * retirementTaxBracket
    const actualNetBenefit = actualTaxSavings - actualFutureTax

    // ── Apples-to-apples: same gross income, using basisAmount throughout ──
    // Traditional: full basisAmount enters pre-tax → grows → taxed at retirement
    // Roth: pay currentBracket% tax first → only (1-currentBracket)*basisAmount enters → grows tax-free
    const rothAfterTaxContrib = basisAmount * (1 - currentBracket)
    const tradGrowsTo = basisAmount * Math.pow(1 + growthRate, yearsOfGrowth)
    const tradNetAfterRetirementTax = tradGrowsTo * (1 - retirementTaxBracket)
    const rothGrowsTo = rothAfterTaxContrib * Math.pow(1 + growthRate, yearsOfGrowth)
    const rothNetAfterRetirementTax = rothGrowsTo  // tax-free
    const applesNetDiff = tradNetAfterRetirementTax - rothNetAfterRetirementTax

    // Lost opportunity cost: upfront Roth tax, if invested in taxable account instead
    const CAPITAL_GAINS_RATE = 0.15
    const lostOpportunityTaxAmount = basisAmount * currentBracket   // = actualTaxSavings
    const lostOpportunityFutureValue = lostOpportunityTaxAmount * Math.pow(1 + growthRate, yearsOfGrowth)
    const lostOpportunityNetValue = lostOpportunityFutureValue * (1 - CAPITAL_GAINS_RATE)

    // ── Balance-aware analysis: project existing balances to retirement ──
    const RMD_UNIFORM_LIFE_FACTOR_73 = 26.5  // IRS Uniform Lifetime Table, age 73
    const projTradAtRetirement = traditionalBalance * Math.pow(1 + growthRate, yearsOfGrowth)
    const projRothAtRetirement = rothBalance * Math.pow(1 + growthRate, yearsOfGrowth)
    const projTotalAtRetirement = projTradAtRetirement + projRothAtRetirement

    // Estimated first-year RMD from existing traditional balance only
    const estimatedFirstRMD = projTradAtRetirement / RMD_UNIFORM_LIFE_FACTOR_73

    // Would RMD alone push retirement taxable income into a higher bracket?
    const annualExpenses = settings.annual_retirement_expenses || 0
    const rmdCoverageRatio = annualExpenses > 0 ? estimatedFirstRMD / annualExpenses : 0
    const rmdExceedsNeeds = estimatedFirstRMD > annualExpenses
    const projTradTaxBracketWithRMD = calculateMarginalTaxRate(estimatedFirstRMD, filingStatus)
    const rmdPushesHigherBracket = projTradTaxBracketWithRMD > retirementTaxBracket

    // Heir tax: traditional inherited as ordinary income; Roth tax-free to heirs.
    // Under the SECURE Act (2019), most non-spouse beneficiaries must withdraw inherited
    // traditional IRAs within 10 years.  For substantial balances, concentrating years of
    // accrued growth into a 10-year window routinely pushes heirs into the 24–32% brackets.
    // Using 28% (rather than the current contributor's marginal rate) avoids the mathematical
    // artifact where legacy is identical across all splits whenever the contributor's bracket
    // happens to equal the heir rate — a misleading but technically correct result.
    const HEIR_TAX_RATE = 0.28
    const heirTaxOnTrad = projTradAtRetirement * HEIR_TAX_RATE
    const heirTaxOnRoth = 0
    const heirTaxDifference = heirTaxOnTrad - heirTaxOnRoth

    // Balance skew
    const existingTradPct = totalBalance > 0 ? (traditionalBalance / totalBalance) * 100 : 50
    const balanceSkewedTrad = totalBalance > 0 && existingTradPct > 70
    const balanceSkewedRoth = totalBalance > 0 && existingTradPct < 30

    // Refine recommendation and split based on balance analysis
    if (balanceSkewedTrad && recommendation !== 'Roth') {
      // Heavy traditional skew — nudge toward Roth regardless of bracket math
      if (recommendation === 'Traditional') {
        recommendation = 'Both'
        recommendationText += ` However, your existing accounts are ${Math.round(existingTradPct)}% traditional — adding more traditional increases future RMD exposure. Consider splitting to reduce that risk.`
        traditionalSplit = 40
        rothSplit = 60
      } else {
        // Already 'Both' — tilt Roth further
        traditionalSplit = 30
        rothSplit = 70
        recommendationText += ` Your existing ${Math.round(existingTradPct)}% traditional skew makes additional Roth contributions especially valuable for RMD management.`
      }
    } else if (balanceSkewedRoth && recommendation !== 'Traditional') {
      if (recommendation === 'Roth') {
        recommendation = 'Both'
        recommendationText += ` Your existing accounts are ${Math.round(100 - existingTradPct)}% Roth — some traditional contributions now would add tax diversification and immediate deductions.`
        traditionalSplit = 60
        rothSplit = 40
      }
    }

    if (totalBalance > 0) {
      if (balanceSkewedTrad) {
        considerations.push(`Your existing ${Math.round(existingTradPct)}% traditional allocation means every new traditional dollar adds to future RMD obligations — Roth contributions help balance this.`)
      } else if (balanceSkewedRoth) {
        considerations.push(`Your existing accounts are ${Math.round(100 - existingTradPct)}% Roth — traditional contributions would add immediate tax deductions and diversify your tax exposure.`)
      }
    }
    if (rmdExceedsNeeds) {
      considerations.push(`Estimated RMD at 73 (~$${Math.round(estimatedFirstRMD).toLocaleString()}/yr) would exceed your projected expenses ($${annualExpenses.toLocaleString()}/yr) — forced withdrawals at the margin could push you into a higher bracket.`)
    }
    if (rmdPushesHigherBracket) {
      considerations.push(`RMD income alone may push you into the ${(projTradTaxBracketWithRMD * 100).toFixed(0)}% bracket in retirement — Roth contributions now reduce this risk.`)
    }

    // Age-based considerations
    if (yearsToRetirement > 20) {
      considerations.push('With many years until retirement, Roth contributions benefit from decades of tax-free growth')
    } else if (yearsToRetirement < 10) {
      considerations.push('With retirement approaching, traditional contributions may provide more immediate tax benefits')
    }
    
    // ── Split scenario table: 100/0 → 0/100 in 10% steps ──
    // All values in projected retirement dollars (FV).
    // FVFactor: future value of $1/yr annuity over yearsOfGrowth at growthRate
    const FVFactor = yearsOfGrowth > 0 ? ((Math.pow(1 + growthRate, yearsOfGrowth) - 1) / growthRate) : 1
    const existingTradFV = traditionalBalance * Math.pow(1 + growthRate, yearsOfGrowth)
    const existingRothFV = rothBalance * Math.pow(1 + growthRate, yearsOfGrowth)

    const splitRows = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(tradPctNew => {
      const rothPctNew = 100 - tradPctNew
      const annualTrad = basisAmount * tradPctNew / 100
      const annualRoth = basisAmount * rothPctNew / 100
      // Roth contributions are after-tax: only (1 - currentBracket) of each dollar actually enters the Roth account.
      const annualRothAfterTax = annualRoth * (1 - currentBracket)
      // Projected balances
      const projTrad = existingTradFV + annualTrad * FVFactor
      const projRoth = existingRothFV + annualRothAfterTax * FVFactor
      // Taxes (all in FV retirement dollars)
      const rothUpfrontTaxFV = annualRoth * currentBracket * FVFactor  // what the tax paid today would have grown to
      const retirementTax = projTrad * retirementTaxBracket
      const totalTax = rothUpfrontTaxFV + retirementTax
      // Heir tax & legacy
      const heirTax = projTrad * HEIR_TAX_RATE
      const legacyAfterHeirTax = projTrad * (1 - HEIR_TAX_RATE) + projRoth
      // RMD
      const rmd = projTrad / RMD_UNIFORM_LIFE_FACTOR_73
      return { tradPctNew, rothPctNew, projTrad, projRoth, totalTax, heirTax, legacyAfterHeirTax, rmd }
    })

    const minTotalTax = Math.min(...splitRows.map(r => r.totalTax))
    const maxTotalTax = Math.max(...splitRows.map(r => r.totalTax))
    const maxLegacy = Math.max(...splitRows.map(r => r.legacyAfterHeirTax))
    const minLegacy = Math.min(...splitRows.map(r => r.legacyAfterHeirTax))
    const minHeirTax = Math.min(...splitRows.map(r => r.heirTax))
    const maxHeirTax = Math.max(...splitRows.map(r => r.heirTax))

    // Data-driven suggested split: composite score across all three outcome metrics.
    // Each metric normalized to [0,1], equal weight. Higher = better row.
    // Clamp ranges to at least 1% of the max value so that near-identical columns
    // (e.g. total tax varying by only $200 when all rows show "$640k") don't get
    // their tiny noise amplified into a dominant signal.
    const taxRange = Math.max(maxTotalTax - minTotalTax, maxTotalTax * 0.01) || 1
    const legacyRange = Math.max(maxLegacy - minLegacy, maxLegacy * 0.01) || 1
    const heirRange = Math.max(maxHeirTax - minHeirTax, maxHeirTax * 0.01) || 1
    const scoredRows = splitRows.map(r => ({
      ...r,
      score: (1 - (r.totalTax - minTotalTax) / taxRange)
           + (r.legacyAfterHeirTax - minLegacy) / legacyRange
           + (1 - (r.heirTax - minHeirTax) / heirRange),
    }))
    const bestRow = scoredRows.reduce((a, b) => b.score > a.score ? b : a)
    // Override the bracket-logic split with the data-driven best split
    traditionalSplit = bestRow.tradPctNew
    rothSplit = bestRow.rothPctNew

    // Derive top-level recommendation from the split table outcome, not bracket math.
    // This keeps the banner headline in sync with the highlighted row in the table.
    if (bestRow.tradPctNew === 0) {
      recommendation = 'Roth'
    } else if (bestRow.tradPctNew === 100) {
      recommendation = 'Traditional'
    } else {
      recommendation = 'Both'
    }
    // Build a concise recommendation text grounded in balance/outcome data
    const bestLegacyFmt = bestRow.legacyAfterHeirTax >= 1e6
      ? `$${(bestRow.legacyAfterHeirTax / 1e6).toFixed(2)}M`
      : `$${Math.round(bestRow.legacyAfterHeirTax / 1000)}k`
    const bestHeirFmt = bestRow.heirTax >= 1e6
      ? `$${(bestRow.heirTax / 1e6).toFixed(2)}M`
      : `$${Math.round(bestRow.heirTax / 1000)}k`
    const bestRothPct = bestRow.rothPctNew
    if (totalBalance > 0) {
      recommendationText = bestRothPct === 100
        ? `Based on your ${existingTradPct > 50 ? `${Math.round(existingTradPct)}% traditional-heavy balance` : 'account balances'}, directing all new contributions to Roth produces the best projected outcome: ${bestLegacyFmt} legacy value and ${bestHeirFmt} heir tax burden.`
        : bestRothPct === 0
          ? `Based on your account balances and projected tax rates, all-traditional produces the best outcome: ${bestLegacyFmt} legacy value.`
          : `Based on your account balances and projected outcomes, a ${bestRow.tradPctNew}/${bestRothPct} Traditional/Roth split produces the best composite result: ${bestLegacyFmt} legacy value and ${bestHeirFmt} heir tax burden.`
    } else {
      // No balances — fall back to bracket-only text but note the limitation
      recommendationText = `Your current bracket (${(currentBracket * 100).toFixed(0)}%) ${currentBracket > retirementTaxBracket ? 'exceeds' : 'is below'} your estimated retirement bracket (${(retirementTaxBracket * 100).toFixed(0)}%), suggesting ${recommendation === 'Roth' ? 'Roth' : 'Traditional'} contributions are more tax-efficient on a per-dollar basis.`
    }

    return {
      recommendation,
      filingStatus,
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
      considerations,
      // Actual plan numbers
      traditionalBalance: Math.round(traditionalBalance),
      rothBalance: Math.round(rothBalance),
      totalBalance: Math.round(totalBalance),
      traditionalAnnualContrib: Math.round(traditionalAnnualContrib),
      rothAnnualContrib: Math.round(rothAnnualContrib),
      totalAnnualContrib: Math.round(totalAnnualContrib),
      basisAmount: Math.round(basisAmount),
      actualTaxSavings: Math.round(actualTaxSavings),
      actualFutureValue: Math.round(actualFutureValue),
      actualFutureTax: Math.round(actualFutureTax),
      actualNetBenefit: Math.round(actualNetBenefit),
      yearsOfGrowth,
      // Apples-to-apples (per basisAmount gross income — same basis as cards)
      rothAfterTaxContrib: Math.round(rothAfterTaxContrib),
      tradGrowsTo: Math.round(tradGrowsTo),
      tradNetAfterRetirementTax: Math.round(tradNetAfterRetirementTax),
      rothGrowsTo: Math.round(rothGrowsTo),
      rothNetAfterRetirementTax: Math.round(rothNetAfterRetirementTax),
      applesNetDiff: Math.round(applesNetDiff),
      lostOpportunityTaxAmount: Math.round(lostOpportunityTaxAmount),
      lostOpportunityFutureValue: Math.round(lostOpportunityFutureValue),
      lostOpportunityNetValue: Math.round(lostOpportunityNetValue),
      // Balance-impact analysis
      projTradAtRetirement: Math.round(projTradAtRetirement),
      projRothAtRetirement: Math.round(projRothAtRetirement),
      projTotalAtRetirement: Math.round(projTotalAtRetirement),
      estimatedFirstRMD: Math.round(estimatedFirstRMD),
      rmdCoverageRatio: Math.round(rmdCoverageRatio * 100) / 100,
      rmdExceedsNeeds,
      rmdPushesHigherBracket,
      projTradTaxBracketWithRMD,
      annualExpenses,
      heirTaxOnTrad: Math.round(heirTaxOnTrad),
      heirTaxOnRoth: 0,
      heirTaxDifference: Math.round(heirTaxDifference),
      existingTradPct: Math.round(existingTradPct),
      balanceSkewedTrad,
      balanceSkewedRoth,
      splitRows,
      minTotalTax,
      maxLegacy,
      minHeirTax,
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
      // Load all raw DB rows needed — plan, scenario settings, accounts, expenses, other income
      const [settingsData, projectionsData, accountRows, expenseRows, otherIncomeRows, planData] = await Promise.all([
        supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single(),
        supabase.from('rp_projection_details').select('*').eq('scenario_id', selectedScenarioId).order('year'),
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        supabase.from('rp_retirement_plans')
          .select('birth_year, life_expectancy, filing_status, include_spouse, current_gross_income, current_tax_bracket, spouse_birth_year, spouse_life_expectancy')
          .eq('id', planId).single(),
      ])

      const planRow = planData.data

      // Build all projection inputs using the shared utility so this tab uses
      // exactly the same settings, expense mapping, and SSA params as details-tab.
      const inputs = buildProjectionInputs(
        planRow,
        settingsData.data,
        accountRows.data || [],
        expenseRows.data || [],
        otherIncomeRows.data || [],
      )

      // Persist state that other UI sections (contribution analysis, bracket edit) rely on
      if (planRow?.current_gross_income && !currentGrossIncome) {
        setCurrentGrossIncome(planRow.current_gross_income)
      }
      if (planRow?.current_tax_bracket && !currentTaxBracket) {
        setCurrentTaxBracket(planRow.current_tax_bracket)
      }
      const effectiveTaxRate = currentTaxBracket || planRow?.current_tax_bracket || DEFAULT_MARGINAL_TAX_RATE

      const { baseSettings: settings, accounts, expenses, otherIncome } = inputs
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

      // Pass all simulation inputs (including SSA params) so the Roth conversion total
      // is computed with the exact same inputs as the Strategy Comparison table.
      const calculatedTaxEfficiency = analyzeTaxEfficiency(
        projections, settings, accounts,
        expenses, otherIncome,
        inputs.birthYear, inputs.lifeExpectancy,
        inputs.spouseBirthYear, inputs.spouseLifeExpectancy,
        inputs.includePlannerSsa, inputs.includeSpouseSsa,
        inputs.estimatedPlannerSsaAtStart, inputs.estimatedSpouseSsaAtStart,
      )
      setTaxEfficiency(calculatedTaxEfficiency)

      // Calculate traditional vs Roth contribution analysis
      const contributionAnalysisResult = analyzeContributionStrategy(
        accounts,
        settings,
        projections,
        planRow,
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
    return <LoadingState message="Calculating tax efficiency analysis…" />
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
                <li><strong>Filing Status:</strong> {currentSettings?.filing_status || DEFAULT_FILING_STATUS}</li>
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
                        const calculatedBracket = calculateMarginalTaxRate(income, currentSettings.filing_status || DEFAULT_FILING_STATUS)
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
                        <li><strong>Lower Tax Rates:</strong> You're likely in a lower tax bracket now than you will be when RMDs begin at age {RMD_START_AGE}</li>
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
                        <li><strong>Timing:</strong> Best done between retirement and age {RMD_START_AGE} (RMD age) when income may be lower</li>
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
                              <strong>End Year ({conversionEndYear}):</strong> Concludes the year before Required Minimum Distributions (RMDs) begin at age {RMD_START_AGE}. 
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
                    <p className="text-xs text-gray-500 mb-3">
                      {taxEfficiency.taxesWithRothConversion.simulatedTotal
                        ? 'Totals are from a full cash-flow simulation — identical methodology to the Strategy Comparison table.'
                        : 'Analytical estimate using the same conversion parameters as the Strategy Comparison ($10k/yr cap). Minor differences from the Strategy Comparison total may still occur due to simplified tax modeling vs. full cash-flow simulation.'}
                    </p>
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
                          {/* Show breakdown rows only for analytical estimate (simulation rolls them into the total) */}
                          {!taxEfficiency.taxesWithRothConversion.simulatedTotal && (
                            <>
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
                            </>
                          )}
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
                                <strong>Step 3 - Future Tax Savings:</strong> The converted amount would have been subject to RMDs starting at age {RMD_START_AGE}. 
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
                  <li>Reduce Required Minimum Distributions (RMDs) starting at age {RMD_START_AGE}</li>
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
          
          {showContributionAnalysis && contributionAnalysis && (() => {
            const ca = contributionAnalysis
            const basisLabel = ca.totalAnnualContrib > 0
              ? `your $${ca.basisAmount.toLocaleString()} annual contribution`
              : 'every $1,000 contributed'
            return (
            <div className="space-y-4">

              {/* ── 1. Recommendation banner (driven by split-table outcome) ── */}
              <div className={`p-3 rounded-lg border-2 flex items-center gap-3 ${
                ca.recommendation === 'Roth' ? 'bg-green-50 border-green-300' :
                ca.recommendation === 'Traditional' ? 'bg-blue-50 border-blue-300' :
                'bg-amber-50 border-amber-300'
              }`}>
                <span className="text-xl">{ca.recommendation === 'Both' ? '⚖️' : '✓'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {ca.recommendation === 'Roth' ? 'Prioritize Roth Contributions' :
                     ca.recommendation === 'Traditional' ? 'Prioritize Traditional Contributions' :
                     'Consider Both (Tax Diversification)'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">{ca.recommendationText}</p>
                </div>
              </div>

              {/* ── 2. Split scenario table (primary decision tool) ── */}
              {ca.totalBalance > 0 && (
                <div>
                  {/* Current balances header */}
                  <div className="mb-3 px-1 space-y-1.5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs items-baseline">
                      <span className="text-gray-500 font-medium uppercase tracking-wide mr-1">Balances</span>
                      <span><span className="font-semibold text-blue-700">${ca.traditionalBalance.toLocaleString()}</span> <span className="text-gray-400">traditional ({ca.existingTradPct}%)</span></span>
                      <span className="text-gray-300">·</span>
                      <span><span className="font-semibold text-green-700">${ca.rothBalance.toLocaleString()}</span> <span className="text-gray-400">Roth ({100 - ca.existingTradPct}%)</span></span>
                      {ca.totalAnnualContrib > 0 && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-400">contributing <span className="font-medium text-gray-600">${ca.basisAmount.toLocaleString()}/yr</span></span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs items-baseline">
                      <span className="text-gray-500 font-medium uppercase tracking-wide mr-1">Rates</span>
                      <span><span className="font-semibold text-blue-700">{(ca.currentTaxBracket * 100).toFixed(0)}%</span> <span className="text-gray-400">tax today</span></span>
                      <span className="text-gray-300">·</span>
                      <span><span className="font-semibold text-orange-600">{(ca.retirementTaxBracket * 100).toFixed(0)}%</span> <span className="text-gray-400">est. tax in retirement</span></span>
                      <span className="text-gray-300">·</span>
                      <span><span className="font-semibold text-gray-700">{((currentSettings?.growth_rate_before_retirement ?? 0.1) * 100).toFixed(0)}%</span> <span className="text-gray-400">growth/yr</span></span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    Projected future dollars at retirement ({ca.yearsOfGrowth} yrs) · existing balances included · ★ = best in column
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">New contrib<br/><span className="font-normal text-gray-400">Trad / Roth</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-blue-700">Trad balance</th>
                          <th className="px-3 py-2 text-right font-semibold text-green-700">Roth balance</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Total tax<br/><span className="font-normal text-gray-400">lower ↓</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Legacy value<br/><span className="font-normal text-gray-400">after heir tax</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Heir tax<br/><span className="font-normal text-gray-400">lower ↓</span></th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">RMD/yr<br/><span className="font-normal text-gray-400">at 73</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ca.splitRows.map((row: any) => {
                          const isRecommended = row.tradPctNew === ca.traditionalSplit
                          const bestTax = Math.abs(row.totalTax - ca.minTotalTax) < 1
                          const bestLegacy = Math.abs(row.legacyAfterHeirTax - ca.maxLegacy) < 1
                          const bestHeir = Math.abs(row.heirTax - ca.minHeirTax) < 1
                          const rmdWarning = row.rmd > ca.annualExpenses && ca.annualExpenses > 0
                          const fmt = (n: number) => n >= 1e6
                            ? `$${(n / 1e6).toFixed(2)}M`
                            : `$${Math.round(n / 1000)}k`
                          return (
                            <tr key={row.tradPctNew}
                              className={isRecommended ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}>
                              <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                                {row.tradPctNew}/{row.rothPctNew}
                                {isRecommended && <span className="ml-1.5 text-blue-600 text-xs font-semibold">← suggested</span>}
                              </td>
                              <td className="px-3 py-2 text-right text-blue-700 whitespace-nowrap">{fmt(row.projTrad)}</td>
                              <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{fmt(row.projRoth)}</td>
                              <td className={`px-3 py-2 text-right whitespace-nowrap ${bestTax ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                {fmt(row.totalTax)}{bestTax && <span className="ml-1 text-green-600">★</span>}
                              </td>
                              <td className={`px-3 py-2 text-right whitespace-nowrap ${bestLegacy ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                {fmt(row.legacyAfterHeirTax)}{bestLegacy && <span className="ml-1 text-green-600">★</span>}
                              </td>
                              <td className={`px-3 py-2 text-right whitespace-nowrap ${bestHeir ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                {fmt(row.heirTax)}{bestHeir && <span className="ml-1 text-green-600">★</span>}
                              </td>
                              <td className={`px-3 py-2 text-right whitespace-nowrap ${rmdWarning ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                                {fmt(row.rmd)}{rmdWarning && <span className="ml-1 text-amber-500" title="Exceeds projected expenses">⚠</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span><span className="text-green-600 font-bold">★</span> best value in column</span>
                    <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-300 align-middle mr-1" />suggested split (best composite outcome)</span>
                    <span><span className="text-amber-500">⚠</span> RMD exceeds projected expenses</span>
                    <span>Heir tax estimated at 28% (SECURE Act 10-year rule typically concentrates inherited IRA withdrawals into higher brackets)</span>
                  </div>
                </div>
              )}

              {/* ── 3. Per-dollar tax comparison + bracket analysis (collapsible) ── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowWalkthrough(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-xs font-medium text-gray-700">🔢 Per-dollar tax comparison &amp; bracket analysis</span>
                  <span className="text-gray-400 text-xs">{showWalkthrough ? '▲ hide' : '▼ expand'}</span>
                </button>
                {showWalkthrough && (
                  <div className="p-4 space-y-4 bg-white border-t border-gray-100">

                    {/* Tax bracket dials + edit */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center relative">
                        <p className="text-xs text-gray-500 mb-1">Your tax bracket today</p>
                        <p className="text-3xl font-bold text-blue-700">{(ca.currentTaxBracket * 100).toFixed(0)}%</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {currentTaxBracket ? 'manually set' : currentGrossIncome ? `from $${currentGrossIncome.toLocaleString()} income` : 'default — click ✎ to set'}
                        </p>
                        <button
                          onClick={() => { setInlineBracketInput((ca.currentTaxBracket * 100).toFixed(0)); setShowInlineBracketEdit(v => !v) }}
                          className="absolute top-2 right-2 text-blue-400 hover:text-blue-700 p-0.5 rounded"
                          title="Change tax bracket"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.293-6.293a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414L13 17H9v-4z" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <p className="text-xs text-gray-500">Expected bracket in retirement</p>
                          <button onClick={() => setShowRetirementBracketExplanation(!showRetirementBracketExplanation)} className="text-blue-500 hover:text-blue-700 text-xs font-bold" title="How is this calculated?">?</button>
                        </div>
                        <p className="text-3xl font-bold text-orange-700">{(ca.retirementTaxBracket * 100).toFixed(0)}%</p>
                        <p className="text-xs text-gray-400 mt-1">avg taxable income ~${ca.avgRetirementTaxableIncome.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Bracket picker */}
                    {showInlineBracketEdit && (() => {
                      const filingStatus = (ca.filingStatus || 'Single') as keyof typeof INCOME_TAX_BRACKETS
                      const brackets = INCOME_TAX_BRACKETS[filingStatus] ?? INCOME_TAX_BRACKETS['Single']
                      const selectedPct = parseFloat(inlineBracketInput)
                      return (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-gray-800">2024 Federal Tax Brackets — {filingStatus}</p>
                            <p className="text-xs text-gray-500">Click a row to select</p>
                          </div>
                          <div className="space-y-1 mb-3">
                            {brackets.map(b => {
                              const pct = Math.round(b.rate * 100)
                              const isSelected = selectedPct === pct
                              const rangeLabel = b.max === Infinity ? `over $${(b.min / 1000).toFixed(0)}k` : `$${(b.min / 1000).toFixed(0)}k – $${(b.max / 1000).toFixed(0)}k`
                              return (
                                <button key={pct} onClick={() => setInlineBracketInput(String(pct))}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs border transition-colors text-left ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'}`}>
                                  <span className="font-bold w-8">{pct}%</span>
                                  <span className={`flex-1 mx-3 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>Taxable income {rangeLabel}</span>
                                  {isSelected && <span className="text-white font-medium">✓ selected</span>}
                                </button>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={async () => { const val = parseFloat(inlineBracketInput); if (!isNaN(val) && val > 0 && val <= 50) { setCurrentTaxBracket(val / 100); setShowInlineBracketEdit(false); await supabase.from('rp_retirement_plans').update({ current_tax_bracket: val / 100 }).eq('id', planId); await calculateTaxEfficiencyAnalysis() } }}
                              disabled={!inlineBracketInput} className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                              Apply {inlineBracketInput ? `${inlineBracketInput}%` : ''}
                            </button>
                            <button onClick={() => setShowInlineBracketEdit(false)} className="rounded bg-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-300">Cancel</button>
                            <p className="text-xs text-gray-400 ml-1">Saved to your plan.</p>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Retirement bracket explanation */}
                    {showRetirementBracketExplanation && (
                      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 space-y-2">
                        <p className="font-medium text-gray-900">How the retirement tax bracket is estimated:</p>
                        <ol className="list-decimal list-inside space-y-1 text-xs">
                          <li>Examines retirement projection data for the first 15 years (ages {currentSettings?.retirement_age || DEFAULT_RETIREMENT_AGE}–80) — found <strong>{ca.retirementProjectionsCount} years</strong> of data.</li>
                          <li>Averages your projected <strong>taxable income</strong> across those years: <strong>${ca.avgRetirementTaxableIncome.toLocaleString()}/yr</strong>.</li>
                          <li>Applies 2024 federal brackets for filing status <strong>{ca.filingStatus || DEFAULT_FILING_STATUS}</strong> → <strong>{(ca.retirementTaxBracket * 100).toFixed(0)}% marginal rate</strong>.</li>
                        </ol>
                        <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">State taxes not included. Actual bracket depends on withdrawal strategy, RMD timing, and future tax law.</p>
                        <button onClick={() => setShowRetirementBracketExplanation(false)} className="text-xs text-blue-600 underline">Hide</button>
                      </div>
                    )}

                    {/* Apples-to-apples per-dollar table */}
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-700">
                          Same gross income · what you keep from ${ca.basisAmount.toLocaleString()}
                        </p>
                        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          ca.applesNetDiff > 50 ? 'bg-blue-100 text-blue-800' :
                          ca.applesNetDiff < -50 ? 'bg-green-100 text-green-800' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {ca.applesNetDiff > 50 ? `Traditional +$${ca.applesNetDiff.toLocaleString()} ahead` :
                           ca.applesNetDiff < -50 ? `Roth +$${Math.abs(ca.applesNetDiff).toLocaleString()} ahead` :
                           'Even — diversify'}
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 bg-white">
                            <th className="text-left px-4 py-2 font-medium text-gray-500"></th>
                            <th className="text-right px-4 py-2 font-semibold text-blue-700">Traditional</th>
                            <th className="text-right px-4 py-2 font-semibold text-green-700">Roth</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          <tr className="bg-white">
                            <td className="px-4 py-2 text-gray-600">Gross earnings</td>
                            <td className="px-4 py-2 text-right text-blue-700">${ca.basisAmount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700">${ca.basisAmount.toLocaleString()}</td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-4 py-2 text-gray-600">Tax paid today ({(ca.currentTaxBracket * 100).toFixed(0)}%)</td>
                            <td className="px-4 py-2 text-right text-green-700">$0 — deferred</td>
                            <td className="px-4 py-2 text-right text-red-600">−${ca.lostOpportunityTaxAmount.toLocaleString()}</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-4 py-2 text-gray-600">Enters account</td>
                            <td className="px-4 py-2 text-right text-blue-700">${ca.basisAmount.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700">${ca.rothAfterTaxContrib.toLocaleString()}</td>
                          </tr>
                          <tr className="bg-gray-50">
                            <td className="px-4 py-2 text-gray-600">Grows to (after {ca.yearsOfGrowth} yrs)</td>
                            <td className="px-4 py-2 text-right text-blue-700">${ca.tradGrowsTo.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700">${ca.rothGrowsTo.toLocaleString()}</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-4 py-2 text-gray-600">Retirement tax ({(ca.retirementTaxBracket * 100).toFixed(0)}% / 0%)</td>
                            <td className="px-4 py-2 text-right text-red-600">−${(ca.tradGrowsTo - ca.tradNetAfterRetirementTax).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-green-700">$0</td>
                          </tr>
                          <tr className="bg-gray-50 font-semibold text-sm">
                            <td className="px-4 py-2.5 text-gray-800">You keep</td>
                            <td className={`px-4 py-2.5 text-right ${ca.applesNetDiff >= 0 ? 'text-blue-700' : 'text-gray-600'}`}>${ca.tradNetAfterRetirementTax.toLocaleString()}</td>
                            <td className={`px-4 py-2.5 text-right ${ca.applesNetDiff <= 0 ? 'text-green-700' : 'text-gray-600'}`}>${ca.rothNetAfterRetirementTax.toLocaleString()}</td>
                          </tr>
                          <tr className={`font-bold ${ca.applesNetDiff > 0 ? 'bg-blue-50' : ca.applesNetDiff < 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <td className="px-4 py-2 text-gray-700">Advantage</td>
                            <td className={`px-4 py-2 text-right ${ca.applesNetDiff > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{ca.applesNetDiff > 0 ? `+$${ca.applesNetDiff.toLocaleString()}` : '—'}</td>
                            <td className={`px-4 py-2 text-right ${ca.applesNetDiff < 0 ? 'text-green-700' : 'text-gray-400'}`}>{ca.applesNetDiff < 0 ? `+$${Math.abs(ca.applesNetDiff).toLocaleString()}` : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Step-by-step walkthrough cards */}
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">What happens to {basisLabel}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Traditional */}
                      <div className={`rounded-lg border-2 overflow-hidden ${ca.recommendation === 'Traditional' ? 'border-blue-400' : 'border-gray-200'}`}>
                        <div className="bg-blue-600 px-3 py-2 flex items-center justify-between">
                          <span className="text-white font-semibold text-sm">Traditional (401k / IRA)</span>
                          {ca.recommendation === 'Traditional' && <span className="bg-white text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">Recommended</span>}
                        </div>
                        <div className="p-3 space-y-2 text-sm bg-white">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 border border-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">1</div>
                            <div>
                              <p className="font-medium text-gray-800">Contribute pre-tax</p>
                              <p className="text-xs text-gray-500">Full <span className="font-semibold text-green-700">${ca.basisAmount.toLocaleString()}</span> enters the account — IRS taxes nothing now</p>
                            </div>
                          </div>
                          <div className="flex justify-center text-gray-300 text-xs">↓ grows {ca.yearsOfGrowth} yrs tax-deferred</div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 border border-blue-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-700">2</div>
                            <div>
                              <p className="font-medium text-gray-800"><span className="text-blue-700">${ca.basisAmount.toLocaleString()}</span> → <span className="text-blue-700">${ca.tradGrowsTo.toLocaleString()}</span></p>
                              <p className="text-xs text-gray-500">at {((currentSettings?.growth_rate_before_retirement || 0.1) * 100).toFixed(0)}%/yr (Roth only starts from ${ca.rothAfterTaxContrib.toLocaleString()})</p>
                            </div>
                          </div>
                          <div className="flex justify-center text-gray-300 text-xs">↓ withdraw in retirement</div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-red-100 border border-red-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-700">3</div>
                            <div>
                              <p className="font-medium text-gray-800">Pay {(ca.retirementTaxBracket * 100).toFixed(0)}% tax</p>
                              <p className="text-xs text-gray-500">Tax: <span className="font-semibold text-red-700">${(ca.tradGrowsTo - ca.tradNetAfterRetirementTax).toLocaleString()}</span> · Keep <span className="font-semibold text-blue-700">${ca.tradNetAfterRetirementTax.toLocaleString()}</span> · Subject to RMDs at {RMD_START_AGE}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Roth */}
                      <div className={`rounded-lg border-2 overflow-hidden ${ca.recommendation === 'Roth' ? 'border-green-400' : 'border-gray-200'}`}>
                        <div className="bg-green-600 px-3 py-2 flex items-center justify-between">
                          <span className="text-white font-semibold text-sm">Roth (401k / IRA)</span>
                          {ca.recommendation === 'Roth' && <span className="bg-white text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">Recommended</span>}
                        </div>
                        <div className="p-3 space-y-2 text-sm bg-white">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-red-100 border border-red-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-red-700">1</div>
                            <div>
                              <p className="font-medium text-gray-800">Contribute after-tax</p>
                              <p className="text-xs text-gray-500">IRS takes <span className="font-semibold text-red-700">${ca.lostOpportunityTaxAmount.toLocaleString()}</span> ({(ca.currentTaxBracket * 100).toFixed(0)}%) first — only <span className="font-semibold text-green-700">${ca.rothAfterTaxContrib.toLocaleString()}</span> enters Roth</p>
                            </div>
                          </div>
                          <div className="flex justify-center text-gray-300 text-xs">↓ grows {ca.yearsOfGrowth} yrs tax-free</div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 border border-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">2</div>
                            <div>
                              <p className="font-medium text-gray-800"><span className="text-green-700">${ca.rothAfterTaxContrib.toLocaleString()}</span> → <span className="text-green-700">${ca.rothGrowsTo.toLocaleString()}</span></p>
                              <p className="text-xs text-gray-500">at {((currentSettings?.growth_rate_before_retirement || 0.1) * 100).toFixed(0)}%/yr (Traditional starts from full ${ca.basisAmount.toLocaleString()})</p>
                            </div>
                          </div>
                          <div className="flex justify-center text-gray-300 text-xs">↓ withdraw in retirement</div>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 w-5 h-5 rounded-full bg-green-100 border border-green-400 flex items-center justify-center flex-shrink-0 text-xs font-bold text-green-700">3</div>
                            <div>
                              <p className="font-medium text-gray-800">Withdraw tax-free</p>
                              <p className="text-xs text-gray-500">Keep all <span className="font-semibold text-green-700">${ca.rothGrowsTo.toLocaleString()}</span> · No RMDs required</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Considerations */}
                    {ca.considerations.length > 0 && (
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Additional considerations</p>
                        <div className="space-y-1">
                          {ca.considerations.map((c: string, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xs">•</span>
                              <span className="text-xs text-gray-600">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>
            )
          })()}
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

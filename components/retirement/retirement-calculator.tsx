'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOptionalDataService } from '@/lib/storage'
import {
  Calculator,
  Save,
  Sparkles,
  Check,
  BarChart2,
  Info,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { formatCurrencyShort as fmt } from '@/lib/utils/formatting'
import { MEDICARE_ELIGIBILITY_AGE, SSA_EARLIEST_ELIGIBILITY_AGE } from '@/lib/constants/retirement-defaults'
import { calculateRetirementProjections, type Account, type Expense, type OtherIncome, type CalculatorSettings } from '@/lib/utils/retirement-projections'
import { DEBOUNCE_SAVE_MS, SAVED_INDICATOR_MS } from '@/lib/constants/timing'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'
import { DEFAULT_RETIREMENT_ASSUMPTIONS } from '@/lib/types/retirement-assumptions'
import { CalculatorAssumptionsForm } from './calculator-assumptions-form'

function computeResult(a: RetirementAssumptions) {
  const yearsToRetirement = Math.max(0, a.retirementAge - a.age)
  const retirementYears = Math.max(1, a.lifeExpectancy - a.retirementAge)
  const inflRate = a.inflationRate / 100
  const realReturnRate = Math.max(0.001, (a.growthRateDuringRetirement - a.inflationRate) / 100)

  const annualExpenses = a.monthlyExpenses * 12
  const expensesAtRetirement = annualExpenses * Math.pow(1 + inflRate, yearsToRetirement)

  const ssaStartAge = a.includeSsa ? Math.max(SSA_EARLIEST_ELIGIBILITY_AGE, a.ssaStartAge) : a.lifeExpectancy + 1
  const yearsBeforeSsa = Math.max(0, ssaStartAge - a.retirementAge)
  const yearsWithSsa = Math.max(0, a.lifeExpectancy - Math.max(a.retirementAge, ssaStartAge))
  const annualSsa = (a.includeSsa ? a.ssaAnnualBenefit : 0) +
    (a.includeSpouse && a.includeSsa ? a.spouseSsaBenefit : 0)

  const medicareAge = MEDICARE_ELIGIBILITY_AGE
  const yearsPreMedicare = Math.max(0, Math.min(medicareAge, a.lifeExpectancy) - a.retirementAge)
  const yearsPostMedicare = Math.max(0, a.lifeExpectancy - Math.max(a.retirementAge, medicareAge))

  // Year-by-year nest egg calculation to get exact need
  let nestEggNeeded = 0
  let totalHealthcareCost = 0
  let totalPreMedicareCost = 0
  let totalPostMedicareCost = 0
  for (let yr = 0; yr < retirementYears; yr++) {
    const currentAge = a.retirementAge + yr
    const inflationFactor = Math.pow(1 + inflRate, yearsToRetirement + yr)
    const discountFactor = Math.pow(1 + realReturnRate, -(yr + 1))

    // Living expenses (inflated)
    const yearExpenses = annualExpenses * inflationFactor

    // Healthcare premium (inflated)
    const basePremium = currentAge < medicareAge ? a.preMedicareAnnualPremium : a.postMedicareAnnualPremium
    const yearHealthcare = basePremium * Math.pow(1 + inflRate, yr)
    totalHealthcareCost += yearHealthcare
    if (currentAge < medicareAge) totalPreMedicareCost += yearHealthcare
    else totalPostMedicareCost += yearHealthcare

    // SSA income (inflated from its start year)
    let yearSsa = 0
    if (a.includeSsa && currentAge >= ssaStartAge) {
      const ssaYears = currentAge - ssaStartAge
      yearSsa = annualSsa * Math.pow(1 + inflRate, ssaYears)
    }

    const yearNetNeed = Math.max(0, yearExpenses + yearHealthcare - yearSsa)
    nestEggNeeded += yearNetNeed * discountFactor
  }

  // Project savings by retirement (quick calculator model)
  const r = a.growthRatePreRetirement / 100
  const fvSavings = a.currentSavings * Math.pow(1 + r, yearsToRetirement)
  const fvContributions = r > 0
    ? a.annualContribution * ((Math.pow(1 + r, yearsToRetirement) - 1) / r)
    : a.annualContribution * yearsToRetirement
  const projectedNestEggQuick = fvSavings + fvContributions

  // Drive "On track to have" from the same projection engine used by Quick Projections.
  // This keeps the card value aligned with the projection table's retirement-year net worth.
  let projectedNestEggFromProjection = projectedNestEggQuick
  try {
    const currentYear = new Date().getFullYear()
    const birthYear = currentYear - a.age
    const spouseBirthYear = a.includeSpouse ? currentYear - a.spouseAge : undefined

    const accounts: Account[] = [{
      account_name: 'Retirement Savings',
      owner: 'Planner',
      balance: a.currentSavings,
      account_type: '401k',
      annual_contribution: a.annualContribution,
    }]

    const expenses: Expense[] = [{
      expense_name: 'Living Expenses',
      amount_before_65: a.monthlyExpenses,
      amount_after_65: a.monthlyExpenses,
    }]

    const otherIncome: OtherIncome[] = []
    const settings: CalculatorSettings = {
      current_year: currentYear,
      retirement_age: a.retirementAge,
      retirement_start_year: currentYear + yearsToRetirement,
      years_to_retirement: yearsToRetirement,
      annual_retirement_expenses: annualExpenses,
      growth_rate_before_retirement: a.growthRatePreRetirement / 100,
      growth_rate_during_retirement: a.growthRateDuringRetirement / 100,
      inflation_rate: inflRate,
      ssa_start_age: a.ssaStartAge,
      pre_medicare_annual_premium: a.preMedicareAnnualPremium,
      post_medicare_annual_premium: a.postMedicareAnnualPremium,
      enable_borrowing: false,
    }

    const projections = calculateRetirementProjections(
      birthYear,
      accounts,
      expenses,
      otherIncome,
      settings,
      a.lifeExpectancy,
      spouseBirthYear,
      a.includeSpouse ? a.lifeExpectancy : undefined,
      a.includeSsa,
      a.includeSsa && a.includeSpouse,
      a.includeSsa ? a.ssaAnnualBenefit : undefined,
      (a.includeSsa && a.includeSpouse) ? a.spouseSsaBenefit : undefined,
    )

    const retirementProjection = projections.find((p) => p.age === a.retirementAge) ?? projections.find((p) => (p.age ?? 0) >= a.retirementAge)
    projectedNestEggFromProjection = retirementProjection?.networth ?? projectedNestEggQuick
  } catch {
    // Keep quick-calculator value as fallback if projection engine fails.
    projectedNestEggFromProjection = projectedNestEggQuick
  }

  const surplus = projectedNestEggFromProjection - nestEggNeeded
  const onTrack = surplus >= 0

  // Simulate how many years the projected nest egg would last
  let yearsLast = 0
  let balance = projectedNestEggQuick
  for (let yr = 0; yr < retirementYears + 20; yr++) {
    const currentAge = a.retirementAge + yr
    const inflationFactor = Math.pow(1 + inflRate, yearsToRetirement + yr)

    const yearExpenses = annualExpenses * inflationFactor
    const basePremium = currentAge < medicareAge ? a.preMedicareAnnualPremium : a.postMedicareAnnualPremium
    const yearHealthcare = basePremium * Math.pow(1 + inflRate, yr)

    let yearSsa = 0
    if (a.includeSsa && currentAge >= ssaStartAge) {
      const ssaYears = currentAge - ssaStartAge
      yearSsa = annualSsa * Math.pow(1 + inflRate, ssaYears)
    }

    const yearNetNeed = Math.max(0, yearExpenses + yearHealthcare - yearSsa)
    balance = balance * (1 + realReturnRate) - yearNetNeed
    if (balance > 0) yearsLast++
    else break
  }
  if (balance > 0) yearsLast = retirementYears + 20

  // Monthly shortfall/surplus
  const monthlyAdjustment = yearsToRetirement > 0 && r > 0
    ? Math.abs(surplus) / ((Math.pow(1 + r, yearsToRetirement) - 1) / r) / 12
    : yearsToRetirement > 0 ? Math.abs(surplus) / yearsToRetirement / 12 : 0

  // Average annual gap at retirement (for display)
  const annualGapAtRetirement = Math.max(0, expensesAtRetirement +
    (a.retirementAge < medicareAge ? a.preMedicareAnnualPremium : a.postMedicareAnnualPremium) -
    (a.retirementAge >= ssaStartAge ? annualSsa : 0))

  return {
    nestEggNeeded: Math.round(nestEggNeeded),
    projectedNestEgg: Math.round(projectedNestEggQuick),
    projectedNestEggFromProjection: Math.round(projectedNestEggFromProjection),
    surplus: Math.round(surplus),
    onTrack,
    yearsLast: Math.min(yearsLast, retirementYears),
    retirementYears,
    expensesAtRetirement: Math.round(expensesAtRetirement),
    annualGap: Math.round(annualGapAtRetirement),
    annualSsa: Math.round(annualSsa),
    yearsToRetirement,
    monthlyAdjustment: Math.round(monthlyAdjustment),
    ssaStartAge,
    yearsBeforeSsa,
    yearsWithSsa,
    yearsPreMedicare,
    yearsPostMedicare,
    totalHealthcareCost: Math.round(totalHealthcareCost),
    totalPreMedicareCost: Math.round(totalPreMedicareCost),
    totalPostMedicareCost: Math.round(totalPostMedicareCost),
  }
}

interface RetirementCalculatorProps {
  onCalculateProjections?: () => void
  /** When true, projections are currently displayed — Update should also refresh them. */
  projectionsVisible?: boolean
}

export default function RetirementCalculator({ onCalculateProjections, projectionsVisible = false }: RetirementCalculatorProps) {
  const router = useRouter()
  const supabase = createClient()
  const dataService = useOptionalDataService()
  const isLocal = dataService?.mode === 'local'
  const [assumptions, setAssumptions] = useState<RetirementAssumptions>(DEFAULT_RETIREMENT_ASSUMPTIONS)
  const [saving, setSaving] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [loadedFromDb, setLoadedFromDb] = useState(false)
  const [formExpanded, setFormExpanded] = useState(false)
  const [resultStale, setResultStale] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Debounced result — only recompute hero numbers after the user stops typing (500 ms).
  // This prevents rapid re-renders that shift card height and scroll position mid-edit.
  const [result, setResult] = useState(() => computeResult(assumptions))
  const cardRef = useRef<HTMLDivElement>(null)

  const recalculate = useCallback(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current)
    setResult(computeResult(assumptions))
    setResultStale(false)
  }, [assumptions])

  // Load persisted assumptions on mount
  useEffect(() => {
    const load = async () => {
      if (dataService) {
        const saved = await dataService.getCalculatorDefaults()
        if (saved && Object.keys(saved).length > 0) {
          setAssumptions(prev => ({ ...prev, ...saved } as RetirementAssumptions))
          setLoadedFromDb(true)
        }
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('rp_calculator_defaults')
        .select('*')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setAssumptions({
          age: data.age,
          retirementAge: data.retirement_age,
          lifeExpectancy: data.life_expectancy,
          currentSavings: data.current_savings,
          annualContribution: data.annual_contribution,
          monthlyExpenses: data.monthly_expenses,
          growthRatePreRetirement: data.growth_rate_pre_retirement,
          growthRateDuringRetirement: data.growth_rate_during_retirement,
          inflationRate: data.inflation_rate,
          includeSsa: data.include_ssa,
          ssaStartAge: data.ssa_start_age ?? DEFAULT_RETIREMENT_ASSUMPTIONS.ssaStartAge,
          ssaAnnualBenefit: data.ssa_annual_benefit,
          includeSpouse: data.include_spouse,
          spouseAge: data.spouse_age,
          spouseSsaBenefit: data.spouse_ssa_benefit,
          preMedicareAnnualPremium: data.pre_medicare_annual_premium ?? DEFAULT_RETIREMENT_ASSUMPTIONS.preMedicareAnnualPremium,
          postMedicareAnnualPremium: data.post_medicare_annual_premium ?? DEFAULT_RETIREMENT_ASSUMPTIONS.postMedicareAnnualPremium,
        })
        setLoadedFromDb(true)
      }
    }
    load()
  }, [dataService])

  // Auto-save debounced whenever assumptions change (after initial load)
  const persistAssumptions = useCallback(async (a: RetirementAssumptions) => {
    if (dataService) {
      setSaving(true)
      await dataService.saveCalculatorDefaults(a)
      setSaving(false)
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), SAVED_INDICATOR_MS)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase.from('rp_calculator_defaults').upsert({
      user_id: user.id,
      age: a.age,
      retirement_age: a.retirementAge,
      life_expectancy: a.lifeExpectancy,
      current_savings: a.currentSavings,
      annual_contribution: a.annualContribution,
      monthly_expenses: a.monthlyExpenses,
      growth_rate_pre_retirement: a.growthRatePreRetirement,
      growth_rate_during_retirement: a.growthRateDuringRetirement,
      inflation_rate: a.inflationRate,
      include_ssa: a.includeSsa,
      ssa_start_age: a.ssaStartAge,
      ssa_annual_benefit: a.ssaAnnualBenefit,
      include_spouse: a.includeSpouse,
      spouse_age: a.spouseAge,
      spouse_ssa_benefit: a.spouseSsaBenefit,
      pre_medicare_annual_premium: a.preMedicareAnnualPremium,
      post_medicare_annual_premium: a.postMedicareAnnualPremium,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSaving(false)
    setAutoSaved(true)
    setTimeout(() => setAutoSaved(false), SAVED_INDICATOR_MS)
  }, [dataService])

  const update = useCallback(
    <K extends keyof RetirementAssumptions>(key: K, value: RetirementAssumptions[K]) => {
      setAssumptions((prev) => {
        const next = { ...prev, [key]: value }
        // Debounce auto-save
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => persistAssumptions(next), DEBOUNCE_SAVE_MS)
        return next
      })
    },
    [persistAssumptions]
  )

  // Full update: persist, recalc hero, refresh projections if visible
  const handleUpdate = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await persistAssumptions(assumptions)
    if (calcTimer.current) clearTimeout(calcTimer.current)
    setResult(computeResult(assumptions))
    setResultStale(false)
    if (projectionsVisible && onCalculateProjections) {
      onCalculateProjections()
    }
  }, [assumptions, persistAssumptions, projectionsVisible, onCalculateProjections])

  // Debounce hero recalculation — fires 500 ms after the user stops changing values.
  // While the form is expanded, skip the update (hero is off-screen) and mark stale instead.
  // When the form closes, immediately recalculate so the hero is fresh.
  useEffect(() => {
    if (formExpanded) {
      if (calcTimer.current) clearTimeout(calcTimer.current)
      setResultStale(true)
      return
    }
    if (calcTimer.current) clearTimeout(calcTimer.current)
    calcTimer.current = setTimeout(() => {
      setResult(computeResult(assumptions))
      setResultStale(false)
    }, 500)
    return () => { if (calcTimer.current) clearTimeout(calcTimer.current) }
  }, [assumptions, formExpanded])

  const handleResetToDefaults = async () => {
    setAssumptions(DEFAULT_RETIREMENT_ASSUMPTIONS)
    await persistAssumptions(DEFAULT_RETIREMENT_ASSUMPTIONS)
    toast.success('Reset to default assumptions and saved.')
  }

  const handleSaveAsPlan = async () => {
    if (isLocal) {
      toast('Create a free account to save plans, run projections, and unlock all features.', {
        action: { label: 'Sign Up', onClick: () => router.push('/login?signup=1') },
      })
      return
    }
    setSavingPlan(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const currentYear = new Date().getFullYear()
      const birthYear = currentYear - assumptions.age

      // 1. Create the plan
      const { data: plan, error: planError } = await supabase
        .from('rp_retirement_plans')
        .insert([{
          plan_name: `Retirement Plan (${assumptions.retirementAge})`,
          user_id: user.id,
          birth_year: birthYear,
          filing_status: assumptions.includeSpouse ? 'Married Filing Jointly' : 'Single',
          life_expectancy: assumptions.lifeExpectancy,
          include_spouse: assumptions.includeSpouse,
          spouse_birth_year: assumptions.includeSpouse ? currentYear - assumptions.spouseAge : null,
          spouse_life_expectancy: assumptions.includeSpouse ? assumptions.lifeExpectancy : null,
        }])
        .select()
        .single()

      if (planError || !plan) throw planError || new Error('Failed to create plan')

      // 2. Create a default account representing total savings
      await supabase.from('rp_accounts').insert([{
        plan_id: plan.id,
        account_name: 'Retirement Savings',
        owner: 'Planner',
        balance: assumptions.currentSavings,
        account_type: '401k',
        annual_contribution: assumptions.annualContribution,
      }])

      // 3. Create expense entry
      const monthlyExp = assumptions.monthlyExpenses
      await supabase.from('rp_expenses').insert([{
        plan_id: plan.id,
        expense_name: 'Living Expenses',
        amount_before_65: monthlyExp,
        amount_after_65: monthlyExp,
      }])

      // 4. Create a default scenario
      const { data: scenario, error: scenError } = await supabase
        .from('rp_scenarios')
        .insert([{
          plan_id: plan.id,
          scenario_name: 'Base Scenario',
          is_default: true,
        }])
        .select()
        .single()

      if (scenError || !scenario) throw scenError || new Error('Failed to create scenario')

      // 5. Create calculator settings for the scenario (include healthcare and SSA dollars so plan shows same values)
      const yearsToRetirement = Math.max(0, assumptions.retirementAge - assumptions.age)
      await supabase.from('rp_calculator_settings').insert([{
        scenario_id: scenario.id,
        plan_id: plan.id,
        current_year: currentYear,
        retirement_age: assumptions.retirementAge,
        retirement_start_year: currentYear + yearsToRetirement,
        years_to_retirement: yearsToRetirement,
        annual_retirement_expenses: assumptions.monthlyExpenses * 12,
        growth_rate_before_retirement: assumptions.growthRatePreRetirement / 100,
        growth_rate_during_retirement: assumptions.growthRateDuringRetirement / 100,
        inflation_rate: assumptions.inflationRate / 100,
        planner_ssa_income: assumptions.includeSsa,
        spouse_ssa_income: assumptions.includeSpouse && assumptions.includeSsa,
        ssa_start_age: assumptions.ssaStartAge,
        planner_ssa_annual_benefit: assumptions.ssaAnnualBenefit,
        spouse_ssa_annual_benefit: assumptions.spouseSsaBenefit,
        pre_medicare_annual_premium: assumptions.preMedicareAnnualPremium,
        post_medicare_annual_premium: assumptions.postMedicareAnnualPremium,
        enable_borrowing: false,
      }])

      // Run projections and save plan metrics on the server so Saved Retirement Plans table shows all values
      const runRes = await fetch(`/apps/retirement/plans/${plan.id}/run-projections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenario.id,
          lifeExpectancy: plan.life_expectancy ?? assumptions.lifeExpectancy,
        }),
      })
      if (!runRes.ok) {
        const err = await runRes.json().catch(() => ({}))
        throw new Error(err?.error || runRes.statusText || 'Failed to run projections')
      }

      toast.success('Plan created! Redirecting…')
      router.push(`/apps/retirement/plans/${plan.id}?tab=quick-analysis`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save plan')
    } finally {
      setSavingPlan(false)
    }
  }

  const statusColor = result.onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
  const statusBg = result.onTrack ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30'
  const statusBorder = result.onTrack ? 'border-emerald-200 dark:border-emerald-800' : 'border-amber-200 dark:border-amber-800'
  const [showHowCalculated, setShowHowCalculated] = useState(false)

  // Returns the Fidelity 401(k) avg balance benchmark label for a given age
  function savingsBenchmarkForAge(age: number): { range: string; avg: string } {
    if (age < 30) return { range: '25–29', avg: '$24,000' }
    if (age < 35) return { range: '30–34', avg: '$45,700' }
    if (age < 40) return { range: '35–39', avg: '$73,200' }
    if (age < 45) return { range: '40–44', avg: '$109,100' }
    if (age < 50) return { range: '45–49', avg: '$152,100' }
    if (age < 55) return { range: '50–54', avg: '$199,900' }
    if (age < 60) return { range: '55–59', avg: '$244,900' }
    return { range: '60–64', avg: '$246,500' }
  }

  // Returns the BLS CE Survey avg monthly spending benchmark for a given age
  function expensesBenchmarkForAge(age: number): { range: string; monthly: string; annual: string } {
    if (age < 35) return { range: '25–34', monthly: '~$5,700/mo', annual: '~$68k/yr' }
    if (age < 45) return { range: '35–44', monthly: '~$7,200/mo', annual: '~$86k/yr' }
    if (age < 55) return { range: '45–54', monthly: '~$7,600/mo', annual: '~$91k/yr' }
    if (age < 65) return { range: '55–64', monthly: '~$6,500/mo', annual: '~$78k/yr' }
    return { range: '65+', monthly: '~$4,800/mo', annual: '~$58k/yr' }
  }

  return (
    <div ref={cardRef} className="rounded-xl border bg-card overflow-hidden">
      {/* Hero answer */}
      <div className={`px-6 py-6 ${statusBg} border-b ${statusBorder}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">How much do I need to retire?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quick calculation based on {loadedFromDb ? 'your saved assumptions below' : 'default assumptions below'}. Figures are in today&apos;s dollars, but are adjusted for inflation in calculations.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saving && (
              <span className="text-[11px] text-muted-foreground animate-pulse">Saving…</span>
            )}
            {autoSaved && !saving && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />Saved
              </span>
            )}
            <Badge variant="outline" className={`${statusColor} border-current text-xs`}>
              {result.onTrack ? 'On track' : 'Needs attention'}
            </Badge>
          </div>
        </div>

        {/* Answer */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-8">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">You need approximately</p>
            <p className={`text-3xl sm:text-4xl font-bold tracking-tight ${statusColor}`}>
              {fmt(result.nestEggNeeded)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              saved by age {assumptions.retirementAge} to fund retirement through age {assumptions.lifeExpectancy}
            </p>
            {/* How is this calculated / Update — visible next to the amount */}
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setShowHowCalculated((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showHowCalculated ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                How is this calculated?
              </button>
              {resultStale && (
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                  title="Assumptions changed — tap to update"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Update
                </button>
              )}
            </div>
            {showHowCalculated && (
                <div className="mt-2 rounded-lg bg-background/80 border border-border/60 p-3 space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
                  <p>
                    <span className="opacity-70">1.</span>{' '}
                    Your monthly living expenses ({fmt(assumptions.monthlyExpenses)}/mo = {fmt(assumptions.monthlyExpenses * 12)}/yr, excluding healthcare) are
                    grown by {assumptions.inflationRate}% inflation over {result.yearsToRetirement} years
                    to <strong className="text-foreground">{fmt(result.expensesAtRetirement)}/yr</strong> at retirement.
                  </p>
                  <p>
                    <span className="opacity-70">2.</span>{' '}
                    Healthcare premiums are added:{' '}
                    {result.yearsPreMedicare > 0 && (
                      <><strong className="text-foreground">{fmt(assumptions.preMedicareAnnualPremium)}/yr</strong> pre-Medicare (ages {assumptions.retirementAge}–{Math.min(assumptions.retirementAge + result.yearsPreMedicare, MEDICARE_ELIGIBILITY_AGE) - 1}){result.yearsPostMedicare > 0 ? ', then ' : ''}</>
                    )}
                    {result.yearsPostMedicare > 0 && (
                      <><strong className="text-foreground">{fmt(assumptions.postMedicareAnnualPremium)}/yr</strong> after Medicare ({MEDICARE_ELIGIBILITY_AGE}+)</>
                    )}
                    . Total healthcare: <strong className="text-foreground">{fmt(result.totalHealthcareCost)}</strong> over retirement.
                  </p>
                  <p>
                    <span className="opacity-70">3.</span>{' '}
                    {assumptions.includeSsa ? (
                      assumptions.retirementAge < result.ssaStartAge ? (
                        <>Social Security ({fmt(result.annualSsa)}/yr) begins at age <strong className="text-foreground">{result.ssaStartAge}</strong> — you&apos;ll have <strong className="text-foreground">{result.yearsBeforeSsa} years without SSA income</strong> (ages {assumptions.retirementAge}–{result.ssaStartAge - 1}) where expenses must be fully self-funded.</>
                      ) : (
                        <>Social Security ({fmt(result.annualSsa)}/yr) starts immediately at retirement, offsetting expenses each year.</>
                      )
                    ) : (
                      <>Social Security is not included — all retirement expenses must be self-funded.</>
                    )}
                  </p>
                  <p>
                    <span className="opacity-70">4.</span>{' '}
                    A year-by-year simulation calculates the present value of the net annual shortfall
                    (expenses + healthcare − SSA) over {result.retirementYears} years, using a{' '}
                    <strong className="text-foreground">{(assumptions.growthRateDuringRetirement - assumptions.inflationRate).toFixed(1)}% real return</strong>{' '}
                    ({assumptions.growthRateDuringRetirement}% growth − {assumptions.inflationRate}% inflation).
                  </p>
                  <p>
                    <span className="opacity-70">5.</span>{' '}
                    Your current savings ({fmt(assumptions.currentSavings)}) plus annual contributions ({fmt(assumptions.annualContribution)}/yr)
                    grow at {assumptions.growthRatePreRetirement}% for {result.yearsToRetirement} years,
                    projecting to <strong className="text-foreground">{fmt(result.projectedNestEgg)}</strong> by retirement.
                  </p>
                  <p className="pt-1.5 mt-1.5 border-t border-border">
                    {result.onTrack
                      ? <>You are projected to have a <strong className="text-emerald-600 dark:text-emerald-400">surplus of {fmt(result.surplus)}</strong>.</>
                      : <>You have a projected <strong className="text-amber-600 dark:text-amber-400">shortfall of {fmt(Math.abs(result.surplus))}</strong>. Save an extra {fmt(result.monthlyAdjustment)}/mo to close the gap.</>
                    }
                  </p>
                </div>
              )}
            </div>
          <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">On track to have</p>
              <p className="font-semibold">{fmt(result.projectedNestEggFromProjection)}</p>
            </div>
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{result.onTrack ? 'Surplus' : 'Gap'}</p>
              <p className={`font-semibold ${statusColor}`}>
                {result.onTrack ? '+' : '-'}{fmt(Math.abs(result.surplus))}
              </p>
            </div>
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Money lasts</p>
              <p className="font-semibold">
                {result.yearsLast >= result.retirementYears ? `${result.retirementYears}+ yrs` : `${result.yearsLast} yrs`}
              </p>
            </div>
          </div>
        </div>

        {/* Action hint if not on track */}
        {!result.onTrack && result.yearsToRetirement > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2.5 text-sm">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-muted-foreground">
              Save an extra <strong className="text-foreground">{fmt(result.monthlyAdjustment)}/mo</strong> to close the gap, or adjust your assumptions below.
            </span>
          </div>
        )}
      </div>

      {/* Key assumptions strip */}
      <div className="px-6 py-3 border-b bg-muted/20">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span>Age <strong className="text-foreground">{assumptions.age}</strong></span>
          <span>Retire at <strong className="text-foreground">{assumptions.retirementAge}</strong></span>
          <span className="inline-flex items-center gap-1">
            Saved <strong className="text-foreground">{fmt(assumptions.currentSavings)}</strong>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="Savings benchmark info">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                <p className="font-semibold mb-1">Savings benchmark (your age: {assumptions.age})</p>
                <p>Avg 401(k) balance ages {savingsBenchmarkForAge(assumptions.age).range}: <span className="font-medium">{savingsBenchmarkForAge(assumptions.age).avg}</span> (Fidelity Q4 2024).</p>
                <p className="mt-2 text-xs border-t border-background/20 pt-2">Fidelity rule of thumb: 1× salary by 30 · 3× by 40 · 6× by 50 · 8× by 60 · 10× by 67.</p>
                <p className="mt-1 text-background/80 text-xs">These are 401(k)-only averages. Total savings including IRAs, brokerage accounts, etc. are typically higher. Your target depends on your income and lifestyle goals.</p>
              </TooltipContent>
            </Tooltip>
          </span>
          <span>Contributing <strong className="text-foreground">{fmt(assumptions.annualContribution)}/yr</strong></span>
          <span className="inline-flex items-center gap-1">
            Living Expenses <strong className="text-foreground">{fmt(assumptions.monthlyExpenses * 12)}/yr</strong>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="Living expenses benchmark info">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                <p className="font-semibold mb-1">Spending benchmark (your age: {assumptions.age})</p>
                <p>Avg household spending ages {expensesBenchmarkForAge(assumptions.age).range}: <span className="font-medium">{expensesBenchmarkForAge(assumptions.age).monthly}</span> ({expensesBenchmarkForAge(assumptions.age).annual}) (BLS Consumer Expenditure Survey).</p>
                <p className="mt-2 text-xs border-t border-background/20 pt-2">Does not include healthcare premiums, which are tracked separately in this calculator.</p>
                <p className="mt-1 text-background/80 text-xs">National averages include housing costs. Your number may differ based on location, household size, and lifestyle.</p>
              </TooltipContent>
            </Tooltip>
          </span>
          {assumptions.includeSsa && (
            <span className="inline-flex items-center gap-1">
              SSA <strong className="text-foreground">{fmt(assumptions.ssaAnnualBenefit)}/yr at {assumptions.ssaStartAge}</strong>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="SSA benchmark info">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                  <p className="font-semibold mb-1">SSA benchmark defaults</p>
                  <p>Your SSA: <span className="font-medium">$23,100/yr</span> — avg retired worker $1,924/mo (SSA Monthly Snapshot, Oct 2024).</p>
                  <p className="mt-1">Spouse SSA: <span className="font-medium">$20,500/yr</span> — avg women retired worker ~$1,714/mo (SSA Statistical Supplement 2024).</p>
                  <p className="mt-1">Benefits grow at <span className="font-medium">2.5%/yr COLA</span> (SSA 2025 cost-of-living adjustment).</p>
                </TooltipContent>
              </Tooltip>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            Healthcare <strong className="text-foreground">{fmt(assumptions.preMedicareAnnualPremium)}/yr → {fmt(assumptions.postMedicareAnnualPremium)}/yr</strong>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors" aria-label="Healthcare benchmark info">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                <p className="font-semibold mb-1">Healthcare benchmark defaults (premiums only)</p>
                <p>Pre-Medicare: <span className="font-medium">$20,400/yr</span> — ACA benchmark silver plan, unsubsidized age 60 (CMS/KFF 2024).</p>
                <p className="mt-1">Post-Medicare: <span className="font-medium">$4,500/yr</span> — Part B ($185/mo) + Medigap Plan G avg (~$192/mo) (CMS 2025).</p>
                <p className="mt-1">Premiums grow at <span className="font-medium">5%/yr</span> (KFF 2024 Employer Health Benefits Survey).</p>
                <p className="mt-2 border-t border-background/20 pt-2 text-background/80">Premiums only. Out-of-pocket costs (co-pays, deductibles, dental, vision) should be in monthly living expenses. Premiums inflate faster (~5%/yr) than general expenses (~3%) and drop at 65 when Medicare kicks in — keeping them separate models this accurately.</p>
              </TooltipContent>
            </Tooltip>
          </span>
          <span>Growth <strong className="text-foreground">{assumptions.growthRatePreRetirement}%→{assumptions.growthRateDuringRetirement}%</strong></span>
          <span>Inflation <strong className="text-foreground">{assumptions.inflationRate}%</strong></span>
        </div>
      </div>

      <div className="px-6">
        <CalculatorAssumptionsForm
          value={assumptions}
          onChange={(next) => {
            setAssumptions(next)
            if (saveTimer.current) clearTimeout(saveTimer.current)
            saveTimer.current = setTimeout(() => persistAssumptions(next), DEBOUNCE_SAVE_MS)
          }}
          expanded={formExpanded}
          onExpandedChange={(open) => {
            setFormExpanded(open)
            if (open) {
              setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }, 0)
            }
          }}
          result={{
            annualSsa: result.annualSsa,
            expensesAtRetirement: result.expensesAtRetirement,
            yearsPreMedicare: result.yearsPreMedicare,
            ssaStartAge: result.ssaStartAge,
            yearsBeforeSsa: result.yearsBeforeSsa,
            retirementYears: result.retirementYears,
          }}
          onResetToDefaults={handleResetToDefaults}
          resetDisabled={saving}
          hideHowCalculated
          onUpdate={handleUpdate}
          updateLabel={projectionsVisible ? 'Update Calculator & Projections' : 'Update Calculator'}
        />
      </div>

      <Separator />
      {/* Footer actions */}
      <div className="flex items-center justify-between px-6 py-4 gap-3">
        <div className="text-xs text-muted-foreground max-w-md">
          {isLocal && onCalculateProjections
            ? 'Run quick projections with these assumptions, or create a free account for advanced analysis.'
            : 'Save these as a plan to unlock detailed projections, scenario modeling, risk analysis, and more.'}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLocal && onCalculateProjections && (
            <Button onClick={async () => {
              if (saveTimer.current) clearTimeout(saveTimer.current)
              await persistAssumptions(assumptions)
              if (calcTimer.current) clearTimeout(calcTimer.current)
              setResult(computeResult(assumptions))
              setResultStale(false)
              onCalculateProjections()
            }}>
              <BarChart2 className="h-3.5 w-3.5" />
              See Quick Projections
            </Button>
          )}
          <Button size="sm" variant={isLocal && onCalculateProjections ? 'outline' : 'default'} onClick={handleSaveAsPlan} disabled={savingPlan}>
            <Save className="h-3.5 w-3.5" />
            {savingPlan ? 'Creating…' : 'Save as Plan'}
          </Button>
        </div>
      </div>
    </div>
  )
}

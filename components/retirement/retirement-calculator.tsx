'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Save,
  Sparkles,
  DollarSign,
  TrendingUp,
  Clock,
  Shield,
  HeartPulse,
  Info,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  DEFAULT_AGE,
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_CURRENT_SAVINGS,
  DEFAULT_ANNUAL_CONTRIBUTION,
  DEFAULT_MONTHLY_EXPENSES,
  DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  DEFAULT_INFLATION_RATE_PCT,
  DEFAULT_INCLUDE_SSA,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SSA_START_AGE,
  SSA_EARLIEST_ELIGIBILITY_AGE,
  DEFAULT_INCLUDE_SPOUSE,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  MEDICARE_ELIGIBILITY_AGE,
  DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
  DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
} from '@/lib/constants/retirement-defaults'
import { DEBOUNCE_SAVE_MS, SAVED_INDICATOR_MS } from '@/lib/constants/timing'

interface Assumptions {
  age: number
  retirementAge: number
  lifeExpectancy: number
  currentSavings: number
  annualContribution: number
  monthlyExpenses: number
  growthRatePreRetirement: number
  growthRateDuringRetirement: number
  inflationRate: number
  includeSsa: boolean
  ssaStartAge: number
  ssaAnnualBenefit: number
  includeSpouse: boolean
  spouseAge: number
  spouseSsaBenefit: number
  preMedicareAnnualPremium: number
  postMedicareAnnualPremium: number
}

const DEFAULTS: Assumptions = {
  age: DEFAULT_AGE,
  retirementAge: DEFAULT_RETIREMENT_AGE,
  lifeExpectancy: DEFAULT_LIFE_EXPECTANCY,
  currentSavings: DEFAULT_CURRENT_SAVINGS,
  annualContribution: DEFAULT_ANNUAL_CONTRIBUTION,
  monthlyExpenses: DEFAULT_MONTHLY_EXPENSES,
  growthRatePreRetirement: DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT,
  growthRateDuringRetirement: DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT,
  inflationRate: DEFAULT_INFLATION_RATE_PCT,
  includeSsa: DEFAULT_INCLUDE_SSA,
  ssaStartAge: DEFAULT_SSA_START_AGE,
  ssaAnnualBenefit: DEFAULT_SSA_ANNUAL_BENEFIT,
  includeSpouse: DEFAULT_INCLUDE_SPOUSE,
  spouseAge: DEFAULT_AGE,
  spouseSsaBenefit: DEFAULT_SPOUSE_SSA_BENEFIT,
  preMedicareAnnualPremium: DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
  postMedicareAnnualPremium: DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
}

function computeResult(a: Assumptions) {
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

  // Project savings by retirement
  const r = a.growthRatePreRetirement / 100
  const fvSavings = a.currentSavings * Math.pow(1 + r, yearsToRetirement)
  const fvContributions = r > 0
    ? a.annualContribution * ((Math.pow(1 + r, yearsToRetirement) - 1) / r)
    : a.annualContribution * yearsToRetirement
  const projectedNestEgg = fvSavings + fvContributions

  const surplus = projectedNestEgg - nestEggNeeded
  const onTrack = surplus >= 0

  // Simulate how many years the projected nest egg would last
  let yearsLast = 0
  let balance = projectedNestEgg
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
    projectedNestEgg: Math.round(projectedNestEgg),
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

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

export default function RetirementCalculator() {
  const router = useRouter()
  const supabase = createClient()
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULTS)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [loadedFromDb, setLoadedFromDb] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load persisted assumptions on mount
  useEffect(() => {
    const load = async () => {
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
          ssaStartAge: data.ssa_start_age ?? DEFAULT_SSA_START_AGE,
          ssaAnnualBenefit: data.ssa_annual_benefit,
          includeSpouse: data.include_spouse,
          spouseAge: data.spouse_age,
          spouseSsaBenefit: data.spouse_ssa_benefit,
          preMedicareAnnualPremium: data.pre_medicare_annual_premium ?? DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM,
          postMedicareAnnualPremium: data.post_medicare_annual_premium ?? DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM,
        })
        setLoadedFromDb(true)
      }
    }
    load()
  }, [])

  // Auto-save debounced whenever assumptions change (after initial load)
  const persistAssumptions = useCallback(async (a: Assumptions) => {
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
  }, [])

  const update = useCallback(
    <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
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

  const result = useMemo(() => computeResult(assumptions), [assumptions])

  const handleSaveAsPlan = async () => {
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

      // 5. Create calculator settings for the scenario
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
        enable_borrowing: false,
      }])

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

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
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
                {loadedFromDb ? 'Your saved assumptions' : 'Based on your assumptions below'}
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
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <p className="text-xs text-muted-foreground mb-0.5">You need approximately</p>
                <p className={`text-3xl sm:text-4xl font-bold tracking-tight ${statusColor}`}>
                  {fmt(result.nestEggNeeded)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  saved by age {assumptions.retirementAge} to fund retirement through age {assumptions.lifeExpectancy}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-md p-4 space-y-2 text-left leading-relaxed">
              <p className="font-semibold text-sm">How this amount is calculated</p>
              <div className="space-y-1.5 text-[11px]">
                <p>
                  <span className="opacity-70">1.</span>{' '}
                  Your monthly expenses ({fmt(assumptions.monthlyExpenses)}/mo = {fmt(assumptions.monthlyExpenses * 12)}/yr) are
                  grown by {assumptions.inflationRate}% inflation over {result.yearsToRetirement} years
                  to <strong>{fmt(result.expensesAtRetirement)}/yr</strong> at retirement.
                </p>
                <p>
                  <span className="opacity-70">2.</span>{' '}
                  Healthcare premiums are added:{' '}
                  {result.yearsPreMedicare > 0 && (
                    <><strong>{fmt(assumptions.preMedicareAnnualPremium)}/yr</strong> pre-Medicare (ages {assumptions.retirementAge}–{Math.min(assumptions.retirementAge + result.yearsPreMedicare, MEDICARE_ELIGIBILITY_AGE) - 1}){result.yearsPostMedicare > 0 ? ', then ' : ''}</>
                  )}
                  {result.yearsPostMedicare > 0 && (
                    <><strong>{fmt(assumptions.postMedicareAnnualPremium)}/yr</strong> after Medicare ({MEDICARE_ELIGIBILITY_AGE}+)</>
                  )}
                  . Total healthcare: <strong>{fmt(result.totalHealthcareCost)}</strong> over retirement.
                </p>
                <p>
                  <span className="opacity-70">3.</span>{' '}
                  {assumptions.includeSsa ? (
                    assumptions.retirementAge < result.ssaStartAge ? (
                      <>Social Security ({fmt(result.annualSsa)}/yr) begins at age <strong>{result.ssaStartAge}</strong> — you&apos;ll have <strong>{result.yearsBeforeSsa} years without SSA income</strong> (ages {assumptions.retirementAge}–{result.ssaStartAge - 1}) where expenses must be fully self-funded.</>
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
                  <strong>{(assumptions.growthRateDuringRetirement - assumptions.inflationRate).toFixed(1)}% real return</strong>{' '}
                  ({assumptions.growthRateDuringRetirement}% growth − {assumptions.inflationRate}% inflation).
                </p>
                <p>
                  <span className="opacity-70">5.</span>{' '}
                  Your current savings ({fmt(assumptions.currentSavings)}) plus annual contributions ({fmt(assumptions.annualContribution)}/yr)
                  grow at {assumptions.growthRatePreRetirement}% for {result.yearsToRetirement} years,
                  projecting to <strong>{fmt(result.projectedNestEgg)}</strong> by retirement.
                </p>
                <p className="pt-1 border-t border-current/10">
                  {result.onTrack
                    ? <>You are projected to have a <strong className="text-emerald-300">surplus of {fmt(result.surplus)}</strong>.</>
                    : <>You have a projected <strong className="text-amber-300">shortfall of {fmt(Math.abs(result.surplus))}</strong>. Save an extra {fmt(result.monthlyAdjustment)}/mo to close the gap.</>
                  }
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
          <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
            <div className="rounded-lg bg-background/60 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">On track to have</p>
              <p className="font-semibold">{fmt(result.projectedNestEgg)}</p>
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
          <span>Saved <strong className="text-foreground">{fmt(assumptions.currentSavings)}</strong></span>
          <span>Contributing <strong className="text-foreground">{fmt(assumptions.annualContribution)}/yr</strong></span>
          <span>Spending <strong className="text-foreground">{fmt(assumptions.monthlyExpenses * 12)}/yr</strong></span>
          {assumptions.includeSsa && (
            <span>SSA <strong className="text-foreground">{fmt(assumptions.ssaAnnualBenefit)}/yr at {assumptions.ssaStartAge}</strong></span>
          )}
          <span>Healthcare <strong className="text-foreground">{fmt(assumptions.preMedicareAnnualPremium)}/yr → {fmt(assumptions.postMedicareAnnualPremium)}/yr</strong></span>
          <span>Growth <strong className="text-foreground">{assumptions.growthRatePreRetirement}%→{assumptions.growthRateDuringRetirement}%</strong></span>
          <span>Inflation <strong className="text-foreground">{assumptions.inflationRate}%</strong></span>
        </div>
      </div>

      {/* Expand/collapse */}
      <div className="px-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Change assumptions</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Editable assumptions */}
      {expanded && (
        <>
          <Separator />
          <div className="px-6 py-5 space-y-6">
            {/* About you */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">About You</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumField label="Current Age" value={assumptions.age} onChange={(v) => update('age', v)} />
                <NumField label="Retirement Age" value={assumptions.retirementAge} onChange={(v) => update('retirementAge', v)} />
                <NumField label="Life Expectancy" value={assumptions.lifeExpectancy} onChange={(v) => update('lifeExpectancy', v)} />
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <Checkbox
                  id="calc-spouse"
                  checked={assumptions.includeSpouse}
                  onCheckedChange={(v) => update('includeSpouse', !!v)}
                />
                <Label htmlFor="calc-spouse" className="text-sm cursor-pointer">Include spouse</Label>
              </div>
              {assumptions.includeSpouse && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <NumField label="Spouse Age" value={assumptions.spouseAge} onChange={(v) => update('spouseAge', v)} />
                </div>
              )}
            </div>

            {/* Savings */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Savings &amp; Spending</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <CurrencyField label="Current Savings" value={assumptions.currentSavings} onChange={(v) => update('currentSavings', v)} />
                <CurrencyField label="Annual Contribution" value={assumptions.annualContribution} onChange={(v) => update('annualContribution', v)} />
                <CurrencyField label="Monthly Expenses" value={assumptions.monthlyExpenses} onChange={(v) => update('monthlyExpenses', v)} />
              </div>
            </div>

            {/* Growth & inflation */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Growth &amp; Inflation</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <PctField label="Growth — Pre-retirement" value={assumptions.growthRatePreRetirement} onChange={(v) => update('growthRatePreRetirement', v)} />
                <PctField label="Growth — In retirement" value={assumptions.growthRateDuringRetirement} onChange={(v) => update('growthRateDuringRetirement', v)} />
                <PctField label="Inflation Rate" value={assumptions.inflationRate} onChange={(v) => update('inflationRate', v)} />
              </div>
            </div>

            {/* Social Security */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Social Security</h4>
              </div>
              <div className="flex items-center gap-2.5 mb-3">
                <Checkbox
                  id="calc-ssa"
                  checked={assumptions.includeSsa}
                  onCheckedChange={(v) => update('includeSsa', !!v)}
                />
                <Label htmlFor="calc-ssa" className="text-sm cursor-pointer">Include Social Security income</Label>
              </div>
              {assumptions.includeSsa && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <NumField label="SSA Start Age" value={assumptions.ssaStartAge} onChange={(v) => update('ssaStartAge', Math.max(SSA_EARLIEST_ELIGIBILITY_AGE, v))} />
                    <CurrencyField label="Your Annual SSA" value={assumptions.ssaAnnualBenefit} onChange={(v) => update('ssaAnnualBenefit', v)} />
                    {assumptions.includeSpouse && (
                      <CurrencyField label="Spouse Annual SSA" value={assumptions.spouseSsaBenefit} onChange={(v) => update('spouseSsaBenefit', v)} />
                    )}
                  </div>
                  {assumptions.retirementAge < assumptions.ssaStartAge && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Retiring at {assumptions.retirementAge} means {assumptions.ssaStartAge - assumptions.retirementAge} year{assumptions.ssaStartAge - assumptions.retirementAge > 1 ? 's' : ''} without
                      Social Security income ({fmt(result.annualSsa)}/yr). This gap is factored into the calculation.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Healthcare */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Healthcare</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Annual health insurance premiums before and after Medicare eligibility (age {MEDICARE_ELIGIBILITY_AGE}).
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <CurrencyField label={`Pre-Medicare (before ${MEDICARE_ELIGIBILITY_AGE})`} value={assumptions.preMedicareAnnualPremium} onChange={(v) => update('preMedicareAnnualPremium', v)} />
                <CurrencyField label={`Post-Medicare (${MEDICARE_ELIGIBILITY_AGE}+)`} value={assumptions.postMedicareAnnualPremium} onChange={(v) => update('postMedicareAnnualPremium', v)} />
              </div>
              {assumptions.retirementAge < MEDICARE_ELIGIBILITY_AGE && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Retiring at {assumptions.retirementAge} means {MEDICARE_ELIGIBILITY_AGE - assumptions.retirementAge} year{MEDICARE_ELIGIBILITY_AGE - assumptions.retirementAge > 1 ? 's' : ''} of
                  private insurance at {fmt(assumptions.preMedicareAnnualPremium)}/yr before Medicare kicks in at {MEDICARE_ELIGIBILITY_AGE}.
                </p>
              )}
            </div>

            {/* How it's calculated */}
            <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold text-foreground/60">How this is calculated</span>
              </div>
              <p>
                Annual expenses ({fmt(result.expensesAtRetirement)}/yr at retirement) plus healthcare premiums
                ({result.yearsPreMedicare > 0 ? `${fmt(assumptions.preMedicareAnnualPremium)}/yr pre-Medicare, ` : ''}{fmt(assumptions.postMedicareAnnualPremium)}/yr post-Medicare)
                are modeled year-by-year.
                {assumptions.includeSsa && assumptions.retirementAge < result.ssaStartAge && (
                  <> SSA ({fmt(result.annualSsa)}/yr) doesn&apos;t begin until age {result.ssaStartAge}, leaving a {result.yearsBeforeSsa}-year gap.</>
                )}
                {assumptions.includeSsa && assumptions.retirementAge >= result.ssaStartAge && (
                  <> SSA ({fmt(result.annualSsa)}/yr) offsets expenses from day one.</>
                )}
                {' '}The nest egg needed is the present value of the net shortfall over {result.retirementYears} years at a {(assumptions.growthRateDuringRetirement - assumptions.inflationRate).toFixed(1)}% real return.
              </p>
            </div>
          </div>

          <Separator />
          {/* Save as plan */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="text-xs text-muted-foreground max-w-md">
              Save these as a plan to unlock detailed projections, scenario modeling, risk analysis, and more.
            </div>
            <Button size="sm" onClick={handleSaveAsPlan} disabled={savingPlan}>
              <Save className="h-3.5 w-3.5" />
              {savingPlan ? 'Creating…' : 'Save as Plan'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-9 text-sm"
      />
    </div>
  )
}

function CurrencyField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-9 text-sm pl-6"
        />
      </div>
    </div>
  )
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-9 text-sm pr-7"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

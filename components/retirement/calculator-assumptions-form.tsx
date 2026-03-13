'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  TrendingUp,
  Shield,
  HeartPulse,
  Info,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { NumField, CurrencyField, PctField } from '@/components/ui/form-fields'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { formatCurrencyShort as fmt } from '@/lib/utils/formatting'
import { SSA_EARLIEST_ELIGIBILITY_AGE, MEDICARE_ELIGIBILITY_AGE } from '@/lib/constants/retirement-defaults'
import type { RetirementAssumptions } from '@/lib/types/retirement-assumptions'

/** Result shape used for "How it's calculated" and SSA gap message (from computeResult or equivalent). */
export interface CalculatorResultSummary {
  annualSsa: number
  expensesAtRetirement: number
  yearsPreMedicare: number
  ssaStartAge: number
  yearsBeforeSsa: number
  retirementYears: number
}

export interface CalculatorAssumptionsFormProps {
  value: RetirementAssumptions
  onChange: (next: RetirementAssumptions) => void
  /** When provided, shows "How it's calculated" and SSA gap message using these values. */
  result?: CalculatorResultSummary | null
  /** Show a primary save button (e.g. "Save & See My Retirement Snapshot"). */
  showSaveButton?: boolean
  saveLabel?: string
  onSave?: (a: RetirementAssumptions) => Promise<void>
  saving?: boolean
  /** Optional prefix for field ids to avoid collisions when multiple forms exist. */
  formId?: string
  /** If true, form is always expanded (e.g. when used as the main Plan Inputs form). */
  defaultExpanded?: boolean
  /** When provided, shows "Change to default assumptions" on the same line as "Change assumptions". */
  onResetToDefaults?: () => void
  /** Disable the reset button (e.g. while saving). */
  resetDisabled?: boolean
  /** When true, do not show the "How this is calculated" block (e.g. when the parent shows it near the amount). */
  hideHowCalculated?: boolean
}

const rowButtonClass =
  'py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none'

export function CalculatorAssumptionsForm({
  value: assumptions,
  onChange,
  result,
  showSaveButton = false,
  saveLabel = 'Save',
  onSave,
  saving = false,
  formId = 'calc',
  defaultExpanded = false,
  onResetToDefaults,
  resetDisabled = false,
  hideHowCalculated = false,
}: CalculatorAssumptionsFormProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const update = <K extends keyof RetirementAssumptions>(key: K, val: RetirementAssumptions[K]) => {
    onChange({ ...assumptions, [key]: val })
  }

  const annualSsa = result?.annualSsa ?? assumptions.ssaAnnualBenefit + (assumptions.includeSpouse ? assumptions.spouseSsaBenefit : 0)

  return (
    <div className="space-y-6">
      {!defaultExpanded && (
        <div className="flex w-full items-center flex-wrap gap-x-8 gap-y-2 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-1.5 ${rowButtonClass}`}
          >
            <span>Change assumptions</span>
            {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          {onResetToDefaults && (
            <button
              type="button"
              onClick={onResetToDefaults}
              disabled={resetDisabled}
              className={rowButtonClass}
            >
              Change to default assumptions
            </button>
          )}
        </div>
      )}

      {(expanded || defaultExpanded) && (
        <>
          {!defaultExpanded && <Separator />}
          <div className="space-y-6">
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
                  id={`${formId}-spouse`}
                  checked={assumptions.includeSpouse}
                  onCheckedChange={(v) => update('includeSpouse', !!v)}
                />
                <Label htmlFor={`${formId}-spouse`} className="text-sm cursor-pointer">Include spouse</Label>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors" aria-label="Savings and spending benchmark info">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                    <p className="font-semibold mb-1">Savings benchmark{assumptions.age ? ` (your age: ${assumptions.age})` : ''}</p>
                    {assumptions.age && (
                      <p>
                        Avg 401(k) balance ages {
                          assumptions.age < 30 ? '25–29' :
                          assumptions.age < 35 ? '30–34' :
                          assumptions.age < 40 ? '35–39' :
                          assumptions.age < 45 ? '40–44' :
                          assumptions.age < 50 ? '45–49' :
                          assumptions.age < 55 ? '50–54' :
                          assumptions.age < 60 ? '55–59' : '60–64'
                        }: <span className="font-medium">{
                          assumptions.age < 30 ? '$24,000' :
                          assumptions.age < 35 ? '$45,700' :
                          assumptions.age < 40 ? '$73,200' :
                          assumptions.age < 45 ? '$109,100' :
                          assumptions.age < 50 ? '$152,100' :
                          assumptions.age < 55 ? '$199,900' :
                          assumptions.age < 60 ? '$244,900' : '$246,500'
                        }</span> (Fidelity Q4 2024).
                      </p>
                    )}
                    <p className="mt-1 text-xs">Rule of thumb: 1× salary by 30 · 3× by 40 · 6× by 50 · 8× by 60 · 10× by 67.</p>
                    <p className="mt-2 font-semibold border-t border-background/20 pt-2">Spending benchmark</p>
                    {assumptions.age && (
                      <p>
                        Avg household spending ages {
                          assumptions.age < 35 ? '25–34' :
                          assumptions.age < 45 ? '35–44' :
                          assumptions.age < 55 ? '45–54' :
                          assumptions.age < 65 ? '55–64' : '65+'
                        }: <span className="font-medium">{
                          assumptions.age < 35 ? '~$5,700/mo' :
                          assumptions.age < 45 ? '~$7,200/mo' :
                          assumptions.age < 55 ? '~$7,600/mo' :
                          assumptions.age < 65 ? '~$6,500/mo' : '~$4,800/mo'
                        }</span> (BLS Consumer Expenditure Survey).
                      </p>
                    )}
                    <p className="mt-1 text-background/80 text-xs">Excludes healthcare premiums (tracked separately). National averages — your number may vary by location, household size, and lifestyle.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <CurrencyField label="Current Savings" value={assumptions.currentSavings} onChange={(v) => update('currentSavings', v)} />
                <CurrencyField label="Annual Contribution" value={assumptions.annualContribution} onChange={(v) => update('annualContribution', v)} />
                <CurrencyField label="Monthly Living Expenses" value={assumptions.monthlyExpenses} onChange={(v) => update('monthlyExpenses', v)} helpText="Excludes healthcare (set below)" />
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors" aria-label="Social Security benchmark info">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                    <p className="font-semibold mb-1">Benchmark defaults</p>
                    <p>Your SSA: <span className="font-medium">$23,100/yr</span> — avg retired worker $1,924/mo (SSA Monthly Snapshot, Oct 2024).</p>
                    <p className="mt-1">Spouse SSA: <span className="font-medium">$20,500/yr</span> — avg women retired worker ~$1,714/mo (SSA Statistical Supplement 2024).</p>
                    <p className="mt-1">Benefits grow at <span className="font-medium">2.5%/yr COLA</span> (SSA 2025 cost-of-living adjustment).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2.5 mb-3">
                <Checkbox
                  id={`${formId}-ssa`}
                  checked={assumptions.includeSsa}
                  onCheckedChange={(v) => update('includeSsa', !!v)}
                />
                <Label htmlFor={`${formId}-ssa`} className="text-sm cursor-pointer">Include Social Security income</Label>
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
                      Social Security income ({fmt(annualSsa)}/yr). This gap is factored into the calculation.
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors" aria-label="Healthcare benchmark info">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
                    <p className="font-semibold mb-1">Benchmark defaults (premiums only)</p>
                    <p>Pre-Medicare: <span className="font-medium">$20,400/yr</span> — ACA benchmark silver plan, unsubsidized age 60 (CMS/KFF 2024 QHP Premiums Report).</p>
                    <p className="mt-1">Post-Medicare: <span className="font-medium">$4,500/yr</span> — Medicare Part B ($185/mo) + Medigap Plan G avg (~$192/mo) (CMS 2025).</p>
                    <p className="mt-1">Premiums grow at <span className="font-medium">5%/yr</span> (KFF 2024 Employer Health Benefits Survey).</p>
                    <p className="mt-2 border-t border-background/20 pt-2 text-background/80">These figures cover insurance premiums only. Out-of-pocket costs (co-pays, deductibles, dental, vision) should be included in your monthly living expenses above.</p>
                    <p className="mt-1 text-background/80">Why separate? Premiums inflate faster (~5%/yr) than general expenses (~3%), and drop sharply at 65 when Medicare kicks in. Keeping them separate lets the projection model each rate and the Medicare transition accurately.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Annual health insurance premiums (separate from living expenses above). Costs shift at Medicare eligibility (age {MEDICARE_ELIGIBILITY_AGE}).
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

            {/* How it's calculated - only when result is provided and not shown elsewhere */}
            {result != null && !hideHowCalculated && (
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
            )}
          </div>

          {showSaveButton && onSave && (
            <>
              <Separator />
              <div className="flex justify-end">
                <Button
                  onClick={() => onSave(assumptions)}
                  disabled={saving || !assumptions.age || !assumptions.retirementAge || assumptions.currentSavings === undefined}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span>{saveLabel}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

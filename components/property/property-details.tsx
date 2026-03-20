'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_CLOSING_COST_PCT,
  DEFAULT_LOAN_TERM,
  DEFAULT_EXPENSE_RATIO,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'
import { computeInvestmentScore } from '@/lib/property/scoring'
import { useScoringConfig } from '@/components/property/scoring-context'
import ScoringSettings from '@/components/property/scoring-settings'
import { cn } from '@/lib/utils'

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  type: string | null
  'Number of Units': number | null
  'Has HOA': boolean | null
  swimming_pool?: boolean | null
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  listing_status?: string | null
  source?: string | null
  mls_number?: string | null
  listing_url?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  lot_size?: string | null
  community?: string | null
  plan_name?: string | null
  estimated_rent?: number | null
  estimated_cash_flow?: number | null
  notes?: string | null
  additional_info?: string | null
  created_at: string
}

interface PropertyDetailsProps {
  property: Property
  /** Base path for property links (detail, scenarios). Default: personal `/apps/property/properties/:id` */
  propertyBasePath?: string
}

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Leased: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function fmt$(v: number) {
  return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function computeCurrentAnalysis(property: Property) {
  const askingPrice = property['Asking Price'] ?? 0
  const monthlyGross = property['Gross Income'] ?? 0
  const monthlyExp = property['Operating Expenses'] ?? 0
  const estRent = property.estimated_rent ?? 0
  const hasActuals = monthlyGross > 0
  const annualNoi = hasActuals ? (monthlyGross - monthlyExp) * MONTHS_PER_YEAR : 0
  const estAnnualNoi = hasActuals
    ? annualNoi
    : estRent > 0 && monthlyExp > 0
      ? (estRent - monthlyExp) * MONTHS_PER_YEAR
      : estRent > 0
        ? estRent * MONTHS_PER_YEAR * (1 - DEFAULT_EXPENSE_RATIO)
        : monthlyExp > 0
          ? -monthlyExp * MONTHS_PER_YEAR
          : 0
  const noiForCalcs = hasActuals ? annualNoi : estAnnualNoi

  const downPct = DEFAULT_DOWN_PAYMENT_PCT / 100
  const downPayment = askingPrice > 0 ? askingPrice * downPct : 0
  const closingCosts = askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
  const loanAmount = askingPrice * (1 - downPct)
  let annualDebt = 0
  if (loanAmount > 0) {
    const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
    const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
    const mp = loanAmount * ((monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1))
    annualDebt = mp * MONTHS_PER_YEAR
  }
  const annualCashFlow = noiForCalcs - annualDebt
  const roi = downPayment + closingCosts > 0 ? (annualCashFlow / (downPayment + closingCosts)) * 100 : 0
  const capRate = askingPrice > 0 && noiForCalcs > 0 ? (noiForCalcs / askingPrice) * 100 : 0

  const monthlyRent = property.estimated_rent ?? property['Gross Income'] ?? 0
  const monthlyExpenses = property['Operating Expenses'] ?? 0
  const monthlyGrossIncome = property['Gross Income'] ?? property.estimated_rent ?? 0
  const monthlyIncome = monthlyRent > 0 ? monthlyRent : monthlyGrossIncome

  const debtYield = loanAmount > 0 && noiForCalcs > 0 ? (noiForCalcs / loanAmount) * 100 : null
  const annualGrossIncome = monthlyGrossIncome * MONTHS_PER_YEAR
  const annualExpenses = monthlyExpenses * MONTHS_PER_YEAR
  const breakEvenRatio = annualGrossIncome > 0 && annualDebt > 0
    ? ((annualExpenses + annualDebt) / annualGrossIncome) * 100
    : null
  const annualCoCRDollars = downPayment + closingCosts > 0 ? annualCashFlow : null

  const annualGrossRent = monthlyIncome * MONTHS_PER_YEAR
  const grm = askingPrice > 0 && annualGrossRent > 0 ? askingPrice / annualGrossRent : null
  const onePercentRatio = askingPrice > 0 && monthlyIncome > 0 ? (monthlyIncome / askingPrice) * 100 : null

  return {
    askingPrice, monthlyRent, monthlyExpenses, monthlyIncome, noi: noiForCalcs,
    firstYearCashFlow: annualCashFlow, capRate, firstYearCoCR: roi,
    debtYield, breakEvenRatio, annualCoCRDollars, downPayment, closingCosts,
    grm, onePercentRatio,
  }
}

export default function PropertyDetails({ property, propertyBasePath }: PropertyDetailsProps) {
  const base =
    propertyBasePath ?? `/apps/property/properties/${property.id}`
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [scoreExpanded, setScoreExpanded] = useState(false)
  const { config } = useScoringConfig()
  const a = computeCurrentAnalysis(property)
  const isPositive = a.firstYearCashFlow >= 0
  const hasPrice = a.askingPrice > 0
  const canScore = hasPrice && a.monthlyIncome > 0

  const scoreResult = canScore
    ? computeInvestmentScore(config, {
        capRate: a.capRate,
        roi: a.firstYearCoCR,
        annualCashFlow: a.firstYearCashFlow,
        noiForCalcs: a.noi,
        onePercentRatio: a.onePercentRatio,
        grm: a.grm,
      }, fmt$)
    : null

  // Build one-line summary chips for the banner
  const chips: string[] = []
  if (property.type) chips.push(property.type)
  if (property.bedrooms != null) chips.push(`${property.bedrooms} bd`)
  if (property.bathrooms != null) chips.push(`${property.bathrooms} ba`)
  if (property.sqft != null) chips.push(`${property.sqft.toLocaleString()} sqft`)
  if (property.city) chips.push(property.city)
  if (property.county && property.county !== property.city) chips.push(property.county)
  if (property.community) chips.push(property.community)
  if (property['Has HOA']) chips.push('HOA')
  if (property.swimming_pool) chips.push('Pool')

  return (
    <div className="space-y-4">

      {/* ═══ Property Details Banner (collapsible) ═══ */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
        >
          {property.listing_status && (
            <Badge className={cn('shrink-0 text-[10px]', STATUS_COLORS[property.listing_status] ?? '')}>
              {property.listing_status}
            </Badge>
          )}

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 flex-1 min-w-0 text-sm">
            {chips.length > 0 ? chips.map((chip, i) => (
              <span key={i} className="whitespace-nowrap">
                <span className="text-foreground/80">{chip}</span>
                {i < chips.length - 1 && <span className="text-muted-foreground/40 mx-0.5">·</span>}
              </span>
            )) : (
              <span className="text-muted-foreground">No property details</span>
            )}
          </div>

          <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
            {detailsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="hidden sm:inline">{detailsExpanded ? 'Less' : 'Details'}</span>
          </span>
        </button>

        {detailsExpanded && (
          <div className="border-t border-border/80 px-4 pb-4 pt-3 space-y-4">
            <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
              <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-5">
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd className="text-sm mt-0.5">{property.address || 'Not specified'}</dd>
              </div>
              {property.city && <div><dt className="text-xs text-muted-foreground">City</dt><dd className="text-sm mt-0.5">{property.city}</dd></div>}
              {property.county && <div><dt className="text-xs text-muted-foreground">County</dt><dd className="text-sm mt-0.5">{property.county}</dd></div>}
              {property.source && <div><dt className="text-xs text-muted-foreground">Source / Realtor</dt><dd className="text-sm mt-0.5">{property.source}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">Type</dt><dd className="text-sm mt-0.5">{property.type || '—'}</dd></div>
              {property['Number of Units'] != null && <div><dt className="text-xs text-muted-foreground">Units</dt><dd className="text-sm mt-0.5">{property['Number of Units']}</dd></div>}
              <div><dt className="text-xs text-muted-foreground">HOA</dt><dd className="text-sm mt-0.5">{property['Has HOA'] === null ? '—' : property['Has HOA'] ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Pool</dt><dd className="text-sm mt-0.5">{property.swimming_pool == null ? '—' : property.swimming_pool ? 'Yes' : 'No'}</dd></div>
              {property.community && <div><dt className="text-xs text-muted-foreground">Community</dt><dd className="text-sm mt-0.5">{property.community}</dd></div>}
              {property.plan_name && <div><dt className="text-xs text-muted-foreground">Plan</dt><dd className="text-sm mt-0.5">{property.plan_name}</dd></div>}
              {property.bedrooms != null && <div><dt className="text-xs text-muted-foreground">Beds</dt><dd className="text-sm mt-0.5">{property.bedrooms}</dd></div>}
              {property.bathrooms != null && <div><dt className="text-xs text-muted-foreground">Baths</dt><dd className="text-sm mt-0.5">{property.bathrooms}</dd></div>}
              {property.sqft != null && <div><dt className="text-xs text-muted-foreground">Sq Ft</dt><dd className="text-sm mt-0.5 tabular-nums">{property.sqft.toLocaleString()}</dd></div>}
              {property.lot_size && <div><dt className="text-xs text-muted-foreground">Lot</dt><dd className="text-sm mt-0.5">{property.lot_size}</dd></div>}
            </dl>

            {property.notes && (
              <div className="border-t border-border/80 pt-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.notes}</p>
              </div>
            )}

            {property.additional_info && (
              <div className="border-t border-border/80 pt-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Additional information</h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono break-words bg-muted/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                  {property.additional_info}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Property & Analysis Card (always visible) ═══ */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Property & Analysis</h3>
          {scoreResult && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums',
              scoreResult.score >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
              scoreResult.score >= 45 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            )}>
              Score: {scoreResult.score}/100
            </span>
          )}
        </div>

        {/* Current Property Analysis */}
        <div className="border-t border-border/80 pt-4">
          <div className="flex items-center gap-3 mb-3">
            {hasPrice ? (
              isPositive
                ? <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                : <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
            ) : null}
            <div>
              <h4 className="text-sm font-semibold">Current Property Analysis</h4>
              {hasPrice ? (
                <p className={cn('text-sm font-medium', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                  This property currently has {isPositive ? 'positive' : 'negative'} cash flow
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add an asking price to see cash flow and ROI analysis.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="text-sm font-semibold tabular-nums">{hasPrice ? fmt$(a.askingPrice) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rent /mo</p>
              <p className="text-sm font-semibold tabular-nums">{a.monthlyRent > 0 ? fmt$(a.monthlyRent) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expenses /mo</p>
              <p className="text-sm font-semibold tabular-nums">{a.monthlyExpenses > 0 ? fmt$(a.monthlyExpenses) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Annual NOI</p>
              <p className={cn('text-sm font-semibold tabular-nums', a.noi < 0 && 'text-destructive')}>{a.noi !== 0 ? fmt$(a.noi) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Year 1 Cash Flow</p>
              <p className={cn('text-sm font-semibold tabular-nums', a.firstYearCashFlow < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                {hasPrice ? fmt$(a.firstYearCashFlow) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cap Rate</p>
              <p className={cn('text-sm font-semibold tabular-nums',
                hasPrice && a.capRate > 0 ? (a.capRate >= 8 ? 'text-emerald-600 dark:text-emerald-400' : a.capRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive') : ''
              )}>
                {hasPrice && a.capRate > 0 ? `${a.capRate.toFixed(2)}%` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ROI (CoCR)</p>
              <div>
                <p className={cn('text-sm font-semibold tabular-nums', a.firstYearCoCR < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                  {hasPrice ? `${a.firstYearCoCR.toFixed(1)}%` : '—'}
                </p>
                {hasPrice && a.annualCoCRDollars != null && (
                  <p className="text-xs text-muted-foreground tabular-nums">{fmt$(a.annualCoCRDollars)}/yr</p>
                )}
              </div>
            </div>
          </div>

          {/* Debt Yield + Break-Even */}
          {hasPrice && (a.debtYield != null || a.breakEvenRatio != null) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-border/50">
              {a.debtYield != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Debt Yield</p>
                  <p className={cn('text-sm font-semibold tabular-nums', a.debtYield >= 10 ? 'text-emerald-600 dark:text-emerald-400' : a.debtYield >= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')}>
                    {a.debtYield.toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground">NOI ÷ Loan Amt</p>
                </div>
              )}
              {a.breakEvenRatio != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Break-Even Ratio</p>
                  <p className={cn('text-sm font-semibold tabular-nums', a.breakEvenRatio <= 85 ? 'text-emerald-600 dark:text-emerald-400' : a.breakEvenRatio <= 100 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')}>
                    {a.breakEvenRatio.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">(Exp + Debt) ÷ Income</p>
                </div>
              )}
            </div>
          )}

          {hasPrice && (
            <p className="text-xs text-muted-foreground mt-2">
              Based on {DEFAULT_DOWN_PAYMENT_PCT}% down, {DEFAULT_LOAN_TERM} yr loan at {DEFAULT_ANALYSIS_INTEREST_RATE}%, {DEFAULT_CLOSING_COST_PCT}% closing costs
            </p>
          )}

          {/* Score: total always visible, breakdown collapsible */}
          {scoreResult && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="w-full flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setScoreExpanded((v) => !v)}
                  className="flex items-center gap-2 flex-1 min-w-0 hover:bg-muted/30 rounded -mx-1 px-1 py-0.5 transition-colors text-left"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Investment Score</p>
                  <span className={cn('text-sm font-bold tabular-nums',
                    scoreResult.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                    scoreResult.score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
                  )}>
                    {scoreResult.score}/100
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5 ml-auto">
                    {scoreExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                <ScoringSettings />
              </div>
              {scoreExpanded && (
                <div className="space-y-1.5 mt-2">
                  {scoreResult.components.map((c) => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="text-muted-foreground">{c.label}</span>
                        <span className="tabular-nums font-medium">{c.pts}<span className="text-muted-foreground font-normal">/{c.maxPts}</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all',
                            c.maxPts > 0 && c.pts >= c.maxPts * 0.7 ? 'bg-emerald-500' :
                            c.maxPts > 0 && c.pts >= c.maxPts * 0.4 ? 'bg-amber-500' : 'bg-red-500'
                          )}
                          style={{ width: `${c.maxPts > 0 ? Math.round((c.pts / c.maxPts) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{c.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="border-t border-border/80 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Change the analysis</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Model scenarios or add a scenario to explore different assumptions (price, rent, expenses, loan terms).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button asChild variant="default" size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
              <Link href={`${base}/scenarios/recommended`}>
                Model Scenarios
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/scenarios/new`}>
                Add Scenario
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

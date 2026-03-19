'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Building2, ArrowRight, ChevronDown, ChevronUp, Lock, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import FinancialMetrics from '@/components/property/financial-metrics'
import PLTable from '@/components/property/pl-table'
import { PROPERTY_TYPES } from '@/lib/constants/property-defaults'
import { DEFAULT_SCORING_CONFIG, computeInvestmentScore } from '@/lib/property/scoring'
import { FeedbackButton } from '@/components/feedback/feedback-button'
import { FontScaleToggle } from '@/components/layout/font-scale-toggle'
import { ClearDataDialog } from '@/components/layout/clear-data-dialog'

const LOCAL_KEY = 'pi_try_data'

interface TryProperty {
  address: string
  type: string
  askingPrice: number
  grossIncome: number
  operatingExpenses: number
  units: number
  // loan fields
  hasLoan: boolean
  loanTerm: number
  downPaymentPct: number
  interestRate: number
  closingCosts: number
  purchaseClosingCosts: number
  // growth
  incomeIncrease: number
  expensesIncrease: number
  propertyValueIncrease: number
}

interface TryData {
  property: TryProperty
}

const EMPTY_PROPERTY: TryProperty = {
  address: '',
  type: '',
  askingPrice: 0,
  grossIncome: 0,
  operatingExpenses: 0,
  units: 1,
  hasLoan: false,
  loanTerm: 30,
  downPaymentPct: 20,
  interestRate: 7,
  closingCosts: 0,
  purchaseClosingCosts: 0,
  incomeIncrease: 2,
  expensesIncrease: 2,
  propertyValueIncrease: 3,
}

const EMPTY_DATA: TryData = { property: EMPTY_PROPERTY }

/** Build a scenario-shaped object from the live property form so FinancialMetrics + PLTable can consume it. */
function buildScenario(p: TryProperty) {
  const downPaymentAmount = p.askingPrice * (p.downPaymentPct / 100)
  const loanPrincipal = p.askingPrice - downPaymentAmount
  let monthlyMortgage: number | null = null
  if (p.hasLoan && loanPrincipal > 0 && p.interestRate > 0 && p.loanTerm > 0) {
    const r = p.interestRate / 100 / 12
    const n = p.loanTerm * 12
    monthlyMortgage = loanPrincipal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }
  return {
    id: 1,
    'Scenario Name': 'Quick Analysis',
    'Purchase Price': p.askingPrice,
    'Gross Income': p.grossIncome,
    'Operating Expenses': p.operatingExpenses,
    'Has Loan': p.hasLoan,
    'Loan Term': p.hasLoan ? p.loanTerm : null,
    'Down Payment Percentage': p.hasLoan ? p.downPaymentPct : null,
    'Down Payment Amount': p.hasLoan ? downPaymentAmount : null,
    'Interest Rate': p.hasLoan ? p.interestRate : null,
    'Closing Costs': p.hasLoan ? p.closingCosts : null,
    'Purchase Closing Costs': p.purchaseClosingCosts || null,
    'Monthly Mortgage': monthlyMortgage,
    'Annual Mortgage': monthlyMortgage ? monthlyMortgage * 12 : null,
    'Income Increase': p.incomeIncrease,
    'Expenses Increase': p.expensesIncrease,
    'Property Value Increase': p.propertyValueIncrease,
    'Cap Rate': null,
    'Net Income': null,
  }
}

/** Compute the investment score from live property inputs. */
function computeScore(p: TryProperty) {
  if (p.askingPrice <= 0 || p.grossIncome <= 0) return null
  const noi = p.grossIncome - p.operatingExpenses
  const capRate = (noi / p.askingPrice) * 100
  const downPaymentAmount = p.askingPrice * (p.downPaymentPct / 100)
  let annualMortgage = 0
  if (p.hasLoan && p.interestRate > 0 && p.loanTerm > 0) {
    const principal = p.askingPrice - downPaymentAmount
    const r = p.interestRate / 100 / 12
    const n = p.loanTerm * 12
    const monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    annualMortgage = isFinite(monthly) ? monthly * 12 : 0
  }
  const annualCashFlow = noi - annualMortgage
  const totalInvested = p.hasLoan
    ? downPaymentAmount + p.closingCosts + p.purchaseClosingCosts
    : p.askingPrice + p.purchaseClosingCosts
  const roi = totalInvested > 0 ? (annualCashFlow / totalInvested) * 100 : 0
  const monthlyRent = p.grossIncome / 12
  const onePercentRatio = p.askingPrice > 0 ? (monthlyRent / p.askingPrice) * 100 : null
  const grm = p.grossIncome > 0 ? p.askingPrice / p.grossIncome : null

  return computeInvestmentScore(
    DEFAULT_SCORING_CONFIG,
    { capRate, roi, annualCashFlow, noiForCalcs: noi, onePercentRatio, grm },
    (v) => `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  )
}

export default function TryPropertyPage() {
  const [data, setData] = useState<TryData>(EMPTY_DATA)
  const [loaded, setLoaded] = useState(false)
  const [showLoan, setShowLoan] = useState(false)
  const [showGrowth, setShowGrowth] = useState(false)
  const [showPL, setShowPL] = useState(false)
  const [scoreExpanded, setScoreExpanded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Migrate old format (had .scenarios array) to new flat format
        if (parsed?.property && !parsed.property.hasLoan !== undefined) {
          setData({ property: { ...EMPTY_PROPERTY, ...parsed.property } })
        } else {
          setData({ property: { ...EMPTY_PROPERTY, ...parsed.property } })
        }
      }
    } catch {}
    setLoaded(true)
  }, [])

  const save = useCallback((d: TryData) => {
    setData(d)
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)) } catch {}
  }, [])

  const update = useCallback((updates: Partial<TryProperty>) => {
    setData(prev => {
      const next = { ...prev, property: { ...prev.property, ...updates } }
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    save(EMPTY_DATA)
  }, [save])

  if (!loaded) return null

  const p = data.property
  const hasProperty = p.address.length > 0
  const scenario = buildScenario(p)
  const scoreResult = computeScore(p)
  const noi = p.grossIncome - p.operatingExpenses
  const capRate = p.askingPrice > 0 ? ((noi / p.askingPrice) * 100).toFixed(2) : '0.00'

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800/50 px-4 py-2.5 text-center text-sm">
        <span className="text-muted-foreground">Your data lives in this browser only. </span>
        <Link href="/login?signup=1" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Create a free account
        </Link>
        <span className="text-muted-foreground"> to save it permanently.</span>
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="bg-border w-px self-stretch mx-1 hidden sm:block" aria-hidden />
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight">Property Investment</span>
            <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">Try Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <ClearDataDialog
              onConfirm={resetAll}
              description="All property investment data saved in this browser will be permanently deleted."
            />
            <FontScaleToggle variant="inline" />
            <Link href="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {!hasProperty ? (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="h-7 w-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Try Property Investment</h1>
            <p className="mx-auto max-w-md text-muted-foreground">
              Enter a property below to instantly see financial metrics, investment score, and year-by-year P&L.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{p.address}</h1>
              <p className="text-sm text-muted-foreground">
                {p.type && `${p.type} · `}
                {p.askingPrice > 0 && `$${p.askingPrice.toLocaleString()}`}
                {noi !== 0 && ` · NOI $${noi.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Cap Rate ${capRate}%`}
              </p>
            </div>
          </div>
        )}

        {/* ── Property Details Form ── */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-base font-semibold">Property Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Address *</label>
              <input
                type="text"
                value={p.address}
                onChange={(e) => update({ address: e.target.value })}
                placeholder="123 Main St, City, State"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type</label>
              <select
                value={p.type}
                onChange={(e) => update({ type: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select type</option>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Units</label>
              <input
                type="number"
                min="1"
                value={p.units || ''}
                onChange={(e) => update({ units: parseInt(e.target.value) || 1 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Asking Price ($)</label>
              <input
                type="number" min="0" step="1000"
                value={p.askingPrice || ''}
                onChange={(e) => update({ askingPrice: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Gross Income ($/yr)</label>
              <input
                type="number" min="0"
                value={p.grossIncome || ''}
                onChange={(e) => update({ grossIncome: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Operating Expenses ($/yr)</label>
              <input
                type="number" min="0"
                value={p.operatingExpenses || ''}
                onChange={(e) => update({ operatingExpenses: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Purchase Closing Costs ($)</label>
              <input
                type="number" min="0"
                value={p.purchaseClosingCosts || ''}
                onChange={(e) => update({ purchaseClosingCosts: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Loan toggle */}
          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={p.hasLoan}
                onChange={(e) => update({ hasLoan: e.target.checked })}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <span className="text-sm font-medium">Include Loan / Financing</span>
            </label>
            {p.hasLoan && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6 border-l-2 border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Loan Term (years)</label>
                  <input
                    type="number" min="1" max="50"
                    value={p.loanTerm || ''}
                    onChange={(e) => update({ loanTerm: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Down Payment (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.1"
                    value={p.downPaymentPct || ''}
                    onChange={(e) => update({ downPaymentPct: parseFloat(e.target.value) || 0 })}
                    placeholder="20"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Interest Rate (%)</label>
                  <input
                    type="number" min="0" max="25" step="0.01"
                    value={p.interestRate || ''}
                    onChange={(e) => update({ interestRate: parseFloat(e.target.value) || 0 })}
                    placeholder="7.0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Loan Closing Costs ($)</label>
                  <input
                    type="number" min="0"
                    value={p.closingCosts || ''}
                    onChange={(e) => update({ closingCosts: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Growth assumptions collapsible */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowGrowth(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {showGrowth ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Growth Assumptions
            </button>
            {showGrowth && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 pl-6 border-l-2 border-border">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Income Increase (%/yr)</label>
                  <input type="number" min="0" max="100" step="0.1" value={p.incomeIncrease || ''} onChange={(e) => update({ incomeIncrease: parseFloat(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Expenses Increase (%/yr)</label>
                  <input type="number" min="0" max="100" step="0.1" value={p.expensesIncrease || ''} onChange={(e) => update({ expensesIncrease: parseFloat(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Property Value Increase (%/yr)</label>
                  <input type="number" min="0" max="100" step="0.1" value={p.propertyValueIncrease || ''} onChange={(e) => update({ propertyValueIncrease: parseFloat(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live Analysis ── */}
        {hasProperty && p.askingPrice > 0 && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <h2 className="text-base font-semibold">Property Analysis</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Live results based on the values above.</p>
            </div>

            <div className="px-6 pb-5 space-y-5">
              {/* Financial metrics */}
              <FinancialMetrics scenario={scenario} showTitle={false} />

              {/* Investment score */}
              {scoreResult && (
                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setScoreExpanded(v => !v)}
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
                        <span className="hidden sm:inline ml-0.5">Score breakdown</span>
                      </span>
                    </button>
                    {/* Locked scoring settings — upsell instead */}
                    <button
                      type="button"
                      onClick={() => {}}
                      title="Create an account to customise scoring weights"
                      className="flex items-center gap-1 text-xs text-muted-foreground/60 cursor-not-allowed"
                      disabled
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Scoring settings</span>
                    </button>
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

              {/* P&L table */}
              <div className="border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowPL(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {showPL ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showPL ? 'Hide' : 'Show'} Year-by-Year P&L
                </button>
                {showPL && (
                  <div className="mt-4">
                    <PLTable scenario={scenario} years={10} />
                  </div>
                )}
              </div>
            </div>

            {/* Upsell strip */}
            <div className="border-t border-border bg-muted/30 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Unlock the full analysis</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Save this property, compare unlimited scenarios, customise scoring weights, get AI insights, and export reports.
                  </p>
                </div>
              </div>
              <Link href="/login?signup=1" className="shrink-0">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                  Create Free Account <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Empty-state CTA when no address yet */}
        {!hasProperty && (
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Enter an address above to start analysing your property.</p>
            <Link href="/login?signup=1">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Or create a free account for the full experience <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
      <FeedbackButton />
    </div>
  )
}

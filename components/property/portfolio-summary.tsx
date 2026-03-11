'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Building2, DollarSign, Target, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_CLOSING_COST_PCT,
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_EXPENSE_RATIO,
  DEFAULT_LOAN_TERM,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'
import { type ScoringConfig, computeScoreOnly } from '@/lib/property/scoring'
import { useScoringConfig } from '@/components/property/scoring-context'

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  listing_status?: string | null
  sqft?: number | null
  estimated_rent?: number | null
  estimated_cash_flow?: number | null
  created_at: string
}

function computePropertyMetrics(p: Property, scoringConfig: ScoringConfig) {
  const askingPrice = p['Asking Price'] || 0
  const monthlyGross = p['Gross Income'] || 0
  const monthlyExpenses = p['Operating Expenses'] || 0
  const monthlyRent = p.estimated_rent || 0
  const monthlyIncome = monthlyRent > 0 ? monthlyRent : monthlyGross

  const hasActuals = monthlyGross > 0
  const estAnnualNoi = hasActuals
    ? (monthlyGross - monthlyExpenses) * MONTHS_PER_YEAR
    : monthlyRent > 0 && monthlyExpenses > 0
      ? (monthlyRent - monthlyExpenses) * MONTHS_PER_YEAR
      : monthlyRent > 0
        ? monthlyRent * MONTHS_PER_YEAR * (1 - DEFAULT_EXPENSE_RATIO)
        : 0

  const capRate = askingPrice > 0 && estAnnualNoi > 0 ? (estAnnualNoi / askingPrice) * 100 : null

  const downPct = DEFAULT_DOWN_PAYMENT_PCT / 100
  const downPayment = askingPrice > 0 ? askingPrice * downPct : 0
  let roi: number | null = null
  let annualCashFlow = 0
  let annualDebt = 0
  if (askingPrice > 0 && estAnnualNoi !== 0) {
    const loanAmount = askingPrice * (1 - downPct)
    const cashInvested = downPayment + askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
    if (loanAmount > 0 && cashInvested > 0) {
      const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
      const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
      const monthlyPayment =
        loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      annualDebt = monthlyPayment * MONTHS_PER_YEAR
      annualCashFlow = estAnnualNoi - annualDebt
      roi = (annualCashFlow / cashInvested) * 100
    }
  }

  const sqft = p.sqft && p.sqft > 0 ? p.sqft : null
  const pricePerSqft = askingPrice > 0 && sqft ? askingPrice / sqft : null
  const rentPerSqft = monthlyIncome > 0 && sqft ? monthlyIncome / sqft : null

  const onePercentRatio = askingPrice > 0 && monthlyIncome > 0 ? (monthlyIncome / askingPrice) * 100 : null
  const annualGrossRent = monthlyIncome * MONTHS_PER_YEAR
  const grm = askingPrice > 0 && annualGrossRent > 0 ? askingPrice / annualGrossRent : null
  let score: number | null = null
  if (askingPrice > 0 && monthlyIncome > 0 && capRate != null) {
    score = computeScoreOnly(scoringConfig, { capRate, roi, annualCashFlow, noiForCalcs: estAnnualNoi, onePercentRatio, grm })
  }

  return { askingPrice, capRate, roi, annualCashFlow, pricePerSqft, rentPerSqft, score, estAnnualNoi }
}

interface PropertyPortfolioSummaryProps {
  properties: Property[]
}

interface PortfolioStats {
  total: number
  available: number
  sold: number
  leased: number
  avgCapRate: number | null
  avgCoCR: number | null
  cashFlowPositive: number
  cashFlowNegative: number
  avgPricePerSqft: number | null
  bestDeal: Property | null
  totalPortfolioValue: number
}

export default function PropertyPortfolioSummary({ properties }: PropertyPortfolioSummaryProps) {
  const { config: scoringConfig } = useScoringConfig()
  const stats = useMemo<PortfolioStats>(() => {
    const available = properties.filter(
      (p) => !p.listing_status || p.listing_status === '' || p.listing_status === 'Available'
    )
    const sold = properties.filter((p) => p.listing_status === 'Sold')
    const leased = properties.filter((p) => p.listing_status === 'Leased')

    const availableMetrics = available.map((p) => computePropertyMetrics(p, scoringConfig))

    const withCapRate = availableMetrics.filter((m) => m.capRate != null)
    const avgCapRate = withCapRate.length > 0
      ? withCapRate.reduce((s, m) => s + m.capRate!, 0) / withCapRate.length
      : null

    const withRoi = availableMetrics.filter((m) => m.roi != null)
    const avgCoCR = withRoi.length > 0
      ? withRoi.reduce((s, m) => s + m.roi!, 0) / withRoi.length
      : null

    const cashFlowPositive = availableMetrics.filter((m) => m.annualCashFlow > 0).length
    const cashFlowNegative = availableMetrics.filter((m) => m.annualCashFlow < 0 && m.askingPrice > 0).length

    const withPricePerSqft = availableMetrics.filter((m) => m.pricePerSqft != null)
    const avgPricePerSqft = withPricePerSqft.length > 0
      ? withPricePerSqft.reduce((s, m) => s + m.pricePerSqft!, 0) / withPricePerSqft.length
      : null

    const withScore = available.filter((_, i) => availableMetrics[i].score != null)
    let bestDeal: Property | null = null
    if (withScore.length > 0) {
      let bestScore = -1
      withScore.forEach((p, i) => {
        const idx = available.indexOf(p)
        const s = availableMetrics[idx]?.score ?? 0
        if (s > bestScore) { bestScore = s; bestDeal = p }
      })
    }

    const totalPortfolioValue = properties.reduce((s, p) => s + (p['Asking Price'] || 0), 0)

    return {
      total: properties.length,
      available: available.length,
      sold: sold.length,
      leased: leased.length,
      avgCapRate,
      avgCoCR,
      cashFlowPositive,
      cashFlowNegative,
      avgPricePerSqft,
      bestDeal,
      totalPortfolioValue,
    }
  }, [properties, scoringConfig])

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total Properties */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Portfolio</p>
        </div>
        <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
        <div className="text-xs text-muted-foreground mt-1 space-x-1.5">
          <span className="text-emerald-600 dark:text-emerald-400">{stats.available} avail</span>
          {stats.sold > 0 && <span>· {stats.sold} sold</span>}
          {stats.leased > 0 && <span>· {stats.leased} leased</span>}
        </div>
      </div>

      {/* Portfolio Value */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Value</p>
        </div>
        <p className="text-xl font-bold tabular-nums">{stats.totalPortfolioValue > 0 ? fmt(stats.totalPortfolioValue) : '—'}</p>
        <p className="text-xs text-muted-foreground mt-1">Asking prices</p>
      </div>

      {/* Avg Cap Rate */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Cap Rate</p>
        </div>
        <p className={cn('text-2xl font-bold tabular-nums',
          stats.avgCapRate == null ? 'text-muted-foreground' :
          stats.avgCapRate >= 8 ? 'text-emerald-600 dark:text-emerald-400' :
          stats.avgCapRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
        )}>
          {stats.avgCapRate != null ? `${stats.avgCapRate.toFixed(2)}%` : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Available properties</p>
      </div>

      {/* Avg CoCR */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg CoCR</p>
        </div>
        <p className={cn('text-2xl font-bold tabular-nums',
          stats.avgCoCR == null ? 'text-muted-foreground' :
          stats.avgCoCR >= 10 ? 'text-emerald-600 dark:text-emerald-400' :
          stats.avgCoCR >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
        )}>
          {stats.avgCoCR != null ? `${stats.avgCoCR.toFixed(1)}%` : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Cash-on-cash return</p>
      </div>

      {/* Cash Flow split */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cash Flow</p>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{stats.cashFlowPositive}+</p>
          <p className="text-xl font-bold text-destructive tabular-nums">{stats.cashFlowNegative}−</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Positive / Negative</p>
      </div>

      {/* Best Deal */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Best Deal</p>
        </div>
        {stats.bestDeal ? (
          <>
            <Link
              href={`/apps/property/properties/${stats.bestDeal.id}`}
              className="text-sm font-semibold text-primary hover:underline line-clamp-2 leading-tight"
            >
              {stats.bestDeal.address || 'View property'}
            </Link>
            {stats.avgPricePerSqft != null && (
              <p className="text-xs text-muted-foreground mt-1">Avg ${stats.avgPricePerSqft.toFixed(0)}/sqft</p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">—</p>
            {stats.avgPricePerSqft != null && (
              <p className="text-xs text-muted-foreground mt-1">Avg ${stats.avgPricePerSqft.toFixed(0)}/sqft</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

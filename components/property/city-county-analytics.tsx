'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_CLOSING_COST_PCT,
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_EXPENSE_RATIO,
  DEFAULT_LOAN_TERM,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  listing_status?: string | null
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  estimated_rent?: number | null
  sqft?: number | null
  created_at: string
}

function computePropertyMetrics(p: Property) {
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
  if (askingPrice > 0 && estAnnualNoi !== 0) {
    const loanAmount = askingPrice * (1 - downPct)
    const cashInvested = downPayment + askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
    if (loanAmount > 0 && cashInvested > 0) {
      const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
      const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
      const monthlyPayment =
        loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      const annualDebt = monthlyPayment * MONTHS_PER_YEAR
      annualCashFlow = estAnnualNoi - annualDebt
      roi = (annualCashFlow / cashInvested) * 100
    }
  }

  const sqft = p.sqft && p.sqft > 0 ? p.sqft : null
  const pricePerSqft = askingPrice > 0 && sqft ? askingPrice / sqft : null
  const rentPerSqft = monthlyIncome > 0 && sqft ? monthlyIncome / sqft : null

  return { askingPrice, monthlyIncome, capRate, roi, annualCashFlow, pricePerSqft, rentPerSqft }
}

interface AreaStats {
  name: string
  count: number
  avgPrice: number | null
  avgCapRate: number | null
  avgCoCR: number | null
  avgRentPerSqft: number | null
  cashFlowPositive: number
  cashFlowNegative: number
  properties: Property[]
}

function buildAreaStats(properties: Property[], getKey: (p: Property) => string | null): AreaStats[] {
  const groups: Record<string, Property[]> = {}
  const untagged: Property[] = []

  for (const p of properties) {
    const k = getKey(p)
    if (!k) { untagged.push(p); continue }
    if (!groups[k]) groups[k] = []
    groups[k].push(p)
  }
  if (untagged.length > 0) groups['(unspecified)'] = untagged

  return Object.entries(groups)
    .map(([name, props]) => {
      const ms = props.map(computePropertyMetrics)
      const withPrice = ms.filter((m) => m.askingPrice > 0)
      const withCapRate = ms.filter((m) => m.capRate != null)
      const withCoCR = ms.filter((m) => m.roi != null)
      const withRentPerSqft = ms.filter((m) => m.rentPerSqft != null)
      const cfPos = ms.filter((m) => m.annualCashFlow > 0 && m.askingPrice > 0).length
      const cfNeg = ms.filter((m) => m.annualCashFlow < 0 && m.askingPrice > 0).length

      return {
        name,
        count: props.length,
        avgPrice: withPrice.length > 0 ? withPrice.reduce((s, m) => s + m.askingPrice, 0) / withPrice.length : null,
        avgCapRate: withCapRate.length > 0 ? withCapRate.reduce((s, m) => s + m.capRate!, 0) / withCapRate.length : null,
        avgCoCR: withCoCR.length > 0 ? withCoCR.reduce((s, m) => s + m.roi!, 0) / withCoCR.length : null,
        avgRentPerSqft: withRentPerSqft.length > 0 ? withRentPerSqft.reduce((s, m) => s + m.rentPerSqft!, 0) / withRentPerSqft.length : null,
        cashFlowPositive: cfPos,
        cashFlowNegative: cfNeg,
        properties: props,
      }
    })
    .sort((a, b) => {
      if (a.name === '(unspecified)') return 1
      if (b.name === '(unspecified)') return -1
      return (b.avgCapRate ?? 0) - (a.avgCapRate ?? 0)
    })
}

interface CityCountyAnalyticsProps {
  properties: Property[]
}

export default function CityCountyAnalytics({ properties }: CityCountyAnalyticsProps) {
  const [groupBy, setGroupBy] = useState<'city' | 'county'>('city')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available'>('available')

  const filtered = useMemo(() => {
    if (statusFilter === 'available') {
      return properties.filter(
        (p) => !p.listing_status || p.listing_status === '' || p.listing_status === 'Available'
      )
    }
    return properties
  }, [properties, statusFilter])

  const areaStats = useMemo(
    () => buildAreaStats(filtered, (p) => groupBy === 'city' ? (p.city ?? null) : (p.county ?? null)),
    [filtered, groupBy]
  )

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  if (properties.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No properties yet. <Link href="/apps/property/properties/new" className="text-primary underline">Add your first property</Link>.
      </div>
    )
  }

  const hasCityData = properties.some((p) => p.city)
  const hasCountyData = properties.some((p) => p.county)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">Group by:</span>
          {(['city', 'county'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize',
                groupBy === g
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {g}
              {g === 'city' && !hasCityData && ' (no data)'}
              {g === 'county' && !hasCountyData && ' (no data)'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status:</span>
          {([['available', 'Available only'], ['all', 'All']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === val
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground capitalize">{groupBy}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"># Props</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg Price</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg Cap Rate</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg CoCR</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rent /SqFt</th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CF +/−</th>
            </tr>
          </thead>
          <tbody>
            {areaStats.map((area, i) => (
              <tr key={area.name} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                <td className="px-4 py-2.5 font-medium">
                  {area.name === '(unspecified)' ? (
                    <span className="text-muted-foreground italic">{area.name}</span>
                  ) : area.name}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{area.count}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{area.avgPrice != null ? fmt(area.avgPrice) : '—'}</td>
                <td className={cn('px-4 py-2.5 text-right tabular-nums font-medium',
                  area.avgCapRate == null ? 'text-muted-foreground' :
                  area.avgCapRate >= 8 ? 'text-emerald-600 dark:text-emerald-400' :
                  area.avgCapRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
                )}>
                  {area.avgCapRate != null ? `${area.avgCapRate.toFixed(2)}%` : '—'}
                </td>
                <td className={cn('px-4 py-2.5 text-right tabular-nums font-medium',
                  area.avgCoCR == null ? 'text-muted-foreground' :
                  area.avgCoCR >= 10 ? 'text-emerald-600 dark:text-emerald-400' :
                  area.avgCoCR >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
                )}>
                  {area.avgCoCR != null ? `${area.avgCoCR.toFixed(1)}%` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {area.avgRentPerSqft != null ? `$${area.avgRentPerSqft.toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">{area.cashFlowPositive}+</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-destructive">{area.cashFlowNegative}−</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {areaStats.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No data to display for this grouping. Make sure properties have {groupBy} filled in.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Sorted by avg cap rate. Analysis assumes {DEFAULT_DOWN_PAYMENT_PCT}% down, {DEFAULT_LOAN_TERM}-yr loan at {DEFAULT_ANALYSIS_INTEREST_RATE}%, {DEFAULT_CLOSING_COST_PCT}% closing costs.
      </p>
    </div>
  )
}

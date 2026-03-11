'use client'

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
import { type ScoringConfig, computeScoreOnly } from '@/lib/property/scoring'
import { useScoringConfig } from '@/components/property/scoring-context'

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
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  plan_name?: string | null
  estimated_rent?: number | null
  estimated_cash_flow?: number | null
  created_at: string
}

interface PropertyCompareProps {
  properties: Property[]
}

function computeMetrics(p: Property, scoringConfig?: ScoringConfig) {
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
  let cashInvested = 0
  if (askingPrice > 0 && estAnnualNoi !== 0) {
    const loanAmount = askingPrice * (1 - downPct)
    cashInvested = downPayment + askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
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
  const expenseRatio = monthlyIncome > 0 && monthlyExpenses > 0 ? (monthlyExpenses / monthlyIncome) * 100 : null
  const annualGrossRent = monthlyIncome * MONTHS_PER_YEAR
  const grm = askingPrice > 0 && annualGrossRent > 0 ? askingPrice / annualGrossRent : null
  const onePercentRatio = askingPrice > 0 && monthlyIncome > 0 ? (monthlyIncome / askingPrice) * 100 : null
  const onePercentPass = onePercentRatio != null ? onePercentRatio >= 1 : null

  let score: number | null = null
  if (askingPrice > 0 && monthlyIncome > 0 && capRate != null && scoringConfig) {
    score = computeScoreOnly(scoringConfig, { capRate, roi, annualCashFlow, noiForCalcs: estAnnualNoi, onePercentRatio, grm })
  }

  // Debt Yield
  const loanAmount2 = askingPrice * (1 - downPct)
  const debtYield = loanAmount2 > 0 && estAnnualNoi > 0 ? (estAnnualNoi / loanAmount2) * 100 : null

  return {
    askingPrice, monthlyIncome, monthlyExpenses, downPayment, estAnnualNoi,
    annualCashFlow, monthlyCashFlow: annualCashFlow / MONTHS_PER_YEAR,
    capRate, roi, pricePerSqft, rentPerSqft, expenseRatio, grm, onePercentRatio, onePercentPass,
    score, debtYield, cashInvested,
  }
}

type Metric = {
  label: string
  key: string
  format: (v: number | null, idx: number) => string
  higherBetter?: boolean
  lowerBetter?: boolean
  colorFn?: (v: number | null) => string
}

const METRICS: Metric[] = [
  {
    label: 'Investment Score',
    key: 'score',
    higherBetter: true,
    format: (v) => v != null ? `${v}/100` : '—',
    colorFn: (v) => v == null ? '' : v >= 70 ? 'text-emerald-600 dark:text-emerald-400' : v >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive',
  },
  {
    label: 'Asking Price',
    key: 'askingPrice',
    lowerBetter: true,
    format: (v) => v != null && v > 0 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
  },
  {
    label: 'Down Payment',
    key: 'downPayment',
    lowerBetter: true,
    format: (v) => v != null && v > 0 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
  },
  {
    label: 'Rent /mo',
    key: 'monthlyIncome',
    higherBetter: true,
    format: (v) => v != null && v > 0 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
  },
  {
    label: 'Cash Flow /mo',
    key: 'monthlyCashFlow',
    higherBetter: true,
    format: (v) => v != null && v !== 0 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
    colorFn: (v) => v == null ? '' : v > 0 ? 'text-emerald-600 dark:text-emerald-400' : v < 0 ? 'text-destructive' : '',
  },
  {
    label: 'Annual NOI',
    key: 'estAnnualNoi',
    higherBetter: true,
    format: (v) => v != null && v !== 0 ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
  },
  {
    label: 'Cap Rate',
    key: 'capRate',
    higherBetter: true,
    format: (v) => v != null ? `${v.toFixed(2)}%` : '—',
    colorFn: (v) => v == null ? '' : v >= 8 ? 'text-emerald-600 dark:text-emerald-400' : v >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive',
  },
  {
    label: 'ROI (CoCR)',
    key: 'roi',
    higherBetter: true,
    format: (v) => v != null ? `${v.toFixed(1)}%` : '—',
    colorFn: (v) => v == null ? '' : v >= 10 ? 'text-emerald-600 dark:text-emerald-400' : v >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive',
  },
  {
    label: '1% Rule',
    key: 'onePercentRatio',
    higherBetter: true,
    format: (v) => v != null ? `${v.toFixed(2)}%` : '—',
    colorFn: (v) => v == null ? '' : v >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
  },
  {
    label: 'GRM',
    key: 'grm',
    lowerBetter: true,
    format: (v) => v != null ? v.toFixed(1) : '—',
    colorFn: (v) => v == null ? '' : v < 10 ? 'text-emerald-600 dark:text-emerald-400' : v <= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive',
  },
  {
    label: 'Expense Ratio',
    key: 'expenseRatio',
    lowerBetter: true,
    format: (v) => v != null ? `${v.toFixed(1)}%` : '—',
  },
  {
    label: 'Price / Sq Ft',
    key: 'pricePerSqft',
    lowerBetter: true,
    format: (v) => v != null ? `$${v.toFixed(0)}` : '—',
  },
  {
    label: 'Rent / Sq Ft',
    key: 'rentPerSqft',
    higherBetter: true,
    format: (v) => v != null ? `$${v.toFixed(2)}` : '—',
  },
  {
    label: 'Debt Yield',
    key: 'debtYield',
    higherBetter: true,
    format: (v) => v != null ? `${v.toFixed(2)}%` : '—',
  },
]

export default function PropertyCompare({ properties }: PropertyCompareProps) {
  const { config: scoringConfig } = useScoringConfig()
  const metrics = properties.map((p) => computeMetrics(p, scoringConfig))

  function getWinner(key: string, higherBetter?: boolean, lowerBetter?: boolean): number | null {
    const values = metrics.map((m) => (m as Record<string, number | null>)[key] as number | null)
    const valid = values.map((v, i) => ({ v, i })).filter(({ v }) => v != null && !isNaN(v as number))
    if (valid.length < 2) return null
    if (higherBetter) {
      return valid.reduce((best, cur) => (cur.v! > best.v! ? cur : best)).i
    }
    if (lowerBetter) {
      // For lower-is-better, ignore zeros (missing data)
      const nonZero = valid.filter(({ v }) => v! > 0)
      if (nonZero.length < 2) return null
      return nonZero.reduce((best, cur) => (cur.v! < best.v! ? cur : best)).i
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Property header cards */}
      <div className={cn('grid gap-4', properties.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {properties.map((p, i) => (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <Link
              href={`/apps/property/properties/${p.id}`}
              className="font-semibold text-primary hover:underline text-sm"
            >
              {p.address || 'No address'}
            </Link>
            {(p.city || p.county) && (
              <p className="text-xs text-muted-foreground mt-0.5">{[p.city, p.county].filter(Boolean).join(', ')}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
              {p.type && <span>{p.type}</span>}
              {p.bedrooms != null && <span>{p.bedrooms} bd</span>}
              {p.bathrooms != null && <span>{p.bathrooms} ba</span>}
              {p.sqft != null && <span>{p.sqft.toLocaleString()} sqft</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Metrics comparison table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground w-36">Metric</th>
              {properties.map((p, i) => (
                <th key={p.id} className="text-right px-4 py-3 text-xs font-semibold">
                  <Link href={`/apps/property/properties/${p.id}`} className="text-primary hover:underline">
                    {p.address ? p.address.split(',')[0] : `Property ${i + 1}`}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric, mi) => {
              const winnerIdx = getWinner(metric.key, metric.higherBetter, metric.lowerBetter)
              return (
                <tr key={metric.key} className={cn('border-b last:border-0', mi % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium whitespace-nowrap">{metric.label}</td>
                  {metrics.map((m, i) => {
                    const rawVal = (m as Record<string, number | null>)[metric.key] as number | null
                    const formatted = metric.format(rawVal, i)
                    const isWinner = winnerIdx === i
                    const colorClass = metric.colorFn ? metric.colorFn(rawVal) : ''
                    return (
                      <td
                        key={properties[i].id}
                        className={cn(
                          'px-4 py-2.5 text-right tabular-nums font-medium',
                          colorClass,
                          isWinner && !colorClass && 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        <span className={cn(isWinner && 'font-bold')}>
                          {formatted}
                        </span>
                        {isWinner && formatted !== '—' && (
                          <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400">★</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        ★ indicates the best value for that metric. Analysis assumes {DEFAULT_DOWN_PAYMENT_PCT}% down, {DEFAULT_LOAN_TERM}-yr loan at {DEFAULT_ANALYSIS_INTEREST_RATE}%, {DEFAULT_CLOSING_COST_PCT}% closing costs.
      </p>
    </div>
  )
}

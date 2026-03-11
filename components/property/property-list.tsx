'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { Building2, Search, X, SlidersHorizontal, ArrowDown, ArrowUp, ArrowUpDown, GitCompareArrows } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_CLOSING_COST_PCT,
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_EXPENSE_RATIO,
  DEFAULT_LOAN_TERM,
  MONTHS_PER_YEAR,
  PROPERTY_STATUSES,
} from '@/lib/constants/property-defaults'
import { type ScoringConfig, computeScoreOnly } from '@/lib/property/scoring'
import { useScoringConfig } from '@/components/property/scoring-context'
import ScoringSettings from '@/components/property/scoring-settings'

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
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  plan_name?: string | null
  estimated_rent?: number | null
  estimated_cash_flow?: number | null
  additional_info?: string | null
  import_load_id?: string | null
  created_at: string
}

interface ImportLoad {
  id: string
  name: string
}

interface PropertyListProps {
  properties: Property[]
  loads?: ImportLoad[]
  initialLoadFilter?: string | null
}

type SortKey = 'address' | 'price' | 'capRate' | 'noi' | 'estNoi' | 'roi' | 'downPayment' | 'date' | 'bedrooms' | 'sqft' | 'grm' | 'pricePerSqft' | 'rentPerSqft' | 'expenseRatio' | 'onePercentRatio' | 'score'
type SortDir = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Leased: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

/** Tooltip content showing formula for each calculated column */
const COLUMN_FORMULAS: Record<string, string> = {
  price: 'Asking / list price (stored).',
  downPayment: `Down Payment = Asking Price × ${DEFAULT_DOWN_PAYMENT_PCT}%\nExample: $400,000 × 0.25 = $100,000`,
  rent: 'Rent /mo = Estimated Rent or Gross Income (stored monthly value).',
  expenses: 'Expenses /mo = Operating Expenses (stored monthly value).',
  estNoi: `Est. NOI /yr:\n• With income & expenses: (Rent − Expenses) × 12\n• From rent only: Est. Rent × 12 × (1 − ${DEFAULT_EXPENSE_RATIO * 100}% expense ratio) = Est. Rent × 12 × 0.6`,
  capRate: 'Cap Rate = (Est. NOI /yr) ÷ Asking Price × 100\nExample: $24,000 ÷ $400,000 = 6%',
  roi: `ROI (cash-on-cash) = (Annual NOI − Annual Debt Service) ÷ Cash Invested × 100\nCash Invested = Down Payment + ${DEFAULT_CLOSING_COST_PCT}% closing costs.\nLoan: ${100 - DEFAULT_DOWN_PAYMENT_PCT}% of price, ${DEFAULT_LOAN_TERM} yr, ${DEFAULT_ANALYSIS_INTEREST_RATE}% rate.`,
  cashFlow: `Cash Flow /mo = (Est. NOI /yr − Annual Debt Service) ÷ 12\nDebt Service = mortgage on ${100 - DEFAULT_DOWN_PAYMENT_PCT}% of price, ${DEFAULT_LOAN_TERM} yr, ${DEFAULT_ANALYSIS_INTEREST_RATE}% rate.`,
  grm: 'Gross Rent Multiplier = Asking Price ÷ Annual Gross Rent\nLower is better. < 10 is strong, 10–15 is fair, > 15 is weak.',
  pricePerSqft: 'Price per Sq Ft = Asking Price ÷ Sq Ft\nCompares value across properties of different sizes.',
  rentPerSqft: 'Rent per Sq Ft = Monthly Rent ÷ Sq Ft\nHigher means better rental efficiency.',
  expenseRatio: 'Expense Ratio = Monthly Expenses ÷ Monthly Gross Income × 100\nLower is better. Shows what % of income goes to expenses.',
  onePercent: '1% Rule: Monthly Rent ÷ Purchase Price × 100\nPasses (≥ 1%) means gross rent covers 1% of price per month — a common investor screening heuristic.',
  score: 'Investment Score (0–100) combines Cap Rate (25%), ROI/CoCR (25%), Cash Flow (20%), 1% Rule ratio (15%), GRM (15%).\nHigher is better. Requires price and income data.',
}

function computeMetrics(p: Property, scoringConfig?: ScoringConfig) {
  const askingPrice = p['Asking Price'] || 0

  // All stored values are monthly
  const monthlyGross = p['Gross Income'] || 0
  const monthlyExpenses = p['Operating Expenses'] || 0
  const monthlyRent = p.estimated_rent || 0
  const monthlyCashFlow = p.estimated_cash_flow || 0
  const monthlyIncome = monthlyRent > 0 ? monthlyRent : monthlyGross

  const hasActuals = monthlyGross > 0
  const annualNoi = hasActuals
    ? (monthlyGross - monthlyExpenses) * MONTHS_PER_YEAR
    : 0
  const estAnnualNoi = hasActuals
    ? annualNoi
    : monthlyRent > 0 && monthlyExpenses > 0
      ? (monthlyRent - monthlyExpenses) * MONTHS_PER_YEAR
      : monthlyRent > 0
        ? monthlyRent * MONTHS_PER_YEAR * (1 - DEFAULT_EXPENSE_RATIO)
        : monthlyExpenses > 0
          ? -monthlyExpenses * MONTHS_PER_YEAR
          : 0
  const noiForCalcs = hasActuals ? annualNoi : estAnnualNoi

  const capRate = askingPrice > 0 && noiForCalcs > 0 ? (noiForCalcs / askingPrice) * 100 : 0

  // Default loan: 25% down, 30 yr, default rate
  const downPct = DEFAULT_DOWN_PAYMENT_PCT / 100
  const downPayment = askingPrice > 0 ? askingPrice * downPct : 0
  let roi: number | null = null
  let annualDebt = 0
  let cashInvested = 0
  let annualCashFlow = 0
  if (askingPrice > 0 && noiForCalcs !== 0) {
    const loanAmount = askingPrice * (1 - downPct)
    cashInvested = downPayment + askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
    if (loanAmount > 0 && cashInvested > 0) {
      const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
      const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
      const monthlyPayment =
        loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      annualDebt = monthlyPayment * MONTHS_PER_YEAR
      annualCashFlow = noiForCalcs - annualDebt
      roi = (annualCashFlow / cashInvested) * 100
    }
  }

  const estMonthlyCashFlow = annualCashFlow !== 0
    ? annualCashFlow / MONTHS_PER_YEAR
    : monthlyCashFlow

  // ── New Tier 1 metrics ──
  const annualGrossRent = monthlyIncome * MONTHS_PER_YEAR
  const grm = askingPrice > 0 && annualGrossRent > 0 ? askingPrice / annualGrossRent : null
  const sqft = p.sqft && p.sqft > 0 ? p.sqft : null
  const pricePerSqft = askingPrice > 0 && sqft ? askingPrice / sqft : null
  const rentPerSqft = monthlyIncome > 0 && sqft ? monthlyIncome / sqft : null
  const expenseRatio = monthlyIncome > 0 && monthlyExpenses > 0 ? (monthlyExpenses / monthlyIncome) * 100 : null
  const onePercentRatio = askingPrice > 0 && monthlyIncome > 0 ? (monthlyIncome / askingPrice) * 100 : null
  const onePercentPass = onePercentRatio != null ? onePercentRatio >= 1 : null

  // ── Investment Score (0–100) — uses shared scoring config ──
  let score: number | null = null
  if (askingPrice > 0 && monthlyIncome > 0 && scoringConfig) {
    score = computeScoreOnly(scoringConfig, { capRate, roi, annualCashFlow, noiForCalcs, onePercentRatio, grm })
  }

  return {
    monthlyGross, monthlyExpenses, monthlyRent, monthlyCashFlow, estMonthlyCashFlow,
    annualNoi, estAnnualNoi, askingPrice, capRate, downPayment, roi,
    annualDebt, cashInvested, annualCashFlow, hasActuals, noiForCalcs,
    grm, pricePerSqft, rentPerSqft, expenseRatio, onePercentRatio, onePercentPass, score,
  }
}

function buildNoiTooltip(p: Property, m: ReturnType<typeof computeMetrics>): string {
  if (m.estAnnualNoi === 0 && !m.hasActuals && m.monthlyRent <= 0) return 'No income or expense data.'
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  const incomeDisplay = m.monthlyGross > 0 ? m.monthlyGross : m.monthlyRent
  if (m.hasActuals) {
    const monthlyNoi = m.monthlyGross - m.monthlyExpenses
    const incomeLabel = m.monthlyGross > 0 ? 'Income' : 'Est. Rent'
    return `${incomeLabel} $${fmt(incomeDisplay)} − Expenses $${fmt(m.monthlyExpenses)} = $${fmt(monthlyNoi)}/mo × 12 = $${fmt(m.estAnnualNoi)}/yr`
  }
  if (m.monthlyRent > 0 && m.monthlyExpenses > 0) {
    const monthlyNoi = m.monthlyRent - m.monthlyExpenses
    return `Est. Rent $${fmt(m.monthlyRent)} − Expenses $${fmt(m.monthlyExpenses)} = $${fmt(monthlyNoi)}/mo × 12 = $${fmt(m.estAnnualNoi)}/yr`
  }
  if (m.monthlyRent > 0) {
    const annualRent = m.monthlyRent * MONTHS_PER_YEAR
    const expensePct = DEFAULT_EXPENSE_RATIO * 100
    return `Est. Rent $${fmt(m.monthlyRent)}/mo × 12 = $${fmt(annualRent)}/yr × (1 − ${expensePct}%) = $${fmt(m.estAnnualNoi)}/yr`
  }
  return `Est. NOI = $${fmt(m.estAnnualNoi)}/yr`
}

function buildRoiTooltip(p: Property, m: ReturnType<typeof computeMetrics>): string {
  if (m.roi == null || m.cashInvested <= 0) return 'ROI requires price and NOI.'
  const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return `NOI $${fmt(m.noiForCalcs)} − Annual Debt $${fmt(m.annualDebt)} = $${fmt(m.annualCashFlow)} ÷ Cash Invested $${fmt(m.cashInvested)} = ${m.roi.toFixed(1)}%`
}

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (score >= 45) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}

function capRateColor(rate: number): string {
  if (rate >= 8) return 'text-emerald-600 dark:text-emerald-400'
  if (rate >= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

function cocrColor(cocr: number): string {
  if (cocr >= 10) return 'text-emerald-600 dark:text-emerald-400'
  if (cocr >= 5) return 'text-amber-600 dark:text-amber-400'
  return 'text-destructive'
}

export default function PropertyList({ properties, loads = [], initialLoadFilter }: PropertyListProps) {
  const { config: scoringConfig } = useScoringConfig()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Available')
  const [loadFilter, setLoadFilter] = useState(initialLoadFilter ?? '')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [showAllColumns, setShowAllColumns] = useState(false)
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set())

  const types = useMemo(() => [...new Set(properties.map((p) => p.type).filter(Boolean) as string[])], [properties])

  const filtered = useMemo(() => {
    let result = [...properties]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) =>
        (p.address ?? '').toLowerCase().includes(q) ||
        (p.mls_number ?? '').toLowerCase().includes(q) ||
        (p.source ?? '').toLowerCase().includes(q)
      )
    }
    if (typeFilter) result = result.filter((p) => p.type === typeFilter)
    if (statusFilter && statusFilter !== 'All') {
      if (statusFilter === 'Available') {
        result = result.filter((p) => !p.listing_status || p.listing_status === '' || p.listing_status === 'Available')
      } else {
        result = result.filter((p) => p.listing_status === statusFilter)
      }
    }
    if (loadFilter) result = result.filter((p) => p.import_load_id === loadFilter)

    result.sort((a, b) => {
      const mA = computeMetrics(a, scoringConfig)
      const mB = computeMetrics(b, scoringConfig)
      let cmp = 0
      switch (sortKey) {
        case 'address': cmp = (a.address ?? '').localeCompare(b.address ?? ''); break
        case 'price': cmp = mA.askingPrice - mB.askingPrice; break
        case 'capRate': cmp = mA.capRate - mB.capRate; break
        case 'noi': cmp = mA.annualNoi - mB.annualNoi; break
        case 'estNoi': cmp = mA.estAnnualNoi - mB.estAnnualNoi; break
        case 'roi': cmp = (mA.roi ?? -Infinity) - (mB.roi ?? -Infinity); break
        case 'downPayment': cmp = mA.downPayment - mB.downPayment; break
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
        case 'bedrooms': cmp = (a.bedrooms ?? 0) - (b.bedrooms ?? 0); break
        case 'sqft': cmp = (a.sqft ?? 0) - (b.sqft ?? 0); break
        case 'grm': cmp = (mA.grm ?? Infinity) - (mB.grm ?? Infinity); break
        case 'pricePerSqft': cmp = (mA.pricePerSqft ?? Infinity) - (mB.pricePerSqft ?? Infinity); break
        case 'rentPerSqft': cmp = (mA.rentPerSqft ?? 0) - (mB.rentPerSqft ?? 0); break
        case 'expenseRatio': cmp = (mA.expenseRatio ?? Infinity) - (mB.expenseRatio ?? Infinity); break
        case 'onePercentRatio': cmp = (mA.onePercentRatio ?? 0) - (mB.onePercentRatio ?? 0); break
        case 'score': cmp = (mA.score ?? 0) - (mB.score ?? 0); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })

    return result
  }, [properties, search, typeFilter, statusFilter, loadFilter, sortKey, sortDir, scoringConfig])

  const activeFilterCount = [typeFilter, loadFilter].filter(Boolean).length

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'address' ? 'asc' : 'desc')
    }
  }

  function clearAllFilters() {
    setSearch('')
    setTypeFilter('')
    setStatusFilter('Available')
    setLoadFilter('')
  }

  function toggleCompare(id: number) {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id)
      return next
    })
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        message="No properties yet"
        description="Add your first property or import from a file to get started."
      />
    )
  }

  const selectClass = 'rounded-md border border-input bg-background px-3 py-1.5 text-sm'
  const compareList = filtered.filter((p) => compareIds.has(p.id))

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, MLS #, source..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm"
          />
        </div>

        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px]">{activeFilterCount}</Badge>
          )}
        </Button>

        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showAllColumns}
            onChange={(e) => setShowAllColumns(e.target.checked)}
            className="rounded border-input"
          />
          Show all columns
        </label>

        <select
          value={`${sortKey}-${sortDir}`}
          onChange={(e) => {
            const [k, d] = e.target.value.split('-') as [SortKey, SortDir]
            setSortKey(k); setSortDir(d)
          }}
          className={selectClass}
        >
          <option value="score-desc">Score: Best first</option>
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="price-desc">Price: High → Low</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="capRate-desc">Cap Rate: High → Low</option>
          <option value="capRate-asc">Cap Rate: Low → High</option>
          <option value="roi-desc">ROI: High → Low</option>
          <option value="roi-asc">ROI: Low → High</option>
          <option value="grm-asc">GRM: Lowest first</option>
          <option value="onePercentRatio-desc">1% Rule: Best first</option>
          <option value="expenseRatio-asc">Expense Ratio: Lowest first</option>
          <option value="pricePerSqft-asc">Price/SqFt: Lowest first</option>
          <option value="rentPerSqft-desc">Rent/SqFt: Highest first</option>
          <option value="noi-desc">NOI: High → Low</option>
          <option value="estNoi-desc">Est. NOI: High → Low</option>
          <option value="downPayment-desc">Down Payment: High → Low</option>
          <option value="address-asc">Address: A → Z</option>
          <option value="address-desc">Address: Z → A</option>
          <option value="bedrooms-desc">Beds: Most first</option>
          <option value="sqft-desc">Sq Ft: Largest first</option>
        </select>

        <ScoringSettings />
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          {types.length > 0 && (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
              <option value="">All Types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {loads.length > 0 && (
            <select value={loadFilter} onChange={(e) => setLoadFilter(e.target.value)} className={selectClass}>
              <option value="">All Imports</option>
              {loads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Status filter: right above the table */}
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground mr-2">Status:</span>
        {(['Available', 'Sold', 'Leased', 'All'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === status
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Compare bar */}
      {compareIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-primary/5 border-primary/20 p-3">
          <GitCompareArrows className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">
            {compareIds.size} {compareIds.size === 1 ? 'property' : 'properties'} selected to compare
            {compareIds.size < 2 && ' — select 2–3 to compare'}
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            {compareIds.size >= 2 && (
              <Button
                size="sm"
                variant="default"
                className="text-xs"
                onClick={() => {
                  const ids = Array.from(compareIds).join(',')
                  window.location.href = `/apps/property/compare?ids=${ids}`
                }}
              >
                Compare Properties
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setCompareIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {properties.length} properties
      </p>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No properties match your filters.
        </div>
      ) : (
        <TableView
          properties={filtered}
          showAllColumns={showAllColumns}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
          scoringConfig={scoringConfig}
        />
      )}
    </div>
  )
}

function SortableHeader({
  label,
  formulaKey,
  sortKey,
  sortDir,
  currentKey,
  onSort,
  align = 'left',
}: {
  label: string
  formulaKey: string
  sortKey: SortKey
  sortDir: SortDir
  currentKey: SortKey
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = sortKey === currentKey
  const formula = COLUMN_FORMULAS[formulaKey]
  const content = (
    <button
      type="button"
      onClick={() => onSort(currentKey)}
      className={cn(
        'flex items-center gap-1.5 w-full text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors select-none',
        align === 'right' && 'justify-end'
      )}
    >
      {label}
      {isActive ? (
        sortDir === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />
      )}
    </button>
  )
  if (formula) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
          {formula}
        </TooltipContent>
      </Tooltip>
    )
  }
  return content
}

function TableView({
  properties,
  showAllColumns,
  sortKey,
  sortDir,
  onSort,
  compareIds,
  onToggleCompare,
  scoringConfig,
}: {
  properties: Property[]
  showAllColumns: boolean
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  compareIds: Set<number>
  onToggleCompare: (id: number) => void
  scoringConfig: ScoringConfig
}) {
  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="py-3 w-8"></TableHead>
            <TableHead className="py-3">
              <SortableHeader
                label="Address"
                formulaKey=""
                currentKey="address"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
              />
            </TableHead>
            <TableHead className="py-3 text-center">
              <SortableHeader
                label="Score"
                formulaKey="score"
                currentKey="score"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className="py-3">Type</TableHead>
            <TableHead className="py-3 text-right">
              <SortableHeader
                label="Price"
                formulaKey="price"
                currentKey="price"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className="py-3 text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center justify-end text-xs font-semibold uppercase tracking-wider cursor-help">Rent /mo</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
                  {COLUMN_FORMULAS.rent}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="py-3 text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 justify-end text-xs font-semibold uppercase tracking-wider cursor-help">
                    Cash Flow /mo
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
                  {COLUMN_FORMULAS.cashFlow}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="py-3 text-right">
              <SortableHeader
                label="Cap Rate"
                formulaKey="capRate"
                currentKey="capRate"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className="py-3 text-right">
              <SortableHeader
                label="ROI"
                formulaKey="roi"
                currentKey="roi"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className="py-3 text-right">
              <SortableHeader
                label="1% Rule"
                formulaKey="onePercent"
                currentKey="onePercentRatio"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className="py-3 text-right">
              <SortableHeader
                label="GRM"
                formulaKey="grm"
                currentKey="grm"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            {/* Extended columns */}
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <SortableHeader
                label="Exp Ratio"
                formulaKey="expenseRatio"
                currentKey="expenseRatio"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <SortableHeader
                label="$/SqFt"
                formulaKey="pricePerSqft"
                currentKey="pricePerSqft"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <SortableHeader
                label="Rent/SqFt"
                formulaKey="rentPerSqft"
                currentKey="rentPerSqft"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <SortableHeader
                label="NOI /yr"
                formulaKey="estNoi"
                currentKey="estNoi"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <SortableHeader
                label="Down Pmt"
                formulaKey="downPayment"
                currentKey="downPayment"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </TableHead>
            <TableHead className={cn('py-3', !showAllColumns && 'hidden')}>Community</TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <button
                type="button"
                onClick={() => onSort('bedrooms')}
                className="flex items-center gap-1.5 w-full justify-end text-xs font-semibold uppercase tracking-wider hover:text-foreground"
              >
                Beds
                {sortKey === 'bedrooms' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
              </button>
            </TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>Baths</TableHead>
            <TableHead className={cn('py-3 text-right', !showAllColumns && 'hidden')}>
              <button
                type="button"
                onClick={() => onSort('sqft')}
                className="flex items-center gap-1.5 w-full justify-end text-xs font-semibold uppercase tracking-wider hover:text-foreground"
              >
                Sq Ft
                {sortKey === 'sqft' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
              </button>
            </TableHead>
            <TableHead className={cn('py-3', !showAllColumns && 'hidden')}>
              <button
                type="button"
                onClick={() => onSort('date')}
                className="flex items-center gap-1.5 w-full text-xs font-semibold uppercase tracking-wider hover:text-foreground"
              >
                Date
                {sortKey === 'date' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((property) => {
            const m = computeMetrics(property, scoringConfig)
            const isComparing = compareIds.has(property.id)
            return (
              <React.Fragment key={property.id}>
              <TableRow className={cn(isComparing && 'bg-primary/5')}>
                <TableCell className="py-2 w-8">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <input
                        type="checkbox"
                        checked={isComparing}
                        onChange={() => onToggleCompare(property.id)}
                        className="rounded border-input cursor-pointer accent-primary"
                        aria-label="Select for comparison"
                      />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {isComparing ? 'Remove from comparison' : 'Add to comparison (max 3)'}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="py-2">
                  <Link href={`/apps/property/properties/${property.id}`} className="text-primary hover:underline font-medium">
                    {property.address || 'No address'}
                  </Link>
                </TableCell>
                <TableCell className="py-2 text-center">
                  {m.score != null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className={cn('text-[11px] font-bold cursor-help', scoreColor(m.score))}>
                          {m.score}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
                        {COLUMN_FORMULAS.score}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell className="py-2">{property.type ?? '—'}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{m.askingPrice > 0 ? fmt(m.askingPrice) : '—'}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {m.monthlyRent > 0 ? fmt(m.monthlyRent) : m.monthlyGross > 0 ? fmt(m.monthlyGross) : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums font-medium', m.estMonthlyCashFlow > 0 ? 'text-emerald-600 dark:text-emerald-400' : m.estMonthlyCashFlow < 0 ? 'text-destructive' : '')}>
                  {m.estMonthlyCashFlow !== 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/50">{fmt(m.estMonthlyCashFlow)}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm whitespace-pre-line text-xs">
                        {`NOI ${fmt(m.noiForCalcs)}/yr − Debt ${fmt(m.annualDebt)}/yr = ${fmt(m.annualCashFlow)}/yr ÷ 12 = ${fmt(m.estMonthlyCashFlow)}/mo`}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums font-medium', m.capRate > 0 ? capRateColor(m.capRate) : '')}>
                  {m.capRate > 0 ? `${m.capRate.toFixed(2)}%` : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums font-medium', m.roi != null ? cocrColor(m.roi) : '')}>
                  {m.roi != null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/50">{m.roi.toFixed(1)}%</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm whitespace-pre-line text-xs">
                        {buildRoiTooltip(property, m)}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {m.onePercentRatio != null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('cursor-help font-medium', m.onePercentPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                          {m.onePercentRatio.toFixed(2)}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
                        {COLUMN_FORMULAS.onePercent}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell className="py-2 text-right tabular-nums">
                  {m.grm != null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={cn('cursor-help', m.grm < 10 ? 'text-emerald-600 dark:text-emerald-400' : m.grm <= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive')}>
                          {m.grm.toFixed(1)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs">
                        {COLUMN_FORMULAS.grm}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                {/* Extended columns */}
                <TableCell className={cn('py-2 text-right tabular-nums', !showAllColumns && 'hidden')}>
                  {m.expenseRatio != null ? (
                    <span className={m.expenseRatio > 60 ? 'text-destructive' : m.expenseRatio > 40 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      {m.expenseRatio.toFixed(1)}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums', !showAllColumns && 'hidden')}>
                  {m.pricePerSqft != null ? `$${m.pricePerSqft.toFixed(0)}` : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums', !showAllColumns && 'hidden')}>
                  {m.rentPerSqft != null ? `$${m.rentPerSqft.toFixed(2)}` : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums', m.estAnnualNoi < 0 ? 'text-destructive' : '', !showAllColumns && 'hidden')}>
                  {m.estAnnualNoi !== 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dotted border-muted-foreground/50">{fmt(m.estAnnualNoi)}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm whitespace-pre-line text-xs">
                        {buildNoiTooltip(property, m)}
                      </TooltipContent>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums', !showAllColumns && 'hidden')}>{m.downPayment > 0 ? fmt(m.downPayment) : '—'}</TableCell>
                <TableCell className={cn('py-2', !showAllColumns && 'hidden')}>{property.community ?? '—'}</TableCell>
                <TableCell className={cn('py-2 text-right', !showAllColumns && 'hidden')}>{property.bedrooms ?? '—'}</TableCell>
                <TableCell className={cn('py-2 text-right', !showAllColumns && 'hidden')}>{property.bathrooms ?? '—'}</TableCell>
                <TableCell className={cn('py-2 text-right tabular-nums', !showAllColumns && 'hidden')}>{property.sqft ? property.sqft.toLocaleString() : '—'}</TableCell>
                <TableCell className={cn('py-2 text-xs text-muted-foreground whitespace-nowrap', !showAllColumns && 'hidden')}>
                  {new Date(property.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
              {!showAllColumns && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={20} className="py-1.5 px-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Community:</span> {property.community ?? '—'}
                    <span className="mx-2">·</span>
                    <span className="font-medium text-foreground/80">Beds:</span> {property.bedrooms ?? '—'}
                    <span className="mx-2">·</span>
                    <span className="font-medium text-foreground/80">Baths:</span> {property.bathrooms ?? '—'}
                    <span className="mx-2">·</span>
                    <span className="font-medium text-foreground/80">Sq Ft:</span> {property.sqft ? property.sqft.toLocaleString() : '—'}
                    <span className="mx-2">·</span>
                    <span className="font-medium text-foreground/80">Date:</span> {new Date(property.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

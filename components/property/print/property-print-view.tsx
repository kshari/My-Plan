'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Clock, CheckCircle, X } from 'lucide-react'
import {
  computeScenarioMetrics, fmtDollar, fmtCompact,
  type ScenarioMetrics,
} from '@/lib/property/compute-metrics'
import { computeInvestmentScore, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'
import PLTable from '@/components/property/pl-table'
import AmortizationTable from '@/components/property/amortization-table'
import { cn } from '@/lib/utils'
import {
  DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_ANALYSIS_INTEREST_RATE,
  DEFAULT_LOAN_TERM,
  DEFAULT_CLOSING_COST_PCT,
} from '@/lib/constants/property-defaults'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  type: string | null
  'Number of Units'?: number | null
  'Has HOA'?: boolean | null
  swimming_pool?: boolean | null
  'Asking Price': number | null
  listing_status?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  plan_name?: string | null
  notes?: string | null
  source?: string | null
  mls_number?: string | null
  created_at: string
}

type ScenarioRow = Record<string, unknown> & { id: number; created_at: string }

export interface PropertyPrintViewProps {
  property: Property
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'property-info',  label: 'Property Information',      desc: 'Address, specs, listing details, defaults, notes' },
  { id: 'scenarios',      label: 'Scenario Details',           desc: 'Assumptions & key metrics for every scenario' },
  { id: 'projections',    label: 'Year-by-Year Projections',   desc: 'Income, expenses, cash flow, equity, IRR — all scenarios' },
  { id: 'amortization',   label: 'Amortization Schedules',     desc: 'Loan payment breakdown (for financed scenarios)' },
  { id: 'sensitivity',    label: 'What-If Sensitivity',        desc: 'Heatmap showing cash flow across variable changes' },
]

const AUTO_PRINT_DELAY_MS = 20_000

const EXPENSE_LABELS: Record<string, string> = {
  property_tax:       'Property Tax',
  insurance:          'Insurance',
  cdd:                'CDD',
  hoa:                'HOA',
  maintenance:        'Maintenance',
  property_management:'Property Mgmt',
  other:              'Other',
}

// ─── Sensitivity heatmap (shared logic, duplicated from deal-workspace) ───────

const HEATMAP_STEPS = [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25] as const

interface HeatmapRow {
  label: string
  sublabel: string
  applyStep: (s: Record<string, unknown>, step: number) => Record<string, unknown>
  formatStep: (step: number) => string
  varValue: (s: Record<string, unknown>, step: number) => string
}

const HEATMAP_ROWS: HeatmapRow[] = [
  {
    label: 'Purchase Price', sublabel: '% change',
    applyStep: (s, step) => {
      const p = +(s['Purchase Price'] ?? 0) || 0
      return { ...s, 'Purchase Price': p * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => fmtCompact(+(s['Purchase Price'] ?? 0) * (1 + step / 100)),
  },
  {
    label: 'Gross Rent', sublabel: '% change',
    applyStep: (s, step) => {
      const g = +(s['Gross Income'] ?? 0) || 0
      return { ...s, 'Gross Income': g * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => `${fmtCompact(+(s['Gross Income'] ?? 0) * (1 + step / 100) / 12)}/mo`,
  },
  {
    label: 'Operating Expenses', sublabel: '% change',
    applyStep: (s, step) => {
      const o = +(s['Operating Expenses'] ?? 0) || 0
      return { ...s, 'Operating Expenses': o * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => `${fmtCompact(+(s['Operating Expenses'] ?? 0) * (1 + step / 100) / 12)}/mo`,
  },
  {
    label: 'Interest Rate', sublabel: '±ppt (÷10)',
    applyStep: (s, step) => {
      const r = +(s['Interest Rate'] ?? 0) || 0
      return { ...s, 'Interest Rate': Math.max(0, r + step / 10) }
    },
    formatStep: step => { const p = step / 10; return `${p > 0 ? '+' : ''}${p.toFixed(1)}` },
    varValue: (s, step) => `${Math.max(0, +(s['Interest Rate'] ?? 0) + step / 10).toFixed(2)}%`,
  },
  {
    label: 'Down Payment', sublabel: '±ppt (÷2)',
    applyStep: (s, step) => {
      const base = +(s['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT) || DEFAULT_DOWN_PAYMENT_PCT
      const newPct = Math.max(0, Math.min(100, base + step / 2))
      const price = +(s['Purchase Price'] ?? 0) || 0
      return { ...s, 'Down Payment Percentage': newPct, 'Down Payment Amount': price * newPct / 100 }
    },
    formatStep: step => { const p = step / 2; return `${p > 0 ? '+' : ''}${p.toFixed(0)}` },
    varValue: (s, step) => {
      const base = +(s['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT) || DEFAULT_DOWN_PAYMENT_PCT
      return `${Math.max(0, Math.min(100, base + step / 2)).toFixed(0)}%`
    },
  },
  {
    label: 'Vacancy Rate', sublabel: '±ppt',
    applyStep: (s, step) => {
      const v = +(s['Vacancy Rate'] ?? 0) || 0
      return { ...s, 'Vacancy Rate': Math.max(0, Math.min(100, v + step / 5)) }
    },
    formatStep: step => { const p = step / 5; return `${p > 0 ? '+' : ''}${p.toFixed(1)}` },
    varValue: (s, step) => {
      const v = +(s['Vacancy Rate'] ?? 0) || 0
      return `${Math.max(0, Math.min(100, v + step / 5)).toFixed(1)}%`
    },
  },
]

function heatmapCellStyle(cf: number, maxAbsCF: number): React.CSSProperties {
  const nearZero = 100
  if (Math.abs(cf) <= nearZero) return { backgroundColor: 'hsl(45,90%,88%)', color: '#78350f' }
  const intensity = Math.min(1, (Math.abs(cf) - nearZero) / Math.max(maxAbsCF - nearZero, 500))
  const lightness = Math.round(92 - intensity * 56)
  if (cf > 0) return { backgroundColor: `hsl(142,65%,${lightness}%)`, color: lightness < 58 ? '#fff' : '#14532d' }
  return { backgroundColor: `hsl(0,78%,${lightness}%)`, color: lightness < 58 ? '#fff' : '#7f1d1d' }
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function scoreFor(m: ScenarioMetrics) {
  if (m.price <= 0 || m.income <= 0) return null
  return computeInvestmentScore(DEFAULT_SCORING_CONFIG, {
    capRate: m.capRate, roi: m.cocr, annualCashFlow: m.firstYearCF,
    noiForCalcs: m.noi, onePercentRatio: m.onePercent, grm: m.grm,
  }, v => fmtDollar(v)).score
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-xs font-medium text-gray-900 text-right ml-2', highlight && 'text-blue-700 font-semibold')}>{value}</span>
    </div>
  )
}

function SectionDivider({ label, desc, index }: { label: string; desc: string; index: number }) {
  return (
    <div className={`print-section-header ${index > 0 ? 'page-break-before' : ''}`}>
      <div className="flex items-baseline gap-3 pb-3 mb-4 border-b-2 border-gray-800">
        <span className="text-xs font-mono text-gray-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{label}</h2>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Property Information ───────────────────────────────────────────

function PropertyInfoSection({ property }: { property: Property }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">{property.address || 'Unknown Address'}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {property.city && <span className="text-sm text-gray-600">{property.city}</span>}
          {property.county && <span className="text-sm text-gray-600">{property.county} County</span>}
          {property.type && <span className="text-sm text-gray-600">{property.type}</span>}
          {property.community && <span className="text-sm text-gray-600">{property.community}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Property Specs */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Property Specs</h4>
          {property.bedrooms != null && <Row label="Bedrooms" value={String(property.bedrooms)} />}
          {property.bathrooms != null && <Row label="Bathrooms" value={String(property.bathrooms)} />}
          {property.sqft != null && <Row label="Square Feet" value={property.sqft.toLocaleString()} />}
          {property['Number of Units'] != null && <Row label="Units" value={String(property['Number of Units'])} />}
          {property['Has HOA'] != null && <Row label="HOA" value={property['Has HOA'] ? 'Yes' : 'No'} />}
          {property.swimming_pool != null && <Row label="Pool" value={property.swimming_pool ? 'Yes' : 'No'} />}
          {property.listing_status && <Row label="Status" value={property.listing_status} />}
          {property.source && <Row label="Source" value={property.source} />}
          {property.mls_number && <Row label="MLS #" value={property.mls_number} />}
          {property.plan_name && <Row label="Plan/Model" value={property.plan_name} />}
        </div>

        {/* Listing Price */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Listing</h4>
          <Row label="Asking Price" value={property['Asking Price'] != null ? fmtDollar(property['Asking Price']) : '—'} highlight />
          {property.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-gray-700 whitespace-pre-line">{property.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section: Scenario Details ────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  label,
  color,
  isBase,
}: {
  scenario: Record<string, unknown>
  label: string
  color: string
  isBase: boolean
}) {
  const m = computeScenarioMetrics(scenario)
  const score = scoreFor(m)
  const hasLoan = m.hasLoan

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Scenario header */}
      <div className="px-4 py-3 border-b border-gray-200" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {isBase ? 'Base (listing)' : 'Scenario'}
            </span>
            <h4 className="text-sm font-bold text-gray-900">{label}</h4>
          </div>
          {score != null && (
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Score</div>
              <div className={cn(
                'text-lg font-bold tabular-nums',
                score >= 70 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'
              )}>{score}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-gray-100">
        {/* Income */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Income</p>
          <Row label="Gross Rent / yr" value={fmtDollar(m.grossIncome)} />
          {m.vacancyRate > 0 && <Row label={`Vacancy (${m.vacancyRate}%)`} value={`-${fmtDollar(m.vacancyLoss)}`} />}
          <Row label="Effective Income / yr" value={fmtDollar(m.effectiveIncome)} />
        </div>

        {/* Expenses */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Expenses</p>
          <Row label="Oper. Expenses / yr" value={fmtDollar(m.opex)} />
          {m.propMgmtRate > 0 && <Row label={`Prop. Mgmt (${m.propMgmtRate}%)`} value={fmtDollar(m.propMgmtExpense)} />}
          <Row label="Total Expenses / yr" value={fmtDollar(m.totalExpenses)} />
          <Row label="Net Op. Income / yr" value={fmtDollar(m.noi)} highlight />
        </div>

        {/* Financing */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Financing</p>
          <Row label="Purchase Price" value={fmtDollar(m.price)} />
          {hasLoan ? (
            <>
              <Row label="Down Payment" value={`${fmtDollar(m.dp)} (${scenario['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT}%)`} />
              <Row label="Loan Amount" value={fmtDollar(m.principal)} />
              <Row label="Interest Rate" value={`${m.rate}%`} />
              <Row label="Loan Term" value={`${m.term} yrs`} />
              <Row label="Monthly Payment" value={fmtDollar(m.monthlyMortgage)} />
            </>
          ) : (
            <Row label="Purchase Type" value="All Cash" />
          )}
          <Row label="Total Cash Invested" value={fmtDollar(m.totalCashInvested)} highlight />
        </div>

        {/* Key Metrics */}
        <div className="p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Metrics</p>
          <Row label="Cap Rate" value={`${m.capRate.toFixed(2)}%`} />
          <Row label="Cash / mo" value={fmtDollar(m.monthlyCF)} highlight />
          <Row label="Cash-on-Cash" value={`${m.cocr.toFixed(2)}%`} />
          {m.dscr != null && <Row label="Debt Coverage" value={m.dscr.toFixed(2)} />}
          <Row label="Gross Rent Multiplier (Price ÷ Gross Rent)" value={m.grm > 0 ? `${m.grm.toFixed(1)}×` : '—'} />
          <Row label="1% Rule" value={m.onePercent > 0 ? `${m.onePercent.toFixed(2)}%` : '—'} />
        </div>
      </div>

      {/* Growth assumptions + vacancy/prop mgmt */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-6 flex-wrap">
        <span className="text-[10px] text-gray-500">
          Income Growth: <strong>{String(scenario['Income Increase'] ?? 3)}%/yr</strong>
        </span>
        <span className="text-[10px] text-gray-500">
          Expense Growth: <strong>{String(scenario['Expenses Increase'] ?? 3)}%/yr</strong>
        </span>
        <span className="text-[10px] text-gray-500">
          Appreciation: <strong>{String(scenario['Property Value Increase'] ?? 3)}%/yr</strong>
        </span>
        <span className="text-[10px] text-gray-500">
          Vacancy Rate: <strong>{String(scenario['Vacancy Rate'] ?? 0)}%</strong>
        </span>
        <span className="text-[10px] text-gray-500">
          Prop. Mgmt Rate: <strong>{String(scenario['Property Management Rate'] ?? 0)}% of eff. income</strong>
        </span>
      </div>
    </div>
  )
}

function ScenariosSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']
  const allScenarios: Array<{ scenario: Record<string, unknown>; label: string; color: string; isBase: boolean }> = [
    { scenario: baseScenario, label: 'Base (listing)', color: '#6b7280', isBase: true },
    ...scenarios.map((s, i) => ({
      scenario: s,
      label: String(s['Scenario Name'] || `Scenario #${s.id}`),
      color: COLORS[i % COLORS.length],
      isBase: false,
    })),
  ]

  return (
    <div className="space-y-4">
      {allScenarios.map(({ scenario, label, color, isBase }) => (
        <ScenarioCard
          key={isBase ? 'base' : (scenario as ScenarioRow).id}
          scenario={scenario}
          label={label}
          color={color}
          isBase={isBase}
        />
      ))}
    </div>
  )
}

// ─── Section: Projections ─────────────────────────────────────────────────────

function ProjectionsSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  const allScenarios: Array<{ scenario: Record<string, unknown>; label: string }> = [
    { scenario: baseScenario, label: 'Base (listing)' },
    ...scenarios.map(s => ({
      scenario: s,
      label: String(s['Scenario Name'] || `Scenario #${s.id}`),
    })),
  ]

  return (
    <div className="space-y-8">
      {allScenarios.map(({ scenario, label }, idx) => (
        <div key={idx} className={idx > 0 ? 'page-break-before' : ''}>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
            {label}
          </h4>
          <div className="print-pl-table">
            <PLTable scenario={scenario} years={30} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section: Amortization ────────────────────────────────────────────────────

function AmortizationSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  const allScenarios: Array<{ scenario: Record<string, unknown>; label: string }> = [
    { scenario: baseScenario, label: 'Base (listing)' },
    ...scenarios.map(s => ({
      scenario: s,
      label: String(s['Scenario Name'] || `Scenario #${s.id}`),
    })),
  ]

  const financed = allScenarios.filter(({ scenario }) => {
    const m = computeScenarioMetrics(scenario)
    return m.hasLoan && m.principal > 0 && m.rate > 0 && m.term > 0
  })

  if (financed.length === 0) {
    return <p className="text-sm text-gray-500 italic">No financed scenarios found.</p>
  }

  return (
    <div className="space-y-8">
      {financed.map(({ scenario, label }, idx) => {
        const m = computeScenarioMetrics(scenario)
        return (
          <div key={idx} className={idx > 0 ? 'page-break-before' : ''}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
              {label}
            </h4>
            <AmortizationTable
              loanTerm={m.term}
              principal={m.principal}
              interestRate={m.rate}
              monthlyPayment={m.monthlyMortgage}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Section: Sensitivity Heatmap ─────────────────────────────────────────────

function SensitivitySection({ scenario }: { scenario: Record<string, unknown> }) {
  const heatmap = useMemo(() =>
    HEATMAP_ROWS.map(row =>
      HEATMAP_STEPS.map(step => ({
        cf: computeScenarioMetrics(row.applyStep(scenario, step)).monthlyCF,
        varVal: row.varValue(scenario, step),
      }))
    ), [scenario])

  const maxAbsCF = useMemo(() => {
    const all = heatmap.flat().map(c => Math.abs(c.cf))
    return Math.max(100, ...all)
  }, [heatmap])

  const baseCF = heatmap[0]?.[4]?.cf ?? 0

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Each row stresses one variable independently. Cells show monthly cash flow.
        Baseline: <strong className={baseCF >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmtDollar(baseCF)}/mo</strong>
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500 border border-gray-200 bg-gray-50 whitespace-nowrap min-w-36">Variable</th>
              {HEATMAP_STEPS.map(step => (
                <th
                  key={step}
                  className={cn(
                    'px-2 py-2 text-center font-medium whitespace-nowrap border border-gray-200 min-w-14',
                    step === 0 ? 'bg-gray-200 text-gray-900' : 'bg-gray-50 text-gray-500'
                  )}
                >
                  {step === 0 ? 'Base' : `${step > 0 ? '+' : ''}${step}%`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_ROWS.map((row, ri) => (
              <tr key={row.label}>
                <td className="px-3 py-2 font-medium bg-gray-50 whitespace-nowrap border border-gray-200">
                  <div className="text-xs font-semibold text-gray-800">{row.label}</div>
                  <div className="text-[10px] text-gray-400">{row.sublabel}</div>
                </td>
                {HEATMAP_STEPS.map((step, ci) => {
                  const { cf, varVal } = heatmap[ri][ci]
                  const style = heatmapCellStyle(cf, maxAbsCF)
                  return (
                    <td
                      key={step}
                      style={style}
                      className={cn(
                        'px-2 py-1.5 text-center tabular-nums border border-gray-200 font-medium leading-tight',
                        step === 0 && 'ring-1 ring-inset ring-black/20'
                      )}
                    >
                      <div>{fmtCompact(cf)}</div>
                      <div className="text-[9px] opacity-75 font-normal mt-0.5">({varVal})</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Positive cash flow
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(45,90%,88%)' }} /> Near zero (±$100)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Negative cash flow
        </span>
      </div>
      <p className="text-[10px] text-gray-400">
        Interest Rate steps are ÷10 ppts · Down Payment steps are ÷2 ppts · Vacancy steps are ÷5 ppts
      </p>
    </div>
  )
}

// ─── Print Controls ───────────────────────────────────────────────────────────

function PrintControls({
  propertyName,
  selectedSections,
  onToggleSection,
  countdown,
  onPrint,
  onCancelCountdown,
  onClose,
  position,
}: {
  propertyName: string
  selectedSections: Set<string>
  onToggleSection: (id: string) => void
  countdown: number | null
  onPrint: () => void
  onCancelCountdown: () => void
  onClose: () => void
  position: 'top' | 'bottom'
}) {
  return (
    <div className="no-print rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 my-4">
      {position === 'top' && (
        <div className="mb-4 pb-3 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{propertyName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5"
            title="Close print view"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-6 items-start justify-between">
        {/* Section checkboxes */}
        {position === 'top' && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map(sec => (
              <label key={sec.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSections.has(sec.id)}
                  onChange={() => onToggleSection(sec.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">{sec.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          {countdown !== null && countdown > 0 ? (
            <>
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm font-medium text-gray-800">
                Auto-printing in <span className="font-bold text-amber-600">{countdown}s</span>
              </p>
              <button
                onClick={onCancelCountdown}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-gray-800">Ready to print</p>
            </>
          )}
          <button
            onClick={onPrint}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
          {position === 'top' && (
            <button
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {position === 'bottom' && (
        <p className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400 italic">
          This report is for informational purposes only. Projections are estimates based on the assumptions
          entered and do not constitute financial advice. Consult a licensed professional before making
          investment decisions.
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertyPrintView({
  property,
  baseScenario,
  scenarios,
  onClose,
}: PropertyPrintViewProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(SECTIONS.map(s => s.id))
  )
  const [countdown, setCountdown] = useState<number | null>(Math.ceil(AUTO_PRINT_DELAY_MS / 1000))
  const cancelledRef = useRef(false)

  // Build the portal root (direct child of <body>) so it lives outside the
  // AppShell's overflow:hidden / h-screen wrappers
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'property-print-portal-root'
    document.body.appendChild(el)
    setPortalTarget(el)
    return () => { el.remove() }
  }, [])

  // Add body class so the print stylesheet can hide everything else
  useEffect(() => {
    document.body.classList.add('property-print-active')
    return () => document.body.classList.remove('property-print-active')
  }, [])

  // Countdown then auto-print
  useEffect(() => {
    let remaining = AUTO_PRINT_DELAY_MS / 1000
    const interval = setInterval(() => {
      if (cancelledRef.current) { clearInterval(interval); return }
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setCountdown(null)
        window.print()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleSection = (id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cancelCountdown = () => {
    cancelledRef.current = true
    setCountdown(null)
  }

  // Ordered section list to render
  const sectionsToRender = SECTIONS.filter(s => selectedSections.has(s.id))

  // Best scenario for sensitivity (first real scenario, or base)
  const sensitivityScenario = scenarios.length > 0 ? scenarios[0] : baseScenario

  const propertyName = [property.address, property.city].filter(Boolean).join(', ') || 'Property Report'
  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const content = (
    <>
      {/* ── Inline styles: screen overlay + print CSS ── */}
      <style>{`
        /* ── Screen ─────────────────────────────────────────────────────── */
        @media screen {
          #property-print-portal-root {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }
          .print-section-content {
            border-radius: 0.75rem;
            border: 1px solid #e5e7eb;
            background: white;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            padding: 1.5rem;
          }
          .print-only-header { display: none; }
        }

        /* ── Print ──────────────────────────────────────────────────────── */
        @media print {
          html, body {
            display: block !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body > *:not(#property-print-portal-root) {
            display: none !important;
          }

          #property-print-portal-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            z-index: auto !important;
          }

          .no-print { display: none !important; }
          .print-only-header { display: block !important; }

          .print-section-content {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            max-height: none !important;
          }

          /* Allow content to expand */
          .print-section-content div,
          .print-section-content section,
          .print-section-content table {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Kill fixed elements */
          [style*="position: fixed"],
          [style*="position:fixed"],
          .fixed { display: none !important; }

          /* Page breaks */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .print-section-header { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }

          /* Projection tables */
          .print-pl-table table {
            font-size: 0.7rem !important;
            width: 100% !important;
          }
          .print-pl-table th,
          .print-pl-table td {
            padding: 0.2rem 0.35rem !important;
          }
          .print-pl-table .overflow-x-auto {
            overflow: visible !important;
          }

          @page { margin: 1.5cm; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 pb-12">
        {/* ── Top controls (screen only) ── */}
        <PrintControls
          propertyName={propertyName}
          selectedSections={selectedSections}
          onToggleSection={toggleSection}
          countdown={countdown}
          onPrint={() => window.print()}
          onCancelCountdown={cancelCountdown}
          onClose={onClose}
          position="top"
        />

        {/* ── Print-only document header ── */}
        <div className="print-only-header pt-6 pb-3 mb-4 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900">{propertyName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Property Investment Analysis &nbsp;·&nbsp; {generatedAt}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {sectionsToRender.length} section{sectionsToRender.length !== 1 ? 's' : ''}:&nbsp;
            {sectionsToRender.map(s => s.label).join(' · ')}
          </p>
        </div>

        {/* ── Sections ── */}
        {sectionsToRender.map((sec, idx) => (
          <div key={sec.id}>
            <SectionDivider label={sec.label} desc={sec.desc} index={idx} />
            <div className="print-section-content mb-6">
              {sec.id === 'property-info' && (
                <PropertyInfoSection property={property} />
              )}
              {sec.id === 'scenarios' && (
                <ScenariosSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'projections' && (
                <ProjectionsSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'amortization' && (
                <AmortizationSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'sensitivity' && (
                <SensitivitySection scenario={sensitivityScenario} />
              )}
            </div>
          </div>
        ))}

        {/* ── Bottom controls (screen only) ── */}
        <PrintControls
          propertyName={propertyName}
          selectedSections={selectedSections}
          onToggleSection={toggleSection}
          countdown={countdown}
          onPrint={() => window.print()}
          onCancelCountdown={cancelCountdown}
          onClose={onClose}
          position="bottom"
        />
      </div>
    </>
  )

  if (!portalTarget) return null
  return createPortal(content, portalTarget)
}

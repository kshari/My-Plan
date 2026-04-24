'use client'

/**
 * Shared sensitivity heatmap used in the Deal Workspace (screen) and the
 * Print-All report. The calculation logic and row definitions are defined
 * once here; visual styling is toggled via the `variant` prop.
 */

import React, { useMemo } from 'react'
import { computeScenarioMetrics, fmtDollar, fmtCompact } from '@/lib/property/compute-metrics'
import { DEFAULT_DOWN_PAYMENT_PCT } from '@/lib/constants/property-defaults'
import { cn } from '@/lib/utils'

// ─── Row & step definitions ──────────────────────────────────────────────────

/** 10 column steps. Semantics:
 *  - % change for price/rent/opex
 *  - ÷10 for interest rate (±2.5 ppt range)
 *  - ÷2  for down payment (±10 ppt range)
 *  - ÷5  for vacancy (±4 ppt range)
 */
export const HEATMAP_STEPS = [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25] as const

export interface HeatmapRow {
  label: string
  sublabel: string
  applyStep: (s: Record<string, unknown>, step: number) => Record<string, unknown>
  formatStep: (step: number) => string
  varValue: (s: Record<string, unknown>, step: number) => string
}

export const HEATMAP_ROWS: HeatmapRow[] = [
  {
    label: 'Purchase Price',
    sublabel: '% change',
    applyStep: (s, step) => {
      const p = +(s['Purchase Price'] ?? 0) || 0
      const newPrice = p * (1 + step / 100)
      // Preserve the stated down-payment % — recalc Down Payment Amount at the new price so
      // the "25% down" assumption (or whatever is set) stays consistent.
      const hasLoan = !!s['Has Loan']
      const basePct = +(s['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT) || DEFAULT_DOWN_PAYMENT_PCT
      const newDp = hasLoan ? newPrice * basePct / 100 : newPrice
      return { ...s, 'Purchase Price': newPrice, 'Down Payment Amount': newDp }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => fmtCompact(+(s['Purchase Price'] ?? 0) * (1 + step / 100)),
  },
  {
    label: 'Gross Rent',
    sublabel: '% change',
    applyStep: (s, step) => {
      const g = +(s['Gross Income'] ?? 0) || 0
      return { ...s, 'Gross Income': g * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => `${fmtCompact(+(s['Gross Income'] ?? 0) * (1 + step / 100) / 12)}/mo`,
  },
  {
    label: 'Operating Expenses',
    sublabel: '% change',
    applyStep: (s, step) => {
      const o = +(s['Operating Expenses'] ?? 0) || 0
      return { ...s, 'Operating Expenses': o * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => `${fmtCompact(+(s['Operating Expenses'] ?? 0) * (1 + step / 100) / 12)}/mo`,
  },
  {
    label: 'Interest Rate',
    sublabel: '±ppt (÷10)',
    applyStep: (s, step) => {
      const r = +(s['Interest Rate'] ?? 0) || 0
      return { ...s, 'Interest Rate': Math.max(0, r + step / 10) }
    },
    formatStep: step => { const p = step / 10; return `${p > 0 ? '+' : ''}${p.toFixed(1)}` },
    varValue: (s, step) => `${Math.max(0, +(s['Interest Rate'] ?? 0) + step / 10).toFixed(2)}%`,
  },
  {
    label: 'Down Payment',
    sublabel: '±ppt (÷2)',
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
    label: 'Vacancy Rate',
    sublabel: '±ppt',
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

/** Returns inline style for a heatmap cell based on monthly cash flow. */
export function heatmapCellStyle(cf: number, maxAbsCF: number): React.CSSProperties {
  const nearZero = 100
  if (Math.abs(cf) <= nearZero) {
    return { backgroundColor: 'hsl(45,90%,88%)', color: '#78350f' }
  }
  const intensity = Math.min(1, (Math.abs(cf) - nearZero) / Math.max(maxAbsCF - nearZero, 500))
  const lightness = Math.round(92 - intensity * 56) // 92% (pale) → 36% (deep)
  if (cf > 0) {
    return { backgroundColor: `hsl(142,65%,${lightness}%)`, color: lightness < 58 ? '#fff' : '#14532d' }
  }
  return { backgroundColor: `hsl(0,78%,${lightness}%)`, color: lightness < 58 ? '#fff' : '#7f1d1d' }
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SensitivityHeatmapProps {
  scenario: Record<string, unknown>
  /** 'screen' uses theme-aware (dark-mode friendly) classes; 'print' uses
   *  static grayscale classes suitable for print output. */
  variant?: 'screen' | 'print'
  /** Optional content rendered above the heatmap (e.g. a note box). */
  note?: React.ReactNode
}

/** Theme-aware class buckets for the two visual variants. */
const VARIANT_CLASSES = {
  screen: {
    variableHeaderCell: 'sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border border-border/40 min-w-36',
    variableCell:       'sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap border border-border/40',
    variableLabel:      'text-xs font-semibold',
    variableSublabel:   'text-[10px] text-muted-foreground',
    stepHeaderBase:     'bg-muted/60 text-foreground',
    stepHeaderOther:    'bg-card text-muted-foreground',
    stepHeaderCommon:   'px-2 py-2 text-center font-medium whitespace-nowrap border border-border/40 min-w-14',
    bodyCellCommon:     'px-2 py-1.5 text-center tabular-nums border border-border/20 font-medium leading-tight',
    bodyCellBaseRing:   'ring-1 ring-inset ring-foreground/30',
    legendText:         'text-xs text-muted-foreground',
    baselinePositive:   'text-emerald-600 dark:text-emerald-400',
    baselineNegative:   'text-destructive',
    baselineBase:       'font-semibold',
    explainerText:      'text-xs text-muted-foreground',
    footnote:           'text-[10px] text-muted-foreground',
  },
  print: {
    variableHeaderCell: 'px-3 py-2 text-left font-medium text-gray-500 border border-gray-200 bg-gray-50 whitespace-nowrap min-w-36',
    variableCell:       'px-3 py-2 font-medium bg-gray-50 whitespace-nowrap border border-gray-200',
    variableLabel:      'text-xs font-semibold text-gray-800',
    variableSublabel:   'text-[10px] text-gray-400',
    stepHeaderBase:     'bg-gray-200 text-gray-900',
    stepHeaderOther:    'bg-gray-50 text-gray-500',
    stepHeaderCommon:   'px-2 py-2 text-center font-medium whitespace-nowrap border border-gray-200 min-w-14',
    bodyCellCommon:     'px-2 py-1.5 text-center tabular-nums border border-gray-200 font-medium leading-tight',
    bodyCellBaseRing:   'ring-1 ring-inset ring-black/20',
    legendText:         'text-xs text-gray-500',
    baselinePositive:   'text-emerald-700',
    baselineNegative:   'text-red-700',
    baselineBase:       '',
    explainerText:      'text-xs text-gray-500',
    footnote:           'text-[10px] text-gray-400',
  },
} as const

/** Full-precision dollar formatter for print output (no $K/$M rounding). */
function fmtExactDollar(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function SensitivityHeatmap({
  scenario,
  variant = 'screen',
  note,
}: SensitivityHeatmapProps) {
  const v = VARIANT_CLASSES[variant]
  // Screen uses compact $K/$M (tooltip shows exact); print shows full dollars so nothing is rounded on paper.
  const fmtCell = variant === 'print' ? fmtExactDollar : fmtCompact

  const heatmap = useMemo(() =>
    HEATMAP_ROWS.map(row =>
      HEATMAP_STEPS.map(step => ({
        cf: computeScenarioMetrics(row.applyStep(scenario, step)).monthlyCF,
        varVal: row.varValue(scenario, step),
      }))
    ),
    [scenario]
  )

  const maxAbsCF = useMemo(() => {
    const all = heatmap.flat().map(c => Math.abs(c.cf))
    return Math.max(100, ...all)
  }, [heatmap])

  // Baseline = 0% column (index 4)
  const baseCF = heatmap[0]?.[4]?.cf ?? 0

  const Legend = (
    <div className={cn('flex items-center gap-3 flex-wrap', v.legendText)}>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Positive cash flow</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(45,90%,88%)' }} /> Near zero (±$100)</span>
      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Negative cash flow</span>
    </div>
  )

  return (
    <div className="space-y-3">
      {note}

      <div className={cn('flex items-center justify-between flex-wrap gap-2', variant === 'print' && 'flex-col items-start')}>
        <p className={v.explainerText}>
          Each row stresses one variable independently. Cells show monthly cash flow.
          Baseline: <span className={cn(v.baselineBase, baseCF >= 0 ? v.baselinePositive : v.baselineNegative)}>{fmtDollar(baseCF)}/mo</span>
        </p>
        {variant === 'screen' && Legend}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={v.variableHeaderCell}>Variable</th>
              {HEATMAP_STEPS.map(step => (
                <th
                  key={step}
                  className={cn(v.stepHeaderCommon, step === 0 ? v.stepHeaderBase : v.stepHeaderOther)}
                >
                  {step === 0 ? 'Base' : `${step > 0 ? '+' : ''}${step}%`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_ROWS.map((row, ri) => (
              <tr key={row.label}>
                <td className={v.variableCell}>
                  <div className={v.variableLabel}>{row.label}</div>
                  <div className={v.variableSublabel}>{row.sublabel}</div>
                </td>
                {HEATMAP_STEPS.map((step, ci) => {
                  const { cf, varVal } = heatmap[ri][ci]
                  const style = heatmapCellStyle(cf, maxAbsCF)
                  const isBase = step === 0
                  return (
                    <td
                      key={step}
                      style={style}
                      className={cn(v.bodyCellCommon, isBase && v.bodyCellBaseRing)}
                      title={`${row.label} ${row.formatStep(step)} → Cash/mo: ${fmtDollar(cf)}`}
                    >
                      <div>{fmtCell(cf)}</div>
                      <div className="text-[9px] opacity-75 font-normal mt-0.5">({varVal})</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {variant === 'print' && Legend}

      <p className={v.footnote}>
        Interest Rate column steps are ÷10 ppts (±2.5 ppt range) · Down Payment steps are ÷2 ppts (±10 ppt range) · Vacancy steps are ÷5 ppts (±4 ppt range).
        When Purchase Price changes, Down Payment % is held constant (dollar amount recalculated).
      </p>
    </div>
  )
}

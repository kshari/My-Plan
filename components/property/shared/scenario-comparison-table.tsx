'use client'

/**
 * Shared scenario comparison table used in:
 *   - Deal Workspace compare mode (screen, 2-3 selected scenarios, best-value highlighting)
 *   - Property Print-All report (print, all scenarios including Base)
 *
 * The row/group definitions are centralized so both views show identical
 * metrics with identical calculation logic. Visual styling is toggled via
 * the `variant` prop.
 */

import React from 'react'
import {
  computeScenarioMetrics, fmtDollar,
  type ScenarioMetrics,
} from '@/lib/property/compute-metrics'
import { computeInvestmentScore, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'
import { DEFAULT_DOWN_PAYMENT_PCT } from '@/lib/constants/property-defaults'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScenarioComparisonItemInput {
  scenario: Record<string, unknown>
  label: string
  color: string
  isBase?: boolean
  /** Unique DOM key. Defaults to `sc-${scenario.id}` or `base`. */
  id?: string
}

interface ComputedItem {
  scenario: Record<string, unknown>
  label: string
  color: string
  isBase: boolean
  id: string
  m: ScenarioMetrics
  score: number | null
}

interface RowDef {
  label: string
  cell: (it: ComputedItem) => string
  /** Numeric value used for best-value highlighting and negative-return
   *  detection. Return null if this row is not comparable for this item. */
  raw?: (it: ComputedItem) => number | null
  /** true = higher is better, false = lower is better. Omit to disable
   *  best-value highlighting for this row. */
  hib?: boolean
  /** true if the value should be rendered red when it is a negative return
   *  for this item. Defaults to (hib === true && raw < 0). */
  neg?: (it: ComputedItem) => boolean
  /** Emphasize this row visually (Total Cash Invested, NOI, Cash Flow, etc.). */
  highlight?: boolean
}

interface GroupDef {
  title: string
  rows: RowDef[]
}

// ─── Score helper ─────────────────────────────────────────────────────────────

function scoreFor(m: ScenarioMetrics): number | null {
  if (m.price <= 0 || m.income <= 0) return null
  return computeInvestmentScore(DEFAULT_SCORING_CONFIG, {
    capRate: m.capRate,
    roi: m.cocr,
    annualCashFlow: m.firstYearCF,
    noiForCalcs: m.noi,
    onePercentRatio: m.onePercent,
    grm: m.grm,
  }, v => fmtDollar(v)).score
}

// ─── Group / row definitions ──────────────────────────────────────────────────

const GROUPS: GroupDef[] = [
  {
    title: 'Purchase & Financing',
    rows: [
      { label: 'Purchase Price', cell: ({ m }) => fmtDollar(m.price), raw: ({ m }) => m.price, hib: false },
      { label: 'Purchase Closing Costs', cell: ({ m }) => m.purchaseCC > 0 ? `${fmtDollar(m.purchaseCC)} (${m.price > 0 ? ((m.purchaseCC / m.price) * 100).toFixed(2) : '0'}%)` : '—', raw: ({ m }) => m.purchaseCC, hib: false },
      { label: 'Purchase Type', cell: ({ m }) => m.hasLoan ? 'Financed' : 'All Cash' },
      { label: 'Down Payment', cell: ({ m, scenario }) => m.hasLoan ? `${fmtDollar(m.dp)} (${scenario['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT}%)` : '—', raw: ({ m }) => m.hasLoan ? m.dp : null, hib: false },
      { label: 'Loan Amount', cell: ({ m }) => m.hasLoan ? fmtDollar(m.principal) : '—', raw: ({ m }) => m.hasLoan ? m.principal : null, hib: false },
      { label: 'Interest Rate', cell: ({ m }) => m.hasLoan ? `${m.rate}%` : '—', raw: ({ m }) => m.hasLoan ? m.rate : null, hib: false },
      { label: 'Loan Term', cell: ({ m }) => m.hasLoan ? `${m.term} yrs` : '—' },
      { label: 'Monthly Payment', cell: ({ m }) => m.hasLoan ? fmtDollar(m.monthlyMortgage) : '—', raw: ({ m }) => m.hasLoan ? m.monthlyMortgage : null, hib: false },
      { label: 'Loan Closing Costs', cell: ({ m }) => m.hasLoan && m.loanCC > 0 ? `${fmtDollar(m.loanCC)} (${m.principal > 0 ? ((m.loanCC / m.principal) * 100).toFixed(2) : '0'}%)` : '—', raw: ({ m }) => m.hasLoan ? m.loanCC : null, hib: false },
      { label: 'Total Cash Invested', cell: ({ m }) => fmtDollar(m.totalCashInvested), raw: ({ m }) => m.totalCashInvested, hib: false, highlight: true },
    ],
  },
  {
    title: 'Income',
    rows: [
      { label: 'Gross Rent / yr', cell: ({ m }) => fmtDollar(m.grossIncome), raw: ({ m }) => m.grossIncome, hib: true },
      { label: 'Vacancy Rate', cell: ({ m }) => `${m.vacancyRate}%`, raw: ({ m }) => m.vacancyRate, hib: false },
      { label: 'Vacancy Loss', cell: ({ m }) => m.vacancyLoss > 0 ? `-${fmtDollar(m.vacancyLoss)}` : '—', raw: ({ m }) => m.vacancyLoss, hib: false },
      { label: 'Effective Income / yr', cell: ({ m }) => fmtDollar(m.effectiveIncome), raw: ({ m }) => m.effectiveIncome, hib: true, highlight: true },
    ],
  },
  {
    title: 'Expenses',
    rows: [
      { label: 'Oper. Expenses / yr', cell: ({ m }) => fmtDollar(m.opex), raw: ({ m }) => m.opex, hib: false },
      { label: 'Prop. Mgmt Rate', cell: ({ m }) => `${m.propMgmtRate}%`, raw: ({ m }) => m.propMgmtRate, hib: false },
      { label: 'Prop. Mgmt / yr', cell: ({ m }) => m.propMgmtExpense > 0 ? fmtDollar(m.propMgmtExpense) : '—', raw: ({ m }) => m.propMgmtExpense, hib: false },
      { label: 'Total Expenses / yr', cell: ({ m }) => fmtDollar(m.totalExpenses), raw: ({ m }) => m.totalExpenses, hib: false },
      { label: 'Net Op. Income / yr', cell: ({ m }) => fmtDollar(m.noi), raw: ({ m }) => m.noi, hib: true, highlight: true },
    ],
  },
  {
    title: 'Key Metrics',
    rows: [
      { label: 'Cap Rate', cell: ({ m }) => `${m.capRate.toFixed(2)}%`, raw: ({ m }) => m.capRate, hib: true },
      { label: 'Cash Flow / mo', cell: ({ m }) => fmtDollar(m.monthlyCF), raw: ({ m }) => m.monthlyCF, hib: true, highlight: true },
      { label: 'Cash Flow / yr', cell: ({ m }) => fmtDollar(m.firstYearCF), raw: ({ m }) => m.firstYearCF, hib: true },
      { label: 'Cash-on-Cash (Yr 1)', cell: ({ m }) => m.totalCashInvested > 0 ? `${m.cocr.toFixed(2)}%` : '—', raw: ({ m }) => m.totalCashInvested > 0 ? m.cocr : null, hib: true },
      { label: 'Debt Coverage', cell: ({ m }) => m.dscr != null ? `${m.dscr.toFixed(2)}×` : '—', raw: ({ m }) => m.dscr, hib: true, neg: ({ m }) => m.dscr != null && m.dscr < 1 },
      { label: 'GRM (Price ÷ Gross Rent)', cell: ({ m }) => m.grm > 0 ? `${m.grm.toFixed(2)}×` : '—', raw: ({ m }) => m.grm > 0 ? m.grm : null, hib: false },
      { label: '1% Rule', cell: ({ m }) => m.onePercent > 0 ? `${m.onePercent.toFixed(2)}%` : '—', raw: ({ m }) => m.onePercent, hib: true },
      { label: 'Investment Score', cell: ({ score }) => score != null ? `${score}/100` : '—', raw: ({ score }) => score, hib: true, highlight: true },
    ],
  },
  {
    title: 'Assumptions',
    rows: [
      { label: 'Income Growth / yr', cell: ({ scenario }) => `${String(scenario['Income Increase'] ?? 3)}%` },
      { label: 'Expense Growth / yr', cell: ({ scenario }) => `${String(scenario['Expenses Increase'] ?? 3)}%` },
      { label: 'Property Appreciation / yr', cell: ({ scenario }) => `${String(scenario['Property Value Increase'] ?? 3)}%` },
      { label: 'Sale Costs (IRR exit)', cell: ({ scenario }) => `${String(scenario['Sale Cost Rate'] ?? 7)}%` },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export interface ScenarioComparisonTableProps {
  items: ScenarioComparisonItemInput[]
  /** 'screen' uses theme-aware classes; 'print' uses static grayscale. */
  variant?: 'screen' | 'print'
  /** Show ★ on the best value in each comparable row. Default true. */
  showBestHighlight?: boolean
  /** Show score badge in header. Default true. */
  showScoreInHeader?: boolean
}

/**
 * Theme-aware classes for the two visual variants.
 *
 * Both variants share the same semantic color coding:
 *   - Best value     → green text + green bg tint (+ ★ marker)
 *   - Negative       → red text + red bg tint
 *   - Highlight row  → blue text + blue bg tint + bold
 *   - Plain          → muted text
 */
const V = {
  screen: {
    wrapper:       'rounded-xl border bg-card overflow-hidden',
    headCell:      'px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border bg-muted/40 min-w-[220px]',
    scenarioHeadCell: 'px-4 py-2.5 text-right text-xs font-semibold border-b border-border bg-muted/40 min-w-[160px]',
    scenarioLabelMuted: 'text-[10px] font-medium text-muted-foreground uppercase tracking-wide',
    groupCell:     'px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/60 border-b border-border',
    rowHover:      'hover:bg-muted/30',
    rowLabel:      'px-4 py-2 text-sm font-medium border-b border-border/60',
    dataCellBase:  'px-4 py-2 text-right tabular-nums border-b border-border/60',
    bestText:      'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    negText:       'font-semibold text-red-600 dark:text-red-400 bg-red-500/10',
    plainDefault:  'text-muted-foreground',
    plainHighlight:'font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10',
  },
  print: {
    wrapper:       'overflow-x-auto',
    headCell:      'px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide border border-gray-200 bg-gray-50 min-w-[180px]',
    scenarioHeadCell: 'px-3 py-2 text-right font-semibold text-gray-800 border border-gray-200 bg-gray-50 min-w-[140px]',
    scenarioLabelMuted: 'text-[10px] font-medium text-gray-400 uppercase tracking-wide',
    groupCell:     'px-3 py-1.5 font-semibold text-[10px] text-gray-500 uppercase tracking-wider border border-gray-200 bg-gray-100',
    rowHover:      '',
    rowLabel:      'px-3 py-1.5 text-gray-600 border border-gray-200',
    dataCellBase:  'px-3 py-1.5 text-right tabular-nums border border-gray-200',
    bestText:      'font-bold text-emerald-700 bg-emerald-50/60',
    negText:       'font-semibold text-red-700 bg-red-50/60',
    plainDefault:  'text-gray-900',
    plainHighlight:'font-semibold text-blue-700 bg-blue-50/40',
  },
} as const

export function ScenarioComparisonTable({
  items,
  variant = 'screen',
  showBestHighlight = true,
  showScoreInHeader = true,
}: ScenarioComparisonTableProps) {
  const cls = V[variant]

  const computed: ComputedItem[] = items.map(item => {
    const m = computeScenarioMetrics(item.scenario)
    return {
      scenario: item.scenario,
      label: item.label,
      color: item.color,
      isBase: item.isBase ?? false,
      id: item.id ?? (item.scenario.id != null ? `sc-${item.scenario.id}` : (item.isBase ? 'base' : item.label)),
      m,
      score: scoreFor(m),
    }
  })

  /** Index of the best item for this row, or null if no clear winner. */
  function bestIdxFor(row: RowDef): number | null {
    if (!showBestHighlight) return null
    if (row.raw == null || row.hib == null) return null
    const raws = computed.map(it => row.raw!(it))
    const valid = raws
      .map((v, i) => ({ v, i }))
      .filter(x => x.v != null && Number.isFinite(x.v as number)) as { v: number; i: number }[]
    if (valid.length === 0) return null
    const best = valid.reduce((acc, cur) =>
      row.hib ? (cur.v > acc.v ? cur : acc) : (cur.v < acc.v ? cur : acc)
    )
    // Only highlight if there is a single distinct winner. Any tie for best
    // (including partial ties like 2 of 3) should suppress the ★ marker so
    // readers aren't misled into thinking one tied scenario beats another.
    const ties = valid.filter(x => x.v === best.v)
    return ties.length > 1 ? null : best.i
  }

  /** True if this cell represents a negative return. */
  function isNegativeReturn(row: RowDef, it: ComputedItem): boolean {
    if (row.neg) return row.neg(it)
    if (row.hib !== true) return false
    const v = row.raw?.(it)
    return v != null && Number.isFinite(v) && v < 0
  }

  return (
    <div className={cls.wrapper}>
      <div className={variant === 'screen' ? 'overflow-x-auto' : ''}>
        <table className={cn('w-full border-collapse', variant === 'screen' ? 'text-sm' : 'text-xs')}>
          <thead>
            <tr>
              <th className={cls.headCell}>Metric</th>
              {computed.map(it => (
                <th
                  key={it.id}
                  className={cls.scenarioHeadCell}
                  style={{ borderTopWidth: 3, borderTopColor: it.color, borderTopStyle: 'solid' }}
                >
                  <div className="flex flex-col items-end">
                    <span className={cls.scenarioLabelMuted}>
                      {it.isBase ? 'Base' : 'Scenario'}
                    </span>
                    <span className={cn('font-bold', variant === 'screen' ? 'text-sm' : 'text-sm')} style={{ color: it.color }}>
                      {it.label}
                    </span>
                    {showScoreInHeader && it.score != null && (
                      <span className={cn(
                        'text-[10px] font-semibold tabular-nums',
                        it.score >= 70 ? 'text-emerald-600' : it.score >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        Score: {it.score}/100
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group, gi) => (
              <React.Fragment key={group.title}>
                <tr>
                  <td
                    colSpan={1 + computed.length}
                    className={cn(cls.groupCell, gi > 0 && variant === 'screen' && 'border-t')}
                  >
                    {group.title}
                  </td>
                </tr>
                {group.rows.map(row => {
                  const bestIdx = bestIdxFor(row)
                  return (
                    <tr key={`${group.title}-${row.label}`} className={cls.rowHover}>
                      <td className={cls.rowLabel}>{row.label}</td>
                      {computed.map((it, i) => {
                        const isBest = bestIdx === i
                        const isNeg = isNegativeReturn(row, it)
                        return (
                          <td
                            key={it.id}
                            className={cn(
                              cls.dataCellBase,
                              row.highlight && 'font-semibold',
                              isNeg
                                ? cls.negText
                                : isBest
                                  ? cls.bestText
                                  : row.highlight ? cls.plainHighlight : cls.plainDefault
                            )}
                          >
                            {row.cell(it)}
                            {isBest && showBestHighlight && <span className="ml-1 text-xs">★</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {variant === 'print' && computed.some(it => it.m.propMgmtRate > 0) && (
        <p className="mt-2 text-[11px] text-gray-500">
          <strong>Note:</strong> <em>Prop. Mgmt Rate</em> is applied to <em>effective income</em>
          {' '}(Gross Rent × (1 − Vacancy %)), not gross rent — the industry-standard convention.
          Cap Rate and Debt Coverage are computed on NOI (post-vacancy, post-prop-mgmt).
        </p>
      )}
    </div>
  )
}

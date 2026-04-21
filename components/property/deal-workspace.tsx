'use client'

import React, { useState, useMemo, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, BarChart2, ChevronDown, ChevronUp, Pencil, Check, X,
  TrendingUp, DollarSign, Percent, Star, MoreHorizontal, Trash2,
  Info, Activity, GitCompare, Building2, ExternalLink, RefreshCw, Printer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_DOWN_PAYMENT_PCT,
} from '@/lib/constants/property-defaults'
import { computeScenarioMetrics, fmtDollar, fmtCompact, type ScenarioMetrics } from '@/lib/property/compute-metrics'
import { computeInvestmentScore, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'
import PLTable from '@/components/property/pl-table'
import AmortizationTable from '@/components/property/amortization-table'
import NewScenarioDialog from '@/components/property/new-scenario-dialog'
import PropertyPrintView from '@/components/property/print/property-print-view'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  created_at: string
}

type ScenarioRow = Record<string, unknown> & { id: number; created_at: string }

interface DealWorkspaceProps {
  property: Property
  initialScenarios: ScenarioRow[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreForMetrics(m: ScenarioMetrics) {
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

const colorsMap = ['#3b82f6', '#10b981', '#f59e0b']

// ─── Sub-components ──────────────────────────────────────────────────────────

function HeroCard({
  label, value, sub, positive, neutral, icon: Icon, tip,
}: {
  label: string; value: string; sub?: string; positive?: boolean
  neutral?: boolean; icon: React.ElementType; tip?: string
}) {
  const valueColor = neutral ? 'text-foreground' : positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
  const card = (
    <div className="rounded-xl border bg-card px-4 py-3 flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn('text-xl font-bold tabular-nums truncate', valueColor)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
    </div>
  )
  if (!tip) return card
  return (
    <Tooltip>
      <TooltipTrigger asChild className="cursor-default">{card}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tip}</TooltipContent>
    </Tooltip>
  )
}

/** Normalized horizontal bar strip for compare mode */
function NormalizedBar({ label, entries, higherIsBetter }: {
  label: string
  entries: { name: string; raw: number; color: string }[]
  higherIsBetter: boolean
}) {
  const vals = entries.map(e => e.raw)
  const max = Math.max(...vals.filter(v => v > 0))
  const min = Math.min(...vals.filter(v => v > 0))

  return (
    <div className="space-y-1.5 py-2 border-b border-border/60 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {higherIsBetter ? '↑ higher better' : '↓ lower better'}
        </span>
      </div>
      {entries.map(e => {
        const basis = higherIsBetter ? max : min
        const pct = basis > 0 ? Math.min(100, (higherIsBetter ? e.raw / basis : basis / e.raw) * 100) : 0
        const isBest = higherIsBetter ? e.raw === max : e.raw === min
        return (
          <div key={e.name} className="flex items-center gap-2">
            <span className="text-xs w-28 truncate shrink-0" style={{ color: e.color }}>{e.name}</span>
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: e.color, opacity: isBest ? 1 : 0.5 }}
              />
            </div>
            <span className="text-xs tabular-nums w-20 text-right">{typeof e.raw === 'number' ? (e.raw > 1000 ? fmtDollar(e.raw) : e.raw.toFixed(2)) : e.raw}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Inline editable field */
function InlineField({
  label, value, onChange, type = 'number', step = '0.01', min, suffix, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; step?: string; min?: string; suffix?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-0.5">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          step={step}
          min={min}
          value={value}
          onChange={e => onChange(e.target.value)}
          readOnly={readOnly}
          className={cn(
            'w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
            readOnly && 'bg-muted cursor-default opacity-70'
          )}
        />
        {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

// ─── Sensitivity heatmap ─────────────────────────────────────────────────────

// 10 column steps: % change for price/rent/opex; scaled to ppts for rate/dp
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
    label: 'Purchase Price',
    sublabel: '% change',
    applyStep: (s, step) => {
      const p = +(s['Purchase Price'] ?? 0) || 0
      return { ...s, 'Purchase Price': p * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => {
      const p = +(s['Purchase Price'] ?? 0) || 0
      return fmtCompact(p * (1 + step / 100))
    },
  },
  {
    label: 'Gross Rent',
    sublabel: '% change',
    applyStep: (s, step) => {
      const g = +(s['Gross Income'] ?? 0) || 0
      return { ...s, 'Gross Income': g * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => {
      const g = +(s['Gross Income'] ?? 0) || 0
      return `${fmtCompact(g * (1 + step / 100) / 12)}/mo`
    },
  },
  {
    label: 'Operating Expenses',
    sublabel: '% change',
    applyStep: (s, step) => {
      const o = +(s['Operating Expenses'] ?? 0) || 0
      return { ...s, 'Operating Expenses': o * (1 + step / 100) }
    },
    formatStep: step => `${step > 0 ? '+' : ''}${step}%`,
    varValue: (s, step) => {
      const o = +(s['Operating Expenses'] ?? 0) || 0
      return `${fmtCompact(o * (1 + step / 100) / 12)}/mo`
    },
  },
  {
    label: 'Interest Rate',
    sublabel: '±ppt (÷10)',
    applyStep: (s, step) => {
      const r = +(s['Interest Rate'] ?? 0) || 0
      return { ...s, 'Interest Rate': Math.max(0, r + step / 10) }
    },
    formatStep: step => {
      const ppt = step / 10
      return `${ppt > 0 ? '+' : ''}${ppt.toFixed(1)}`
    },
    varValue: (s, step) => {
      const r = +(s['Interest Rate'] ?? 0) || 0
      return `${Math.max(0, r + step / 10).toFixed(2)}%`
    },
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
    formatStep: step => {
      const ppt = step / 2
      return `${ppt > 0 ? '+' : ''}${ppt.toFixed(0)}`
    },
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
    formatStep: step => {
      const ppt = step / 5
      return `${ppt > 0 ? '+' : ''}${ppt.toFixed(1)}`
    },
    varValue: (s, step) => {
      const v = +(s['Vacancy Rate'] ?? 0) || 0
      return `${Math.max(0, Math.min(100, v + step / 5)).toFixed(1)}%`
    },
  },
]

/** Returns inline style for a heatmap cell based on monthly cash flow. */
function heatmapCellStyle(cf: number, maxAbsCF: number): React.CSSProperties {
  const nearZero = 100
  if (Math.abs(cf) <= nearZero) {
    return { backgroundColor: 'hsl(45,90%,88%)', color: '#78350f' }
  }
  const intensity = Math.min(1, (Math.abs(cf) - nearZero) / Math.max(maxAbsCF - nearZero, 500))
  const lightness = Math.round(92 - intensity * 56) // 92% (pale) → 36% (deep)
  if (cf > 0) {
    return {
      backgroundColor: `hsl(142,65%,${lightness}%)`,
      color: lightness < 58 ? '#fff' : '#14532d',
    }
  } else {
    return {
      backgroundColor: `hsl(0,78%,${lightness}%)`,
      color: lightness < 58 ? '#fff' : '#7f1d1d',
    }
  }
}

function SensitivityPanel({ scenario }: { scenario: Record<string, unknown> }) {
  // Pre-compute all cells: [rowIdx][colIdx] = { cf, varVal }
  const heatmap = useMemo(() => {
    return HEATMAP_ROWS.map(row =>
      HEATMAP_STEPS.map(step => ({
        cf: computeScenarioMetrics(row.applyStep(scenario, step)).monthlyCF,
        varVal: row.varValue(scenario, step),
      }))
    )
  }, [scenario])

  // Max absolute cash flow across all cells — drives color saturation
  const maxAbsCF = useMemo(() => {
    const allVals = heatmap.flat().map(c => Math.abs(c.cf))
    return Math.max(100, ...allVals)
  }, [heatmap])

  // Baseline cash flow (0% change column = index 4)
  const baseCF = heatmap[0]?.[4]?.cf ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-muted-foreground">
            Each row stresses one variable independently. Cells show monthly cash flow.
            Current baseline: <span className={cn('font-semibold', baseCF >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>{fmtDollar(baseCF)}/mo</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Positive</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'hsl(45,90%,88%)' }} /> Near zero</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Negative</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border border-border/40 min-w-36">Variable</th>
              {HEATMAP_STEPS.map((step, ci) => (
                <th
                  key={step}
                  className={cn(
                    'px-2 py-2 text-center font-medium whitespace-nowrap border border-border/40 min-w-14',
                    step === 0 ? 'bg-muted/60 text-foreground' : 'text-muted-foreground bg-card'
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
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap border border-border/40">
                  <div className="text-xs font-semibold">{row.label}</div>
                  <div className="text-[10px] text-muted-foreground">{row.sublabel}</div>
                </td>
                {HEATMAP_STEPS.map((step, ci) => {
                  const { cf, varVal } = heatmap[ri][ci]
                  const isBase = step === 0
                  const style = heatmapCellStyle(cf, maxAbsCF)
                  return (
                    <td
                      key={step}
                      style={style}
                      className={cn(
                        'px-2 py-1.5 text-center tabular-nums border border-border/20 font-medium leading-tight',
                        isBase && 'ring-1 ring-inset ring-foreground/30'
                      )}
                      title={`${row.label} ${row.formatStep(step)} → Cash/mo: ${fmtDollar(cf)}`}
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
      <p className="text-[10px] text-muted-foreground">
        Interest Rate column steps are ÷10 ppts (±2.5 ppt range) · Down Payment steps are ÷2 ppts (±10 ppt range) · Vacancy steps are ÷5 ppts (±4 ppt range)
      </p>
    </div>
  )
}

// ─── Main DealWorkspace ───────────────────────────────────────────────────────

export default function DealWorkspace({ property, initialScenarios }: DealWorkspaceProps) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  // ── Scenario state
  const [scenarios, setScenarios] = useState<ScenarioRow[]>(initialScenarios)
  const [activeId, setActiveId] = useState<number>(
    initialScenarios.find(s => s.is_base)?.id ?? initialScenarios[0]?.id ?? 0
  )
  const [newDialogOpen, setNewDialogOpen] = useState(false)

  // ── Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<Set<number>>(
    new Set(initialScenarios.slice(0, Math.min(3, initialScenarios.length)).map(s => s.id))
  )
  // ── Inline edit
  const [editSection, setEditSection] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Disclosure panels
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set())
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false)

  // ── Print All
  const [printAllOpen, setPrintAllOpen] = useState(false)

  // ── Active scenario data
  const baseScenario = useMemo(() => scenarios.find(s => s.is_base) ?? scenarios[0], [scenarios])

  const activeScenario: Record<string, unknown> = useMemo(() => {
    return scenarios.find(s => s.id === activeId) ?? baseScenario ?? {}
  }, [activeId, scenarios, baseScenario])

  const activeMetrics = useMemo(() => computeScenarioMetrics(activeScenario), [activeScenario])

  const score = useMemo(() => scoreForMetrics(activeMetrics), [activeMetrics])

  // ── Helpers
  const fmt$ = useCallback((v: number) => fmtDollar(v), [])
  const fmtPct = (v: number) => `${v.toFixed(2)}%`

  const togglePanel = (id: string) =>
    setOpenPanels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Inline editing
  const startEdit = (section: string, draft: Record<string, unknown>) => {
    setEditSection(section)
    setSaveError(null)
    const s: Record<string, string> = {}
    for (const [k, v] of Object.entries(draft)) {
      s[k] = v != null ? String(v) : ''
    }
    setEditDraft(s)
  }

  const cancelEdit = () => { setEditSection(null); setEditDraft({}); setSaveError(null) }

  const saveEdit = async () => {
    if (!activeId) return
    setSaving(true)
    setSaveError(null)
    try {
      const updates: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editDraft)) {
        if (v === '' || v == null) { updates[k] = null; continue }
        const num = parseFloat(v)
        updates[k] = isNaN(num) ? v : num
      }
      // Sync Has Loan boolean
      if ('Has Loan' in updates) updates['Has Loan'] = updates['Has Loan'] === true || updates['Has Loan'] === 'true'
      const { error } = await supabase
        .from('pi_financial_scenarios')
        .update(updates)
        .eq('id', activeId)
      if (error) throw error
      setScenarios(prev => prev.map(s => s.id === activeId ? { ...s, ...updates } : s))
      cancelEdit()
      startTransition(() => router.refresh())
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteScenario = async (id: number) => {
    const scenario = scenarios.find(s => s.id === id)
    if (scenario?.is_base) return // cannot delete Base
    const { error } = await supabase.from('pi_financial_scenarios').delete().eq('id', id)
    if (error) return
    setScenarios(prev => prev.filter(s => s.id !== id))
    if (activeId === id) {
      const remaining = scenarios.filter(s => s.id !== id)
      setActiveId(remaining[0]?.id ?? (baseScenario?.id ?? 0))
    }
    startTransition(() => router.refresh())
  }

  // ── Compare helpers
  const toggleCompareId = (id: number) => {
    setCompareIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) { if (n.size > 2) n.delete(id) }
      else { if (n.size < 3) n.add(id) }
      return n
    })
  }

  const compareScenarios = useMemo(
    () => scenarios.filter(s => compareIds.has(s.id)),
    [scenarios, compareIds]
  )

  const compareMetrics = useMemo(
    () => compareScenarios.map(s => ({ scenario: s, metrics: computeScenarioMetrics(s) })),
    [compareScenarios]
  )

  // ── Rendered sections

  const propertyChips: string[] = []
  if (property.type) propertyChips.push(property.type)
  if (property.bedrooms != null) propertyChips.push(`${property.bedrooms} bd`)
  if (property.bathrooms != null) propertyChips.push(`${property.bathrooms} ba`)
  if (property.sqft != null) propertyChips.push(`${property.sqft.toLocaleString()} sqft`)
  if (property.city) propertyChips.push(property.city)
  if (property.community) propertyChips.push(property.community)
  if (property['Has HOA']) propertyChips.push('HOA')
  if (property.swimming_pool) propertyChips.push('Pool')

  // Assumption card drafts
  const incomeFields = {
    'Gross Income': activeScenario['Gross Income'],
    'Income Increase': activeScenario['Income Increase'],
    'Vacancy Rate': activeScenario['Vacancy Rate'],
  }
  const expenseFields = {
    'Operating Expenses': activeScenario['Operating Expenses'],
    'Expenses Increase': activeScenario['Expenses Increase'],
    'Property Management Rate': activeScenario['Property Management Rate'],
  }
  const loanFields = {
    'Has Loan': activeScenario['Has Loan'],
    'Down Payment Percentage': activeScenario['Down Payment Percentage'],
    'Down Payment Amount': activeScenario['Down Payment Amount'],
    'Interest Rate': activeScenario['Interest Rate'],
    'Loan Term': activeScenario['Loan Term'],
    'Closing Costs': activeScenario['Closing Costs'],
    'Purchase Closing Costs': activeScenario['Purchase Closing Costs'],
  }
  const growthFields = {
    'Income Increase': activeScenario['Income Increase'],
    'Expenses Increase': activeScenario['Expenses Increase'],
    'Property Value Increase': activeScenario['Property Value Increase'],
  }

  const isBaseActive = activeScenario?.is_base === true
  const canEdit = true // All scenarios (including Base) can be inline-edited

  const EditBar = () => (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
      {saveError && <p className="text-xs text-destructive flex-1">{saveError}</p>}
      <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors">
        Cancel
      </button>
      <button
        onClick={saveEdit}
        disabled={saving}
        className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : <><Check className="h-3 w-3 inline mr-1" />Save</>}
      </button>
    </div>
  )

  return (
    <div className="space-y-0">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{property.address || 'Property'}</h1>
          {propertyChips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {propertyChips.map((c, i) => (
                <span key={i} className="text-xs text-muted-foreground">
                  {c}{i < propertyChips.length - 1 && <span className="mx-1 text-muted-foreground/40">·</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPrintAllOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <Printer className="h-3 w-3" /> Print All
          </button>
          <Link
            href={`/apps/property/properties/${property.id}/edit`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </Link>
        </div>
      </div>

      {/* ── Scenario chips bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap mb-4 p-3 rounded-xl border bg-card">
        {/* All scenario chips (Base always first) */}
        {scenarios.map(s => {
          const isThisBase = s.is_base === true
          const isActive = activeId === s.id && !compareMode
          const isInCompare = compareMode && compareIds.has(s.id)
          const label = isThisBase ? 'Base' : String(s['Scenario Name'] || `Scenario #${s.id}`)
          return (
            <button
              key={s.id}
              onClick={() => {
                if (compareMode) {
                  toggleCompareId(s.id)
                } else {
                  setActiveId(s.id)
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors group relative',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : isInCompare
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {isThisBase && <Building2 className="h-3.5 w-3.5" />}
              {label}
              {!compareMode && !isThisBase && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/apps/property/properties/${property.id}/scenarios/${s.id}/edit`}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />Edit full form
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/apps/property/properties/${property.id}/scenarios/${s.id}`}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />View detail page
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteScenario(s.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </button>
          )
        })}

        {/* Add scenario */}
        <button
          onClick={() => setNewDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />New
        </button>

        {/* Compare toggle */}
        {scenarios.length >= 2 && (
          <button
            onClick={() => {
              setCompareMode(v => !v)
              if (!compareMode) {
                setCompareIds(new Set(scenarios.slice(0, Math.min(3, scenarios.length)).map(s => s.id)))
              }
            }}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors',
              compareMode
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            )}
          >
            <GitCompare className="h-3.5 w-3.5" />
            {compareMode ? 'Comparing' : 'Compare'}
          </button>
        )}
      </div>

      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm py-2 mb-4 -mx-1 px-1">
        {compareMode ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {compareMetrics.map((m, i) => {
              const s = m.scenario
              const color = colorsMap[i % colorsMap.length]
              const cf = m.metrics.monthlyCF
              return (
                <div key={s.id} className="rounded-xl border bg-card px-4 py-2.5 min-w-48 flex-1">
                  <p className="text-xs font-semibold truncate mb-2" style={{ color }}>
                    {String(s['Scenario Name'] || `Scenario #${s.id}`)}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <Stat label="Cash/mo" val={fmtDollar(cf)} pos={cf >= 0} />
                    <Stat label="Cash-on-Cash" val={`${m.metrics.cocr.toFixed(1)}%`} pos={m.metrics.cocr >= 0} />
                    <Stat label="Cap Rate" val={`${m.metrics.capRate.toFixed(2)}%`} />
                    <Stat label="Net Op. Income/yr" val={fmtDollar(m.metrics.noi)} pos={m.metrics.noi >= 0} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex gap-2">
            <HeroCard
              label="Cash / month"
              value={fmtDollar(activeMetrics.monthlyCF)}
              sub={activeMetrics.hasLoan ? `Mortgage: ${fmtDollar(activeMetrics.monthlyMortgage)}/mo` : 'All cash'}
              positive={activeMetrics.monthlyCF >= 0}
              neutral={false}
              icon={DollarSign}
              tip="Annual cash flow after all operating expenses and mortgage payments, divided by 12."
            />
            <HeroCard
              label="Cash-on-Cash"
              value={`${activeMetrics.cocr.toFixed(1)}%`}
              sub={`Invested: ${fmtDollar(activeMetrics.totalCashInvested)}`}
              positive={activeMetrics.cocr >= 0}
              neutral={false}
              icon={Percent}
              tip="Year 1 net cash flow ÷ total upfront cash (down payment + closing costs)."
            />
            <HeroCard
              label="Cap Rate"
              value={`${activeMetrics.capRate.toFixed(2)}%`}
              sub={`Net Op. Income: ${fmtDollar(activeMetrics.noi)}/yr`}
              positive={activeMetrics.capRate >= 5}
              neutral={activeMetrics.capRate === 0}
              icon={TrendingUp}
              tip="Net Operating Income ÷ Purchase Price. Excludes financing. ≥8% great · 5–8% solid · <5% low yield."
            />
            <HeroCard
              label="Score"
              value={score != null ? `${score}/100` : '—'}
              sub={score != null ? (score >= 70 ? 'Strong buy' : score >= 45 ? 'Moderate' : 'Weak') : 'Add price & rent'}
              positive={score != null && score >= 70}
              neutral={score == null}
              icon={Star}
              tip="Investment Score: Cap Rate (25%), Cash Return (25%), Cash Flow (20%), 1% Rule (15%), GRM (15%)."
            />
          </div>
        )}
        {isBaseActive && (
          <p className="text-xs text-muted-foreground mt-1.5 px-0.5">
            Base scenario uses your saved assumptions. Edit the cards below to refine the numbers.
          </p>
        )}
      </div>

      {/* ── Compare mode content ─────────────────────────────────────────── */}
      {compareMode && (
        <div className="space-y-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">Comparing {compareIds.size} scenarios. Click chips above to add/remove (2–3).</p>
          </div>

          {compareMetrics.length >= 2 && (
            <div className="rounded-xl border bg-card p-4 space-y-1">
              <h4 className="text-sm font-semibold mb-3">Normalized Performance Comparison</h4>
              {[
                { label: 'Cash/mo', vals: compareMetrics.map((m, i) => ({ name: String(m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`), raw: m.metrics.monthlyCF, color: colorsMap[i] })), hib: true },
                { label: 'Cap Rate (%)', vals: compareMetrics.map((m, i) => ({ name: String(m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`), raw: m.metrics.capRate, color: colorsMap[i] })), hib: true },
                { label: 'Cash-on-Cash (%)', vals: compareMetrics.map((m, i) => ({ name: String(m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`), raw: m.metrics.cocr, color: colorsMap[i] })), hib: true },
                { label: 'NOI / yr', vals: compareMetrics.map((m, i) => ({ name: String(m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`), raw: m.metrics.noi, color: colorsMap[i] })), hib: true },
                { label: 'Cash Invested', vals: compareMetrics.map((m, i) => ({ name: String(m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`), raw: m.metrics.totalCashInvested, color: colorsMap[i] })), hib: false },
              ].map(r => <NormalizedBar key={r.label} label={r.label} entries={r.vals} higherIsBetter={r.hib} />)}
            </div>
          )}

          {compareMetrics.length >= 2 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Metric</th>
                      {compareScenarios.map((s, i) => (
                        <th key={s.id} className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide" style={{ color: colorsMap[i] }}>
                          {String(s['Scenario Name'] || `Scenario #${s.id}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { label: 'Purchase Price', vals: compareMetrics.map(m => fmtDollar(m.metrics.price)), raws: compareMetrics.map(m => m.metrics.price), hib: false },
                      { label: 'Annual Income', vals: compareMetrics.map(m => fmtDollar(m.metrics.income)), raws: compareMetrics.map(m => m.metrics.income), hib: true },
                      { label: 'Annual OpEx', vals: compareMetrics.map(m => fmtDollar(m.metrics.opex)), raws: compareMetrics.map(m => m.metrics.opex), hib: false },
                      { label: 'NOI / yr', vals: compareMetrics.map(m => fmtDollar(m.metrics.noi)), raws: compareMetrics.map(m => m.metrics.noi), hib: true },
                      { label: 'Cap Rate', vals: compareMetrics.map(m => `${m.metrics.capRate.toFixed(2)}%`), raws: compareMetrics.map(m => m.metrics.capRate), hib: true },
                      { label: 'Cash / month', vals: compareMetrics.map(m => fmtDollar(m.metrics.monthlyCF)), raws: compareMetrics.map(m => m.metrics.monthlyCF), hib: true },
                      { label: 'Cash-on-Cash', vals: compareMetrics.map(m => `${m.metrics.cocr.toFixed(2)}%`), raws: compareMetrics.map(m => m.metrics.cocr), hib: true },
                      { label: 'Cash Invested', vals: compareMetrics.map(m => fmtDollar(m.metrics.totalCashInvested)), raws: compareMetrics.map(m => m.metrics.totalCashInvested), hib: false },
                      { label: 'Gross Rent Multiplier (Price ÷ Gross Rent)', vals: compareMetrics.map(m => `${m.metrics.grm.toFixed(1)}×`), raws: compareMetrics.map(m => m.metrics.grm), hib: false },
                    ].map(row => {
                      const bestRaw = row.hib ? Math.max(...row.raws) : Math.min(...row.raws.filter(v => v > 0))
                      return (
                        <tr key={row.label} className="hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium text-sm">{row.label}</td>
                          {row.vals.map((val, i) => (
                            <td key={i} className={cn(
                              'px-4 py-2.5 text-right tabular-nums',
                              row.raws[i] === bestRaw
                                ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground'
                            )}>
                              {val}{row.raws[i] === bestRaw && <span className="ml-1 text-xs">★</span>}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Single mode: Assumptions grid ───────────────────────────────────── */}
      {!compareMode && (
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Income card */}
            <AssumptionCard
              title="Income"
              icon={TrendingUp}
              canEdit={canEdit}
              isEditing={editSection === 'income'}
              onEdit={() => startEdit('income', incomeFields)}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
              saveError={saveError}
              display={
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <dt className="text-xs text-muted-foreground">Gross Rent / yr</dt>
                  <dd className="text-xs font-medium tabular-nums text-right">{fmtDollar(activeMetrics.grossIncome)}</dd>
                  {activeMetrics.vacancyRate > 0 && <>
                    <dt className="text-xs text-muted-foreground">Vacancy ({activeMetrics.vacancyRate}%)</dt>
                    <dd className="text-xs tabular-nums text-right text-destructive">−{fmtDollar(activeMetrics.vacancyLoss)}</dd>
                    <dt className="text-xs text-muted-foreground font-medium">Effective Income / yr</dt>
                    <dd className="text-xs font-semibold tabular-nums text-right">{fmtDollar(activeMetrics.effectiveIncome)}</dd>
                  </>}
                  <dt className="text-xs text-muted-foreground">Monthly</dt>
                  <dd className="text-xs tabular-nums text-right">{fmtDollar(activeMetrics.effectiveIncome / 12)}</dd>
                </dl>
              }
              editForm={
                <div className="grid grid-cols-2 gap-3">
                  <InlineField label="Annual Gross Rent ($)" value={editDraft['Gross Income'] ?? ''} onChange={v => setEditDraft(d => ({ ...d, 'Gross Income': v }))} />
                  <InlineField label="Vacancy Rate (%)" value={editDraft['Vacancy Rate'] ?? String(activeScenario['Vacancy Rate'] ?? '5')} onChange={v => setEditDraft(d => ({ ...d, 'Vacancy Rate': v }))} />
                </div>
              }
            />

            {/* Expenses card */}
            <AssumptionCard
              title="Expenses"
              icon={BarChart2}
              canEdit={canEdit}
              isEditing={editSection === 'expenses'}
              onEdit={() => startEdit('expenses', expenseFields)}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
              saveError={saveError}
              display={(() => {
                const bd = activeScenario['expense_breakdown'] as Record<string, number | null> | null | undefined
                const bdEntries = bd ? (Object.entries(bd) as [string, number | null][]).filter(([, v]) => v != null && v > 0) : []
                const hasBd = bdEntries.length > 0
                const EXPENSE_LABELS: Record<string, string> = {
                  property_taxes: 'Property Tax',
                  insurance: 'Insurance',
                  cdd: 'CDD',
                  hoa: 'HOA',
                  maintenance: 'Maintenance',
                  property_management: 'Property Mgmt',
                  other: 'Other',
                }
                return (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <dt className="text-xs text-muted-foreground">Annual Oper. Expenses</dt>
                    <dd className="text-xs font-medium tabular-nums text-right">
                      {hasBd ? (
                        <button
                          type="button"
                          onClick={() => setShowExpenseBreakdown(v => !v)}
                          className="underline decoration-dotted hover:text-foreground transition-colors"
                          title="Click to show itemized breakdown"
                        >
                          {fmtDollar(activeMetrics.opex)} {showExpenseBreakdown ? '▲' : '▼'}
                        </button>
                      ) : fmtDollar(activeMetrics.opex)}
                    </dd>
                    {activeMetrics.propMgmtRate > 0 && <>
                      <dt className="text-xs text-muted-foreground">Property Mgmt ({activeMetrics.propMgmtRate}%)</dt>
                      <dd className="text-xs tabular-nums text-right text-amber-600 dark:text-amber-400">
                        {fmtDollar(activeMetrics.propMgmtExpense)}/yr
                      </dd>
                    </>}
                    {(activeMetrics.propMgmtRate > 0) && <>
                      <dt className="text-xs text-muted-foreground font-medium">Total Expenses</dt>
                      <dd className="text-xs font-semibold tabular-nums text-right">{fmtDollar(activeMetrics.totalExpenses)}</dd>
                    </>}
                    <dt className="text-xs text-muted-foreground">Monthly</dt>
                    <dd className="text-xs tabular-nums text-right">
                      {hasBd ? (
                        <button
                          type="button"
                          onClick={() => setShowExpenseBreakdown(v => !v)}
                          className="underline decoration-dotted hover:text-foreground transition-colors"
                          title="Click to show itemized breakdown"
                        >
                          {fmtDollar(activeMetrics.opex / 12)} {showExpenseBreakdown ? '▲' : '▼'}
                        </button>
                      ) : fmtDollar(activeMetrics.opex / 12)}
                    </dd>
                    {showExpenseBreakdown && hasBd && (
                      <>
                        <dt className="col-span-2 mt-1 border-t border-border/60 pt-1.5 text-xs font-medium text-muted-foreground">
                          Breakdown (from property form)
                        </dt>
                        {bdEntries.map(([key, val]) => (
                          <React.Fragment key={key}>
                            <dt className="text-xs text-muted-foreground pl-2">{EXPENSE_LABELS[key] ?? key}</dt>
                            <dd className="text-xs tabular-nums text-right text-muted-foreground">
                              {fmtDollar(val!)}/mo · {fmtDollar((val!) * 12)}/yr
                            </dd>
                          </React.Fragment>
                        ))}
                      </>
                    )}
                    <dt className="text-xs text-muted-foreground">Net Op. Income</dt>
                    <dd className={cn('text-xs font-semibold tabular-nums text-right', activeMetrics.noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {fmtDollar(activeMetrics.noi)}/yr
                    </dd>
                  </dl>
                )
              })()}
              editForm={
                <div className="grid grid-cols-2 gap-3">
                  <InlineField label="Annual Operating Expenses ($)" value={editDraft['Operating Expenses'] ?? ''} onChange={v => setEditDraft(d => ({ ...d, 'Operating Expenses': v }))} />
                  <InlineField label="Property Management (%)" value={editDraft['Property Management Rate'] ?? String(activeScenario['Property Management Rate'] ?? '0')} onChange={v => setEditDraft(d => ({ ...d, 'Property Management Rate': v }))} />
                </div>
              }
            />

            {/* Financing card */}
            <AssumptionCard
              title="Financing"
              icon={DollarSign}
              canEdit={canEdit}
              isEditing={editSection === 'loan'}
              onEdit={() => startEdit('loan', loanFields)}
              onCancel={cancelEdit}
              onSave={saveEdit}
              saving={saving}
              saveError={saveError}
              display={
                activeMetrics.hasLoan ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <dt className="text-xs text-muted-foreground">Down Payment</dt>
                    <dd className="text-xs font-medium tabular-nums text-right">
                      {+(activeScenario['Down Payment Percentage'] ?? 0) || '—'}% ({fmtDollar(activeMetrics.dp)})
                    </dd>
                    <dt className="text-xs text-muted-foreground">Rate / Term</dt>
                    <dd className="text-xs tabular-nums text-right">
                      {activeMetrics.rate}% · {activeMetrics.term}yr
                    </dd>
                    <dt className="text-xs text-muted-foreground">Monthly Payment</dt>
                    <dd className="text-xs tabular-nums text-right">{fmtDollar(activeMetrics.monthlyMortgage)}</dd>
                    {activeMetrics.dscr != null && <>
                      <dt className="text-xs text-muted-foreground">Debt Service Coverage</dt>
                      <dd className={cn('text-xs font-semibold tabular-nums text-right', activeMetrics.dscr >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                        {activeMetrics.dscr.toFixed(2)}×
                      </dd>
                    </>}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">All-cash purchase</p>
                )
              }
              editForm={
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editDraft['Has Loan'] === 'true' || editDraft['Has Loan'] === 'true' || editDraft['Has Loan'] === true as any}
                      onChange={e => setEditDraft(d => ({ ...d, 'Has Loan': String(e.target.checked) }))}
                      className="h-4 w-4 rounded"
                    />
                    Financed with mortgage
                  </label>
                  {(editDraft['Has Loan'] === 'true') && (
                    <div className="grid grid-cols-2 gap-3">
                      <InlineField label="Down Payment %" value={editDraft['Down Payment Percentage'] ?? ''} onChange={v => {
                        const price = +(activeScenario['Purchase Price'] ?? 0) || 0
                        setEditDraft(d => ({ ...d, 'Down Payment Percentage': v, 'Down Payment Amount': String(price * parseFloat(v) / 100) }))
                      }} />
                      <InlineField label="Interest Rate %" value={editDraft['Interest Rate'] ?? ''} onChange={v => setEditDraft(d => ({ ...d, 'Interest Rate': v }))} />
                      <InlineField label="Loan Term (yr)" value={editDraft['Loan Term'] ?? ''} onChange={v => setEditDraft(d => ({ ...d, 'Loan Term': v }))} />
                      <InlineField label="Loan Closing Costs ($)" value={editDraft['Closing Costs'] ?? ''} onChange={v => setEditDraft(d => ({ ...d, 'Closing Costs': v }))} />
                    </div>
                  )}
                </div>
              }
            />

            {/* Returns summary card */}
            <div className="rounded-xl border bg-card p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />Returns Summary
              </h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-xs text-muted-foreground">Cap Rate</dt>
                <dd className={cn('text-xs font-semibold tabular-nums text-right',
                  activeMetrics.capRate >= 8 ? 'text-emerald-600 dark:text-emerald-400' : activeMetrics.capRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
                )}>{activeMetrics.capRate.toFixed(2)}%</dd>
                <dt className="text-xs text-muted-foreground">Gross Rent Multiplier (Price ÷ Gross Rent)</dt>
                <dd className="text-xs tabular-nums text-right">{activeMetrics.grm > 0 ? `${activeMetrics.grm.toFixed(1)}×` : '—'}</dd>
                <dt className="text-xs text-muted-foreground">1% Rule</dt>
                <dd className={cn('text-xs font-semibold tabular-nums text-right',
                  (activeMetrics.onePercent ?? 0) >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                )}>{activeMetrics.onePercent > 0 ? `${activeMetrics.onePercent.toFixed(2)}%` : '—'}</dd>
                <dt className="text-xs text-muted-foreground">Cash Invested</dt>
                <dd className="text-xs tabular-nums text-right">{fmtDollar(activeMetrics.totalCashInvested)}</dd>
                {score != null && <>
                  <dt className="text-xs text-muted-foreground">Investment Score</dt>
                  <dd className={cn('text-xs font-bold tabular-nums text-right',
                    score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : score >= 45 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive'
                  )}>{score}/100</dd>
                </>}
              </dl>
            </div>
          </div>

          {/* Assumptions — full width */}
          <AssumptionCard
            title="Assumptions"
            icon={TrendingUp}
            canEdit={canEdit}
            isEditing={editSection === 'growth'}
            onEdit={() => startEdit('growth', {
              'Income Increase': activeScenario['Income Increase'],
              'Expenses Increase': activeScenario['Expenses Increase'],
              'Property Value Increase': activeScenario['Property Value Increase'],
              'Vacancy Rate': activeScenario['Vacancy Rate'],
              'Property Management Rate': activeScenario['Property Management Rate'],
            })}
            onCancel={cancelEdit}
            onSave={saveEdit}
            saving={saving}
            saveError={saveError}
            display={
              <dl className="grid grid-cols-3 sm:grid-cols-5 gap-x-6 gap-y-1.5">
                <div>
                  <dt className="text-xs text-muted-foreground">Rent Growth / yr</dt>
                  <dd className="text-sm font-semibold tabular-nums mt-0.5">
                    {+(activeScenario['Income Increase'] ?? 3)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Expense Growth / yr</dt>
                  <dd className="text-sm font-semibold tabular-nums mt-0.5">
                    {+(activeScenario['Expenses Increase'] ?? 3)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Appreciation / yr</dt>
                  <dd className="text-sm font-semibold tabular-nums mt-0.5">
                    {+(activeScenario['Property Value Increase'] ?? 3)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vacancy Rate</dt>
                  <dd className={cn('text-sm font-semibold tabular-nums mt-0.5',
                    +(activeScenario['Vacancy Rate'] ?? 5) > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                  )}>
                    {+(activeScenario['Vacancy Rate'] ?? 5)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Prop. Mgmt Rate</dt>
                  <dd className={cn('text-sm font-semibold tabular-nums mt-0.5',
                    +(activeScenario['Property Management Rate'] ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : ''
                  )}>
                    {+(activeScenario['Property Management Rate'] ?? 0)}% of eff. income
                  </dd>
                </div>
              </dl>
            }
            editForm={
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <InlineField
                  label="Rent Growth %/yr"
                  value={editDraft['Income Increase'] ?? String(+(activeScenario['Income Increase'] ?? 3))}
                  onChange={v => setEditDraft(d => ({ ...d, 'Income Increase': v }))}
                />
                <InlineField
                  label="Expense Growth %/yr"
                  value={editDraft['Expenses Increase'] ?? String(+(activeScenario['Expenses Increase'] ?? 3))}
                  onChange={v => setEditDraft(d => ({ ...d, 'Expenses Increase': v }))}
                />
                <InlineField
                  label="Appreciation %/yr"
                  value={editDraft['Property Value Increase'] ?? String(+(activeScenario['Property Value Increase'] ?? 3))}
                  onChange={v => setEditDraft(d => ({ ...d, 'Property Value Increase': v }))}
                />
                <InlineField
                  label="Vacancy Rate %"
                  value={editDraft['Vacancy Rate'] ?? String(+(activeScenario['Vacancy Rate'] ?? 5))}
                  onChange={v => setEditDraft(d => ({ ...d, 'Vacancy Rate': v }))}
                />
                <InlineField
                  label="Property Mgmt %"
                  value={editDraft['Property Management Rate'] ?? String(activeScenario['Property Management Rate'] ?? 0)}
                  onChange={v => setEditDraft(d => ({ ...d, 'Property Management Rate': v }))}
                />
              </div>
            }
          />
        </div>
      )}

      {/* ── Disclosure panels ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        {[
          { id: 'pl', label: 'Year-by-Year Projections', icon: Activity },
          ...(activeMetrics.hasLoan && !isBaseActive ? [{ id: 'amort', label: 'Amortization Schedule', icon: BarChart2 }] : []),
          ...(!compareMode ? [{ id: 'sensitivity', label: 'What-If Sensitivity', icon: TrendingUp }] : []),
        ].map(({ id, label, icon: Icon }) => (
          <div key={id} className="rounded-xl border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => togglePanel(id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </span>
              {openPanels.has(id) ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {openPanels.has(id) && (
              <div className="border-t border-border/80 p-4">
                {id === 'pl' && <PLTable scenario={activeScenario} />}
                {id === 'amort' && !isBaseActive && (() => {
                  const s = activeScenario
                  const term = +(s['Loan Term'] ?? 0) || 0
                  const price = +(s['Purchase Price'] ?? 0) || 0
                  const dp = +(s['Down Payment Amount'] ?? 0) || 0
                  const rate = +(s['Interest Rate'] ?? 0) || 0
                  const principal = price - dp
                  const mr = rate / 100 / 12
                  const np = term * 12
                  const mp = principal > 0 && mr > 0 && np > 0
                    ? principal * (mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1)
                    : 0
                  return (
                    <AmortizationTable
                      loanTerm={term || null}
                      principal={principal > 0 ? principal : null}
                      interestRate={rate || null}
                      monthlyPayment={mp > 0 ? mp : null}
                    />
                  )
                })()}
                {id === 'sensitivity' && (
                  <SensitivityPanel scenario={activeScenario} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Create a scenario CTA (no scenarios yet) ────────────────────── */}
      {scenarios.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-sm font-medium mb-1">No scenarios yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Model real loan terms, negotiated prices, and stress scenarios to see how this deal actually performs.
          </p>
          <button
            onClick={() => setNewDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />Create first scenario
          </button>
        </div>
      )}

      {/* ── New scenario dialog ──────────────────────────────────────────── */}
      {newDialogOpen && (
        <NewScenarioDialog
          property={property}
          baseScenario={baseScenario}
          activeScenario={activeScenario}
          onClose={() => setNewDialogOpen(false)}
          onCreated={(newScenario) => {
            setScenarios(prev => [newScenario as ScenarioRow, ...prev.filter(s => !s.is_base), ...(prev.filter(s => s.is_base))])
            setActiveId((newScenario as ScenarioRow).id)
            setNewDialogOpen(false)
            startTransition(() => router.refresh())
          }}
        />
      )}

      {/* ── Print All overlay ────────────────────────────────────────────── */}
      {printAllOpen && (
        <PropertyPrintView
          property={property}
          baseScenario={baseScenario}
          scenarios={scenarios}
          onClose={() => setPrintAllOpen(false)}
        />
      )}
    </div>
  )
}

// ─── AssumptionCard ───────────────────────────────────────────────────────────

function AssumptionCard({
  title, icon: Icon, canEdit, isEditing, onEdit, onCancel, onSave, saving, saveError, display, editForm,
}: {
  title: string
  icon: React.ElementType
  canEdit: boolean
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
  display: React.ReactNode
  editForm: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />{title}
        </h4>
        {canEdit && !isEditing && (
          <button onClick={onEdit} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {isEditing && (
          <button onClick={onCancel} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div>
          {editForm}
          {saveError && <p className="text-xs text-destructive mt-2">{saveError}</p>}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border/60">
            <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-md border hover:bg-muted transition-colors">Cancel</button>
            <button onClick={onSave} disabled={saving} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : <><Check className="h-3 w-3 inline mr-1" />Save</>}
            </button>
          </div>
        </div>
      ) : display}
    </div>
  )
}

// Tiny stat for compare hero
function Stat({ label, val, pos }: { label: string; val: string; pos?: boolean }) {
  return (
    <>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums text-right', pos === true ? 'text-emerald-600 dark:text-emerald-400' : pos === false ? 'text-destructive' : '')}>
        {val}
      </span>
    </>
  )
}

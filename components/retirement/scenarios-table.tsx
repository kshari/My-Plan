'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from './scenario-context'
import { Plus, Trash2, Check, LineChart, BarChart2, GitCompareArrows, X, RefreshCw, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  SCORE_AT_RISK_THRESHOLD,
  SCORE_MEDIUM_RISK_THRESHOLD,
  SCORE_WEIGHT_SCENARIO_LONGEVITY,
  SCORE_WEIGHT_SCENARIO_SCORE,
} from '@/lib/constants/retirement-defaults'
import { calculateAndSaveProjectionsForScenario } from '@/lib/utils/calculate-projections'

interface Scenario {
  id: number
  scenario_name: string
  is_default: boolean
  created_at?: string
}

interface ScenarioMetrics {
  scenarioId: number
  retirementAge?: number
  retirementStartYear?: number
  overallScore?: number
  startingNetworth?: number
  endingNetworth?: number
  growthRateBefore?: number
  growthRateDuring?: number
  inflationRate?: number
  ssaStartAge?: number
  avgMonthlyIncome?: number
  yearsMoneyLasts?: number | 'full'
}

interface ScenarioRow extends Scenario {
  metrics?: ScenarioMetrics
}

interface ScenariosTableProps {
  planId: number
  onAddScenario?: () => void
  onModelScenarios?: () => void
  onViewProjections?: (scenarioId: number) => void
  /** When this value changes, scenarios are reloaded (e.g. after saving a new scenario from Plan Setup). */
  refreshTrigger?: number
}

const fmt$ = (n: number) =>
  '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })

const fmt$k = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return fmt$(n)
}

// ── Comparison Panel ─────────────────────────────────────────────────────────

interface CompareMetric {
  label: string
  key: keyof ScenarioMetrics
  format: (v: unknown) => string
  /** higher is better (true) | lower is better (false) | null = no highlight */
  higherBetter: boolean | null
}

const COMPARE_METRICS: CompareMetric[] = [
  {
    label: 'Retirement Age',
    key: 'retirementAge',
    format: (v) => v != null ? String(v) : '—',
    higherBetter: false,
  },
  {
    label: 'Pre-Ret. Growth',
    key: 'growthRateBefore',
    format: (v) => v != null ? `${((v as number) * 100).toFixed(1)}%` : '—',
    higherBetter: true,
  },
  {
    label: 'Post-Ret. Growth',
    key: 'growthRateDuring',
    format: (v) => v != null ? `${((v as number) * 100).toFixed(1)}%` : '—',
    higherBetter: true,
  },
  {
    label: 'Inflation Rate',
    key: 'inflationRate',
    format: (v) => v != null ? `${((v as number) * 100).toFixed(1)}%` : '—',
    higherBetter: false,
  },
  {
    label: 'SSA Start Age',
    key: 'ssaStartAge',
    format: (v) => v != null ? String(v) : '—',
    higherBetter: null,
  },
  {
    label: 'Portfolio at Retirement',
    key: 'startingNetworth',
    format: (v) => v != null ? fmt$k(v as number) : '—',
    higherBetter: true,
  },
  {
    label: 'Final Net Worth',
    key: 'endingNetworth',
    format: (v) => v != null ? fmt$k(v as number) : '—',
    higherBetter: true,
  },
  {
    label: 'Avg Monthly Income',
    key: 'avgMonthlyIncome',
    format: (v) => v != null ? fmt$(v as number) + '/mo' : '—',
    higherBetter: true,
  },
  {
    label: 'Years Money Lasts',
    key: 'yearsMoneyLasts',
    format: (v) => v === 'full' ? 'Full life' : v != null ? `${v} yrs` : '—',
    higherBetter: true,
  },
  {
    label: 'Comparative Score',
    key: 'overallScore',
    format: (v) => v != null ? String(v) : '—',
    higherBetter: true,
  },
]

interface ComparisonPanelProps {
  rows: ScenarioRow[]
  onClose: () => void
}

function ComparisonPanel({ rows, onClose }: ComparisonPanelProps) {
  const getBest = (metric: CompareMetric) => {
    if (metric.higherBetter === null) return null
    const vals = rows
      .map((r) => r.metrics?.[metric.key])
      .filter((v) => v != null && v !== 'full') as number[]
    if (vals.length === 0) return null
    return metric.higherBetter === true ? Math.max(...vals) : Math.min(...vals)
  }

  const scoreColor = (score?: number) => {
    if (score == null) return ''
    if (score >= SCORE_MEDIUM_RISK_THRESHOLD) return 'text-emerald-600 dark:text-emerald-400'
    if (score >= SCORE_AT_RISK_THRESHOLD) return 'text-amber-600'
    return 'text-destructive'
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Scenario Comparison</span>
          <Badge variant="secondary" className="text-[10px]">{rows.length} scenarios</Badge>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close comparison">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comparison grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide w-40 min-w-[10rem]">
                Metric
              </th>
              {rows.map((row) => (
                <th key={row.id} className="px-4 py-2.5 text-center min-w-[9rem]">
                  <div className="font-semibold text-foreground truncate max-w-[8rem] mx-auto" title={row.scenario_name}>
                    {row.scenario_name}
                  </div>
                  {row.is_default && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">Default</Badge>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_METRICS.map((metric, mi) => {
              const best = getBest(metric)
              return (
                <tr key={metric.key} className={mi % 2 === 0 ? 'bg-muted/20' : ''}>
                  <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {metric.label}
                  </td>
                  {rows.map((row) => {
                    const raw = row.metrics?.[metric.key]
                    const numVal = raw !== 'full' ? (raw as number | undefined) : undefined
                    const isBest = best != null && numVal != null && numVal === best
                    const formatted = metric.format(raw)

                    if (metric.key === 'overallScore') {
                      return (
                        <td key={row.id} className={`px-4 py-2.5 text-center tabular-nums font-bold ${scoreColor(raw as number | undefined)}`}>
                          {formatted}
                        </td>
                      )
                    }
                    return (
                      <td
                        key={row.id}
                        className={`px-4 py-2.5 text-center tabular-nums ${
                          isBest ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''
                        } ${raw == null ? 'text-muted-foreground' : ''}`}
                      >
                        {formatted}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground border-t">
        Best value per metric highlighted in green.
      </p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScenariosTable({ planId, onAddScenario, onModelScenarios, onViewProjections, refreshTrigger }: ScenariosTableProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [metrics, setMetrics] = useState<Map<number, ScenarioMetrics>>(new Map())
  const [loading, setLoading] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set())
  const [recalculatingIds, setRecalculatingIds] = useState<Set<number>>(new Set())
  // Tracks whether the next metrics load should auto-recalculate scenarios with missing projections
  const pendingAutoRecalcRef = useRef(false)

  useEffect(() => { loadScenarios() }, [planId, refreshTrigger])
  useEffect(() => { if (scenarios.length > 0) loadMetrics() }, [scenarios])

  // Listen for agent scenario mutations and flag that auto-recalc should run after next metrics load
  useEffect(() => {
    const handler = () => { pendingAutoRecalcRef.current = true }
    window.addEventListener('agent:scenario-mutated', handler)
    return () => window.removeEventListener('agent:scenario-mutated', handler)
  }, [])

  const loadScenarios = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('rp_scenarios')
        .select('*')
        .eq('plan_id', planId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      setScenarios(data || [])
      if (data && data.length > 0 && !selectedScenarioId) {
        const def = data.find((s) => s.is_default) || data[0]
        setSelectedScenarioId(def.id)
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    const map = new Map<number, ScenarioMetrics>()
    for (const scenario of scenarios) {
      try {
        const { data: settings } = await supabase
          .from('rp_calculator_settings')
          .select('retirement_age, retirement_start_year, growth_rate_before_retirement, growth_rate_during_retirement, inflation_rate, ssa_start_age')
          .eq('scenario_id', scenario.id)
          .maybeSingle()
        const { data: projections } = await supabase
          .from('rp_projection_details')
          .select('age, networth, gap_excess, total_income, tax, after_tax_income')
          .eq('scenario_id', scenario.id)
          .order('year')

        let overallScore: number | undefined
        let startingNetworth: number | undefined
        let endingNetworth: number | undefined
        let avgMonthlyIncome: number | undefined
        let yearsMoneyLasts: number | 'full' | undefined

        if (projections && projections.length > 0) {
          const retireAge = settings?.retirement_age
          const retireProjns = retireAge
            ? projections.filter((p: any) => (p.age ?? 0) >= retireAge)
            : projections
          const retireProjn = retireProjns[0] ?? null

          // Sustainability: % of RETIREMENT years where income covers expenses (no deficit)
          const negYears = retireProjns.filter((p: any) => (p.gap_excess || 0) < -1000).length
          const sustScore = Math.max(0, 100 - (negYears / Math.max(retireProjns.length, 1)) * 100)

          // Income quality: surplus ratio in retirement (gap_excess / after_tax_income)
          // Positive gap_excess = income exceeds expenses → score above 50; deficit → below 50
          const totalAfterTax = retireProjns.reduce((s: number, p: any) => s + (p.after_tax_income || 0), 0)
          const totalGap = retireProjns.reduce((s: number, p: any) => s + (p.gap_excess || 0), 0)
          const incomeScore = totalAfterTax > 0
            ? Math.min(100, Math.max(0, 50 + (totalGap / totalAfterTax) * 50))
            : 50

          // Longevity: net worth preservation through retirement (retirement-start → end)
          const initRetireNW = retireProjn?.networth || 0
          const finalNW = projections[projections.length - 1]?.networth || 0
          const lonScore = initRetireNW > 0
            ? Math.min(100, Math.max(0, (finalNW / initRetireNW) * 50))
            : 0

          overallScore = Math.round(
            sustScore * SCORE_WEIGHT_SCENARIO_LONGEVITY +
            incomeScore * SCORE_WEIGHT_SCENARIO_SCORE +
            lonScore * SCORE_WEIGHT_SCENARIO_SCORE
          )
          startingNetworth = retireProjn?.networth ?? (projections[0]?.networth || 0)
          endingNetworth = finalNW

          // Average monthly after-tax income in first 10 years of retirement
          const earlyRet = retireProjns.slice(0, 10)
          avgMonthlyIncome = earlyRet.length > 0
            ? earlyRet.reduce((s: number, p: any) => s + (p.after_tax_income || 0), 0) / earlyRet.length / 12
            : undefined

          // Years money lasts
          const depletionIdx = retireProjns.findIndex((p: any) => (p.networth ?? 0) <= 0)
          yearsMoneyLasts = depletionIdx === -1 ? 'full' : depletionIdx + 1
        }

        map.set(scenario.id, {
          scenarioId: scenario.id,
          retirementAge: settings?.retirement_age,
          retirementStartYear: settings?.retirement_start_year,
          overallScore,
          startingNetworth,
          endingNetworth,
          growthRateBefore: settings?.growth_rate_before_retirement,
          growthRateDuring: settings?.growth_rate_during_retirement,
          inflationRate: settings?.inflation_rate,
          ssaStartAge: settings?.ssa_start_age,
          avgMonthlyIncome,
          yearsMoneyLasts,
        })
      } catch (err) {
        console.error(`Metrics error for scenario ${scenario.id}:`, err)
      }
    }
    setMetrics(map)

    // After an agent mutation, auto-recalculate any scenario that ended up with no projection data
    if (pendingAutoRecalcRef.current) {
      pendingAutoRecalcRef.current = false
      const missingIds = scenarios
        .filter((s) => map.get(s.id)?.overallScore === undefined)
        .map((s) => s.id)
      if (missingIds.length > 0) {
        setRecalculatingIds(new Set(missingIds))
        Promise.all(
          missingIds.map((id) =>
            calculateAndSaveProjectionsForScenario(planId, id).catch((err) =>
              console.warn(`[auto-recalc] failed for scenario ${id}:`, err)
            )
          )
        ).then(async () => {
          setRecalculatingIds(new Set())
          await loadMetrics()
        })
      }
    }
  }

  const handleRecalculate = async (scenarioId: number) => {
    setRecalculatingIds((prev) => new Set(prev).add(scenarioId))
    try {
      const scenario = scenarios.find((s) => s.id === scenarioId)
      if (!scenario) throw new Error('Scenario not found')
      // Find plan_id from metrics or fall back to the plan's scenarios list
      const planIdForScenario = planId
      await calculateAndSaveProjectionsForScenario(planIdForScenario, scenarioId)
      toast.success(`Projections recalculated for "${scenario.scenario_name}"`)
      await loadMetrics()
    } catch (err: any) {
      toast.error(`Recalculate failed: ${err.message}`)
    } finally {
      setRecalculatingIds((prev) => { const n = new Set(prev); n.delete(scenarioId); return n })
    }
  }

  const handleDelete = async (scenarioId: number) => {
    try {
      await supabase.from('rp_projection_details').delete().eq('scenario_id', scenarioId)
      await supabase.from('rp_calculator_settings').delete().eq('scenario_id', scenarioId)
      const { error } = await supabase.from('rp_scenarios').delete().eq('id', scenarioId)
      if (error) throw error
      toast.success('Scenario deleted')
      setCompareIds((prev) => { const n = new Set(prev); n.delete(scenarioId); return n })
      if (selectedScenarioId === scenarioId) {
        const remaining = scenarios.filter((s) => s.id !== scenarioId)
        setSelectedScenarioId(remaining.length > 0 ? remaining[0].id : null)
      }
      await loadScenarios()
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`)
    }
  }

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      for (const s of scenarios) {
        await supabase.from('rp_projection_details').delete().eq('scenario_id', s.id)
        await supabase.from('rp_calculator_settings').delete().eq('scenario_id', s.id)
      }
      const { error } = await supabase.from('rp_scenarios').delete().eq('plan_id', planId)
      if (error) throw error
      setSelectedScenarioId(null)
      toast.success('All scenarios deleted')
      await loadScenarios()
    } catch (error: any) {
      toast.error(`Failed to delete all: ${error.message}`)
    } finally {
      setDeletingAll(false)
      setCompareIds(new Set())
    }
  }

  const toggleCompare = (id: number) =>
    setCompareIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else if (n.size < 4) { n.add(id) }
      return n
    })

  // Build combined row data
  const tableData: ScenarioRow[] = scenarios.map((s) => ({ ...s, metrics: metrics.get(s.id) }))
  const compareRows = tableData.filter((r) => compareIds.has(r.id))

  const tableColumns: ColumnDef<ScenarioRow>[] = [
    {
      id: 'compare',
      header: () => <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Compare</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Checkbox
          checked={compareIds.has(row.original.id)}
          onCheckedChange={() => toggleCompare(row.original.id)}
          disabled={!compareIds.has(row.original.id) && compareIds.size >= 4}
          aria-label={`Compare ${row.original.scenario_name}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      accessorKey: 'scenario_name',
      header: 'Scenario',
      cell: ({ row }) => (
        <div className="flex items-start gap-1.5 min-w-0 group">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                className="font-medium truncate text-left hover:underline hover:text-primary transition-colors"
                onClick={() => {
                  setSelectedScenarioId(row.original.id)
                  onViewProjections?.(row.original.id)
                }}
                title="View projections"
              >
                {row.original.scenario_name}
              </button>
              {onViewProjections && (
                <button
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); setSelectedScenarioId(row.original.id); onViewProjections(row.original.id) }}
                  title="View projections"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {(row.original.is_default || selectedScenarioId === row.original.id) && (
              <div className="flex items-center gap-1 mt-0.5">
                {row.original.is_default && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Default</Badge>
                )}
                {selectedScenarioId === row.original.id && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary">Active</Badge>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorFn: (row) => row.metrics?.retirementAge,
      id: 'retirement_age',
      header: 'Retire Age',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.metrics?.retirementAge ?? '—'}</span>
      ),
    },
    {
      id: 'growth_rates',
      header: 'Growth Rates',
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original.metrics
        if (m?.growthRateBefore == null || m?.growthRateDuring == null) return <span className="text-muted-foreground">—</span>
        return (
          <span className="tabular-nums text-xs">
            {(m.growthRateBefore * 100).toFixed(1)}% / {(m.growthRateDuring * 100).toFixed(1)}%
          </span>
        )
      },
    },
    {
      accessorFn: (row) => row.metrics?.startingNetworth,
      id: 'starting_networth',
      header: 'Starting NW',
      cell: ({ row }) => {
        const v = row.original.metrics?.startingNetworth
        return <span className="tabular-nums">{v != null ? fmt$k(v) : <span className="text-muted-foreground">—</span>}</span>
      },
    },
    {
      accessorFn: (row) => row.metrics?.endingNetworth,
      id: 'ending_networth',
      header: 'Ending NW',
      cell: ({ row }) => {
        const v = row.original.metrics?.endingNetworth
        if (v == null) return <span className="text-muted-foreground">—</span>
        return <span className={`tabular-nums font-medium ${v < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmt$k(v)}</span>
      },
    },
    {
      accessorFn: (row) => row.metrics?.overallScore,
      id: 'score',
      header: () => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1">
              Comparative Score
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left space-y-2 p-3">
            <p className="font-semibold text-sm">Comparative Score (0–100)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A composite score for comparing scenarios across three dimensions:
            </p>
            <ul className="text-xs space-y-1">
              <li><span className="font-medium">Sustainability (50%)</span> — % of retirement years with no significant income shortfall</li>
              <li><span className="font-medium">Income Surplus (25%)</span> — how much after-tax income exceeds expenses on average</li>
              <li><span className="font-medium">Wealth Preservation (25%)</span> — net worth at end of life vs net worth at retirement start</li>
            </ul>
            <p className="text-xs text-muted-foreground border-t pt-1.5">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">≥ 75</span> strong ·{' '}
              <span className="text-amber-600 font-medium">50–74</span> moderate ·{' '}
              <span className="text-destructive font-medium">&lt; 50</span> needs attention
            </p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const score = row.original.metrics?.overallScore
        if (score == null) return <span className="text-muted-foreground">—</span>
        const color = score >= SCORE_MEDIUM_RISK_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400' : score >= SCORE_AT_RISK_THRESHOLD ? 'text-amber-600' : 'text-destructive'
        return <span className={`font-bold tabular-nums ${color}`}>{score}</span>
      },
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const isSelected = selectedScenarioId === row.original.id
        const isRecalculating = recalculatingIds.has(row.original.id)
        return (
          <div className="flex items-center gap-1.5 justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); handleRecalculate(row.original.id) }}
              title="Recalculate projections"
              disabled={isRecalculating}
              className="text-muted-foreground hover:text-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant={isSelected ? 'default' : 'outline'}
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); setSelectedScenarioId(row.original.id) }}
              title={isSelected ? 'Selected' : 'Select'}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete scenario?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{row.original.scenario_name}</strong> and all associated projections and settings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(row.original.id)} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )
      },
    },
  ]

  if (loading) return <div className="py-6 text-center text-sm text-muted-foreground">Loading scenarios…</div>

  if (scenarios.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 py-10 text-center">
        <p className="text-sm text-muted-foreground">No scenarios yet. Create your first scenario in Plan Details.</p>
        {onAddScenario && (
          <Button size="sm" className="mt-4" onClick={onAddScenario}>
            <Plus className="h-4 w-4" /> Add Scenario
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">Scenarios</h3>
          {compareIds.size >= 2 && (
            <Badge variant="secondary" className="text-[10px]">
              {compareIds.size} selected for comparison
            </Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {compareIds.size >= 2 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const el = document.getElementById('scenario-comparison-panel')
                el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }}
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare ({compareIds.size})
            </Button>
          )}
          {compareIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCompareIds(new Set())}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
          {onModelScenarios && (
            <Button variant="outline" size="sm" onClick={onModelScenarios}>
              <LineChart className="h-4 w-4" />
              Scenario Modeling
            </Button>
          )}
          {onAddScenario && (
            <Button variant="outline" size="sm" onClick={onAddScenario}>
              <Plus className="h-4 w-4" />
              Add Scenario
            </Button>
          )}
          {scenarios.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10" disabled={deletingAll}>
                  <Trash2 className="h-4 w-4" />
                  {deletingAll ? 'Deleting…' : 'Delete All'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all scenarios?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {scenarios.length} scenarios and their associated data. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <DataTable
        columns={tableColumns}
        data={tableData}
        searchPlaceholder="Search scenarios…"
        pageSize={10}
        emptyMessage="No scenarios found."
      />

      {compareRows.length >= 2 && (
        <div id="scenario-comparison-panel">
          <ComparisonPanel rows={compareRows} onClose={() => setCompareIds(new Set())} />
        </div>
      )}
    </div>
  )
}

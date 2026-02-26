'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from './scenario-context'
import { Plus, Trash2, Check, LineChart } from 'lucide-react'
import { toast } from 'sonner'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  riskLevel?: string
  startingNetworth?: number
  endingNetworth?: number
  growthRateBefore?: number
  growthRateDuring?: number
}

interface ScenarioRow extends Scenario {
  metrics?: ScenarioMetrics
}

interface ScenariosTableProps {
  planId: number
  onAddScenario?: () => void
  onModelScenarios?: () => void
}

const fmt$ = (n: number) =>
  '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })

export default function ScenariosTable({ planId, onAddScenario, onModelScenarios }: ScenariosTableProps) {
  const supabase = createClient()
  const { selectedScenarioId, setSelectedScenarioId } = useScenario()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [metrics, setMetrics] = useState<Map<number, ScenarioMetrics>>(new Map())
  const [loading, setLoading] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => { loadScenarios() }, [planId])
  useEffect(() => { if (scenarios.length > 0) loadMetrics() }, [scenarios])

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
          .select('retirement_age, retirement_start_year, growth_rate_before_retirement, growth_rate_during_retirement')
          .eq('scenario_id', scenario.id)
          .maybeSingle()
        const { data: projections } = await supabase
          .from('rp_projection_details')
          .select('*')
          .eq('scenario_id', scenario.id)
          .order('year')

        let overallScore: number | undefined
        let riskLevel: string | undefined
        let startingNetworth: number | undefined
        let endingNetworth: number | undefined

        if (projections && projections.length > 0) {
          const negYears = projections.filter((p: any) => (p.gap_excess || 0) < 0).length
          const sustScore = Math.max(0, 100 - (negYears / projections.length) * 100)
          const totalTax = projections.reduce((s: number, p: any) => s + (p.tax || 0), 0)
          const totalInc = projections.reduce((s: number, p: any) => s + (p.total_income || 0), 0)
          const taxScore = totalInc > 0 ? Math.max(0, 100 - (totalTax / totalInc) * 200) : 50
          const finalNW = projections[projections.length - 1]?.networth || 0
          const initNW = projections[0]?.networth || 0
          const lonScore = initNW > 0 ? Math.min(100, (finalNW / initNW) * 50 + 50) : 0
          overallScore = Math.round(sustScore * 0.5 + taxScore * 0.25 + lonScore * 0.25)
          riskLevel = overallScore < 50 ? 'High' : overallScore < 75 ? 'Medium' : 'Low'
          const retireProjn = settings?.retirement_age
            ? projections.find((p: any) => p.age === settings.retirement_age)
            : null
          startingNetworth = retireProjn?.networth ?? initNW
          endingNetworth = finalNW
        }

        map.set(scenario.id, {
          scenarioId: scenario.id,
          retirementAge: settings?.retirement_age,
          retirementStartYear: settings?.retirement_start_year,
          overallScore,
          riskLevel,
          startingNetworth,
          endingNetworth,
          growthRateBefore: settings?.growth_rate_before_retirement,
          growthRateDuring: settings?.growth_rate_during_retirement,
        })
      } catch (err) {
        console.error(`Metrics error for scenario ${scenario.id}:`, err)
      }
    }
    setMetrics(map)
  }

  const handleDelete = async (scenarioId: number) => {
    try {
      await supabase.from('rp_projection_details').delete().eq('scenario_id', scenarioId)
      await supabase.from('rp_calculator_settings').delete().eq('scenario_id', scenarioId)
      const { error } = await supabase.from('rp_scenarios').delete().eq('id', scenarioId)
      if (error) throw error
      toast.success('Scenario deleted')
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
    }
  }

  // Build combined row data
  const tableData: ScenarioRow[] = scenarios.map((s) => ({ ...s, metrics: metrics.get(s.id) }))

  const tableColumns: ColumnDef<ScenarioRow>[] = [
    {
      accessorKey: 'scenario_name',
      header: 'Scenario',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{row.original.scenario_name}</span>
          {row.original.is_default && (
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">Default</Badge>
          )}
          {selectedScenarioId === row.original.id && (
            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-primary text-primary">Active</Badge>
          )}
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
        return <span className="tabular-nums">{v != null ? fmt$(v) : <span className="text-muted-foreground">—</span>}</span>
      },
    },
    {
      accessorFn: (row) => row.metrics?.endingNetworth,
      id: 'ending_networth',
      header: 'Ending NW',
      cell: ({ row }) => {
        const v = row.original.metrics?.endingNetworth
        if (v == null) return <span className="text-muted-foreground">—</span>
        return <span className={`tabular-nums font-medium ${v < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmt$(v)}</span>
      },
    },
    {
      accessorFn: (row) => row.metrics?.overallScore,
      id: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const score = row.original.metrics?.overallScore
        if (score == null) return <span className="text-muted-foreground">—</span>
        const color = score >= 75 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600' : 'text-destructive'
        return <span className={`font-bold tabular-nums ${color}`}>{score}</span>
      },
    },
    {
      accessorFn: (row) => row.metrics?.riskLevel,
      id: 'risk',
      header: 'Risk',
      cell: ({ row }) => {
        const risk = row.original.metrics?.riskLevel
        if (!risk) return <span className="text-muted-foreground">—</span>
        const variant = risk === 'Low' ? 'success' : risk === 'Medium' ? 'warning' : 'destructive'
        return <Badge variant={variant as any}>{risk}</Badge>
      },
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const isSelected = selectedScenarioId === row.original.id
        return (
          <div className="flex items-center gap-1.5 justify-end">
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
    <div className="space-y-3">
      {/* Header toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold">Scenarios</h3>
        <div className="flex gap-2 flex-wrap">
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
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_BADGE_STYLES, ACTIVE_DEAL_STAGES,
} from '@/lib/constants/property-defaults'
import type { DealStage, DealStageHistoryEntry } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, Percent } from 'lucide-react'

interface Property {
  id: number
  address: string | null
  city: string | null
  deal_stage: string | null
  stage_updated_at: string | null
  'Asking Price': number | null
  created_at: string
}

interface PipelineFunnelMetricsProps {
  properties: Property[]
  stageHistory: DealStageHistoryEntry[]
}

export function PipelineFunnelMetrics({ properties, stageHistory }: PipelineFunnelMetricsProps) {
  const { stageCounts, stageValues, avgDaysInStage, conversionRates } = useMemo(() => {
    // Count / value per stage (current)
    const stageCounts: Record<string, number> = {}
    const stageValues: Record<string, number> = {}
    for (const p of properties) {
      const stage = p.deal_stage ?? 'lead'
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
      stageValues[stage] = (stageValues[stage] ?? 0) + (p['Asking Price'] ?? 0)
    }

    // Avg days in each stage (using history: time between consecutive stage entries)
    const avgDaysInStage: Record<string, number | null> = {}
    // Group history by property
    const byProp: Record<number, DealStageHistoryEntry[]> = {}
    for (const h of stageHistory) {
      const pid = h.property_id
      if (!byProp[pid]) byProp[pid] = []
      byProp[pid].push(h)
    }
    const daysPerStage: Record<string, number[]> = {}
    for (const entries of Object.values(byProp)) {
      const sorted = [...entries].sort(
        (a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime()
      )
      for (let i = 0; i < sorted.length - 1; i++) {
        const stage = sorted[i].stage
        const days =
          (new Date(sorted[i + 1].entered_at).getTime() - new Date(sorted[i].entered_at).getTime()) /
          (1000 * 60 * 60 * 24)
        if (!daysPerStage[stage]) daysPerStage[stage] = []
        daysPerStage[stage].push(days)
      }
    }
    for (const [stage, days] of Object.entries(daysPerStage)) {
      avgDaysInStage[stage] = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
    }

    // Conversion rates: % of deals that moved from one stage to the next
    const conversionRates: Record<string, number | null> = {}
    for (let i = 0; i < ACTIVE_DEAL_STAGES.length - 1; i++) {
      const from = ACTIVE_DEAL_STAGES[i]
      const to = ACTIVE_DEAL_STAGES[i + 1]
      const fromCount = stageHistory.filter((h) => h.stage === from).length
      const toCount = stageHistory.filter((h) => h.stage === to).length
      if (fromCount > 0) {
        conversionRates[`${from}→${to}`] = Math.round((toCount / fromCount) * 100)
      }
    }

    return { stageCounts, stageValues, avgDaysInStage, conversionRates }
  }, [properties, stageHistory])

  const totalActive = properties.filter((p) => p.deal_stage !== 'exit' && p.deal_stage !== 'dead').length
  const totalExited = (stageCounts['exit'] ?? 0)
  const totalDead = (stageCounts['dead'] ?? 0)

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Active Deals"
          value={String(totalActive)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          label="Exited / Sold"
          value={String(totalExited)}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          label="Dead / Passed"
          value={String(totalDead)}
          icon={<TrendingUp className="h-4 w-4 text-red-400" />}
        />
        <StatCard
          label="Total Properties"
          value={String(properties.length)}
          icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
        />
      </div>

      {/* Funnel by stage */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-sm mb-4">Deal Funnel</h3>
        <div className="space-y-2">
          {ACTIVE_DEAL_STAGES.map((stage) => {
            const count = stageCounts[stage] ?? 0
            const value = stageValues[stage] ?? 0
            const maxCount = Math.max(...ACTIVE_DEAL_STAGES.map((s) => stageCounts[s] ?? 0), 1)
            const pct = Math.round((count / maxCount) * 100)
            const days = avgDaysInStage[stage]
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <Badge className={cn('text-xs w-full justify-center', DEAL_STAGE_BADGE_STYLES[stage])}>
                    {DEAL_STAGE_LABELS[stage]}
                  </Badge>
                </div>
                <div className="flex-1 relative h-6 rounded-full bg-muted overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/40 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 justify-between">
                    <span className="text-xs font-medium">{count} deal{count !== 1 ? 's' : ''}</span>
                    {value > 0 && <span className="text-xs text-muted-foreground">{fmt(value)}</span>}
                  </div>
                </div>
                {days != null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground w-20 shrink-0 justify-end">
                    <Clock className="h-3 w-3" />
                    {days}d avg
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stage-to-stage conversion rates */}
      {Object.keys(conversionRates).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            Stage Conversion Rates
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(conversionRates).map(([key, rate]) => {
              const [fromStage, toStage] = key.split('→') as [DealStage, DealStage]
              return (
                <div key={key} className="rounded-lg border border-border p-3 text-center space-y-1">
                  <div className="text-lg font-bold">
                    {rate != null ? `${rate}%` : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {DEAL_STAGE_LABELS[fromStage]} → {DEAL_STAGE_LABELS[toStage]}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SCORE_ON_TRACK_THRESHOLD, SCORE_CLOSE_THRESHOLD } from '@/lib/constants/retirement-defaults'
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

interface RetirementPlan {
  id: number
  plan_name: string
  created_at: string
  updated_at: string
}

interface PlanMetrics {
  plan_id: number
  current_age?: number | null
  retirement_age?: number | null
  confidence_score?: number | null
  monthly_income?: number | null
  years_money_lasts?: number | null
  legacy_value?: number | null
  status?: string | null
}

interface RetirementPlanListProps {
  plans: RetirementPlan[]
  metrics?: PlanMetrics[]
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

function statusBadge(status?: string | null) {
  if (!status) return null
  const map: Record<string, { label: string; className: string }> = {
    'on-track': { label: 'On track',        className: 'border-emerald-300 text-emerald-700 dark:text-emerald-400' },
    'close':    { label: 'Close',            className: 'border-amber-300  text-amber-700  dark:text-amber-400'  },
    'at-risk':  { label: 'At risk',          className: 'border-red-300    text-red-700    dark:text-red-400'    },
  }
  const s = map[status]
  return s ? (
    <Badge variant="outline" className={`text-[10px] ${s.className}`}>{s.label}</Badge>
  ) : null
}

export default function RetirementPlanList({ plans, metrics = [] }: RetirementPlanListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (planId: number, planName: string) => {
    setDeletingId(planId)
    try {
      const response = await fetch(`/apps/retirement/plans/${planId}/delete`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete plan')
      toast.success(`"${planName}" deleted`)
      window.location.reload()
    } catch (error) {
      toast.error('Failed to delete plan')
      setDeletingId(null)
    }
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 py-12 text-center">
        <Target className="mx-auto h-9 w-9 text-muted-foreground/30" />
        <p className="mt-3 text-sm text-muted-foreground">No retirement plans yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Use the calculator above to get started, or create a new plan.</p>
      </div>
    )
  }

  const metricsMap = Object.fromEntries(metrics.map((m) => [m.plan_id, m]))

  return (
    <div className="rounded-xl border overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Age</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Retire at</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Confidence</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Monthly Income</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Longevity</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Legacy Value</th>
            <th className="w-24 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {plans.map((plan) => {
            const m = metricsMap[plan.id]
            const hasMetrics = !!m
            const dash = <span className="text-muted-foreground/40">—</span>

            return (
              <tr key={plan.id} className="hover:bg-muted/20 transition-colors group">
                {/* Plan name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Target className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/apps/retirement/plans/${plan.id}?tab=quick-analysis`}
                        className="font-medium group-hover:text-primary transition-colors truncate block"
                      >
                        {plan.plan_name}
                      </Link>
                      {hasMetrics && statusBadge(m.status)}
                    </div>
                  </div>
                </td>

                {/* Current age */}
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {hasMetrics && m.current_age ? m.current_age : dash}
                </td>

                {/* Retirement age */}
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {hasMetrics && m.retirement_age ? m.retirement_age : dash}
                </td>

                {/* Confidence score */}
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  {hasMetrics && m.confidence_score != null ? (
                    <span className={`font-semibold ${
                      m.confidence_score >= SCORE_ON_TRACK_THRESHOLD ? 'text-emerald-600 dark:text-emerald-400'
                      : m.confidence_score >= SCORE_CLOSE_THRESHOLD ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                    }`}>
                      {Math.round(m.confidence_score)}%
                    </span>
                  ) : dash}
                </td>

                {/* Monthly income */}
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  {hasMetrics && m.monthly_income ? fmt(m.monthly_income) : dash}
                </td>

                {/* Longevity (years money lasts) */}
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  {hasMetrics && m.years_money_lasts != null ? (
                    <span>{Math.round(m.years_money_lasts)} yrs</span>
                  ) : dash}
                </td>

                {/* Legacy value */}
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  {hasMetrics && m.legacy_value ? fmt(m.legacy_value) : dash}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/apps/retirement/plans/${plan.id}?tab=quick-analysis`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline whitespace-nowrap"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          disabled={deletingId === plan.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete plan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{plan.plan_name}</strong> and all associated scenarios, settings, and projections.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(plan.id, plan.plan_name)}
                            className="bg-destructive text-white hover:bg-destructive/90"
                          >
                            {deletingId === plan.id ? 'Deleting…' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {plans.some((p) => !metricsMap[p.id]) && (
        <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground/60 bg-muted/10">
          Metrics appear after opening a plan and running Quick Analysis.
        </div>
      )}
    </div>
  )
}

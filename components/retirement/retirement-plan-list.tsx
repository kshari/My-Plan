'use client'

import Link from 'next/link'
import { Fragment, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { SCORE_ON_TRACK_THRESHOLD, SCORE_CLOSE_THRESHOLD } from '@/lib/constants/retirement-defaults'
import { formatCurrencyShort as fmt, formatCurrency } from '@/lib/utils/formatting'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface RetirementPlan {
  id: number
  plan_name: string
  life_expectancy?: number | null
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
  networth_at_retirement?: number | null
  legacy_value?: number | null
  status?: string | null
}

export interface PlanAssumptions {
  retirement_age?: number | null
  annual_retirement_expenses?: number | null
  growth_rate_before_retirement?: number | null
  growth_rate_during_retirement?: number | null
  inflation_rate?: number | null
  ssa_start_age?: number | null
  planner_ssa_income?: boolean | null
  spouse_ssa_income?: boolean | null
  planner_ssa_annual_benefit?: number | null
  spouse_ssa_annual_benefit?: number | null
  pre_medicare_annual_premium?: number | null
  post_medicare_annual_premium?: number | null
}

interface RetirementPlanListProps {
  plans: RetirementPlan[]
  metrics?: PlanMetrics[]
  ssaStartAgeByPlanId?: Record<number, number | null>
  settingsByPlanId?: Record<number, PlanAssumptions | null>
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

const TABLE_COLUMN_COUNT = 11

function AssumptionRow({ settings }: { settings: PlanAssumptions }) {
  const n = (v: number | null | undefined) => (v != null ? v : null)
  const pct = (v: number | null | undefined) => (v != null ? `${(Number(v) * 100).toFixed(1)}%` : '—')
  const cur = (v: number | null | undefined) => (v != null ? formatCurrency(v) : '—')
  const age = (v: number | null | undefined) => (v != null ? `${v}` : '—')
  const yn = (v: boolean | null | undefined) => (v == null ? '—' : v ? 'Yes' : 'No')
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
      <span><strong className="text-foreground/80">Retire at</strong> {age(settings.retirement_age)}</span>
      <span><strong className="text-foreground/80">Annual living expenses</strong> {cur(settings.annual_retirement_expenses)}</span>
      <span><strong className="text-foreground/80">Growth (pre)</strong> {pct(settings.growth_rate_before_retirement)}</span>
      <span><strong className="text-foreground/80">Growth (post)</strong> {pct(settings.growth_rate_during_retirement)}</span>
      <span><strong className="text-foreground/80">Inflation</strong> {pct(settings.inflation_rate)}</span>
      <span><strong className="text-foreground/80">SSA start age</strong> {age(settings.ssa_start_age)}</span>
      <span><strong className="text-foreground/80">Planner SSA</strong> {yn(settings.planner_ssa_income)} {n(settings.planner_ssa_annual_benefit) != null && `(${cur(settings.planner_ssa_annual_benefit)}/yr)`}</span>
      <span><strong className="text-foreground/80">Spouse SSA</strong> {yn(settings.spouse_ssa_income)} {n(settings.spouse_ssa_annual_benefit) != null && `(${cur(settings.spouse_ssa_annual_benefit)}/yr)`}</span>
      <span><strong className="text-foreground/80">Healthcare (pre-65)</strong> {cur(settings.pre_medicare_annual_premium)}/yr</span>
      <span><strong className="text-foreground/80">Healthcare (65+)</strong> {cur(settings.post_medicare_annual_premium)}/yr</span>
    </div>
  )
}

export default function RetirementPlanList({ plans, metrics = [], ssaStartAgeByPlanId = {}, settingsByPlanId = {} }: RetirementPlanListProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [planToDelete, setPlanToDelete] = useState<{ id: number; plan_name: string } | null>(null)
  const [showAllAssumptions, setShowAllAssumptions] = useState(false)

  const handleDeleteClick = (plan: RetirementPlan) => {
    setPlanToDelete({ id: plan.id, plan_name: plan.plan_name })
  }

  const handleDeleteConfirm = async () => {
    if (!planToDelete) return
    setDeletingId(planToDelete.id)
    setPlanToDelete(null)
    try {
      const response = await fetch(`/apps/retirement/plans/${planToDelete.id}/delete`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete plan')
      toast.success(`"${planToDelete.plan_name}" deleted`)
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
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Checkbox
          id="show-assumptions"
          checked={showAllAssumptions}
          onCheckedChange={(checked) => setShowAllAssumptions(checked === true)}
          aria-label="Show all the assumptions"
        />
        <label htmlFor="show-assumptions" className="text-sm font-medium cursor-pointer select-none">
          Show all the assumptions
        </label>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Plan</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Age</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Retire at</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Life exp.</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">SSA at</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Confidence</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Monthly Income</th>
            <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Longevity</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Networth At Retirement</th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">End Networth</th>
            <th className="w-24 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {plans.map((plan) => {
            const m = metricsMap[plan.id]
            const hasMetrics = !!m
            const dash = <span className="text-muted-foreground/40">—</span>

            return (
              <Fragment key={plan.id}>
              <tr className="hover:bg-muted/20 transition-colors group">
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

                {/* Life expectancy */}
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {plan.life_expectancy != null ? plan.life_expectancy : dash}
                </td>

                {/* SSA start age */}
                <td className="px-4 py-3 text-center hidden sm:table-cell">
                  {ssaStartAgeByPlanId[plan.id] != null ? ssaStartAgeByPlanId[plan.id] : dash}
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

                {/* Networth at retirement */}
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  {hasMetrics && m.networth_at_retirement != null ? formatCurrency(m.networth_at_retirement) : dash}
                </td>

                {/* End networth */}
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  {hasMetrics && m.legacy_value != null ? formatCurrency(m.legacy_value) : dash}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingId === plan.id}
                      onClick={() => handleDeleteClick(plan)}
                      aria-label={`Delete ${plan.plan_name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
              {showAllAssumptions && settingsByPlanId[plan.id] && (
                <tr className="bg-muted/10 hover:bg-muted/15 transition-colors">
                  <td colSpan={TABLE_COLUMN_COUNT} className="px-4 py-3 align-top">
                    <AssumptionRow settings={settingsByPlanId[plan.id]!} />
                  </td>
                </tr>
              )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {plans.some((p) => !metricsMap[p.id]) && (
        <div className="border-t px-4 py-2.5 text-[11px] text-muted-foreground/60 bg-muted/10">
          Metrics appear after opening a plan and running Quick Analysis.
        </div>
      )}

      {/* Single AlertDialog avoids per-row Radix IDs and prevents hydration mismatch */}
      <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {planToDelete && (
                <>
                  This will permanently delete <strong>{planToDelete.plan_name}</strong> and all associated scenarios, settings, and projections.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {planToDelete && deletingId === planToDelete.id ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

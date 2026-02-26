'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowRight,
  SlidersHorizontal,
  GitBranch,
  BarChart2,
  ShieldAlert,
  Coins,
  Wrench,
  DollarSign,
  CheckCircle2,
  Circle,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface OverviewTabProps {
  planId: number
  onNavigate: (tabId: string) => void
}

interface PlanStatus {
  hasScenarios: boolean
  hasAccounts: boolean
  hasExpenses: boolean
  hasProjections: boolean
  scenarioCount: number
  accountCount: number
}

const setupSections = [
  {
    id: 'plan-details',
    label: 'Plan Data',
    icon: SlidersHorizontal,
    description: 'Set your retirement age, birth year, filing status, life expectancy, and core assumptions like growth and inflation rates.',
    accent: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    id: 'other-income',
    label: 'Other Income',
    icon: DollarSign,
    description: 'Add Social Security benefits, pension income, rental income, or any other recurring income sources.',
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    disabled: true,
  },
]

const analysisSections = [
  {
    id: 'scenario-modeling',
    label: 'Scenario Modeling',
    icon: GitBranch,
    description: 'Create and compare multiple retirement scenarios. Adjust assumptions per-scenario to find the path that fits your goals.',
    accent: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    id: 'details',
    label: 'Projections',
    icon: BarChart2,
    description: 'Year-by-year breakdown of income, withdrawals, expenses, taxes, and net worth from now through your life expectancy.',
    accent: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    id: 'analysis',
    label: 'Risk Analysis',
    icon: ShieldAlert,
    description: 'Assess sequence-of-returns risk, longevity risk, and identify the most vulnerable years in your retirement plan.',
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    id: 'tax-efficiency',
    label: 'Tax Efficiency',
    icon: Coins,
    description: 'Visualize your annual tax burden, explore Roth conversion opportunities, and optimize withdrawal order across account types.',
    accent: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
  },
  {
    id: 'other-tools',
    label: 'Other Tools',
    icon: Wrench,
    description: 'SSA benefit optimizer, Roth conversion calculator, SSA withdrawal analysis, and inflation sensitivity tools.',
    accent: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-500/10',
  },
]

interface SectionCardProps {
  id: string
  label: string
  icon: React.ElementType
  description: string
  accent: string
  bg: string
  disabled?: boolean
  onNavigate: (id: string) => void
}

function SectionCard({
  id, label, icon: Icon, description, accent, bg, disabled, onNavigate,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-5 flex flex-col transition-all',
        !disabled && 'hover:shadow-md hover:border-primary/25 cursor-pointer',
        disabled && 'opacity-50'
      )}
      onClick={() => !disabled && onNavigate(id)}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', bg)}>
          <Icon className={cn('h-4 w-4', accent)} />
        </div>
        {disabled && (
          <Badge variant="secondary" className="text-[10px] shrink-0">Coming soon</Badge>
        )}
      </div>
      <h4 className="font-semibold text-sm mb-1.5">{label}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
      {!disabled && (
        <div className={cn('mt-4 flex items-center gap-1 text-xs font-medium transition-colors', accent)}>
          Open
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  )
}

export default function OverviewTab({ planId, onNavigate }: OverviewTabProps) {
  const supabase = createClient()
  const [status, setStatus] = useState<PlanStatus | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      const [scenariosRes, accountsRes, expensesRes] = await Promise.all([
        supabase.from('rp_scenarios').select('id', { count: 'exact', head: true }).eq('plan_id', planId),
        supabase.from('rp_accounts').select('id', { count: 'exact', head: true }).eq('plan_id', planId),
        supabase.from('rp_expenses').select('id', { count: 'exact', head: true }).eq('plan_id', planId),
      ])

      const scenarioCount = scenariosRes.count ?? 0

      // Check if any projections exist for the plan's scenarios
      let hasProjections = false
      if (scenarioCount > 0) {
        const { data: firstScenario } = await supabase
          .from('rp_scenarios')
          .select('id')
          .eq('plan_id', planId)
          .limit(1)
          .single()
        if (firstScenario) {
          const { count } = await supabase
            .from('rp_projection_details')
            .select('id', { count: 'exact', head: true })
            .eq('scenario_id', firstScenario.id)
          hasProjections = (count ?? 0) > 0
        }
      }

      setStatus({
        hasScenarios: scenarioCount > 0,
        hasAccounts: (accountsRes.count ?? 0) > 0,
        hasExpenses: (expensesRes.count ?? 0) > 0,
        hasProjections,
        scenarioCount,
        accountCount: accountsRes.count ?? 0,
      })
    }
    fetchStatus()
  }, [planId])

  const setupChecklist = [
    {
      label: 'Configure a scenario',
      done: status?.hasScenarios ?? false,
      action: 'scenario-modeling',
      description: 'Create at least one retirement scenario',
    },
    {
      label: 'Add retirement accounts',
      done: status?.hasAccounts ?? false,
      action: 'plan-details',
      description: '401k, IRA, Roth IRA, HSA, etc.',
    },
    {
      label: 'Set up expenses',
      done: status?.hasExpenses ?? false,
      action: 'plan-details',
      description: 'Monthly living expenses in retirement',
    },
    {
      label: 'Generate projections',
      done: status?.hasProjections ?? false,
      action: 'details',
      description: 'Calculate your year-by-year retirement plan',
    },
  ]

  const completedCount = setupChecklist.filter(i => i.done).length
  const allDone = completedCount === setupChecklist.length
  const progressPct = (completedCount / setupChecklist.length) * 100

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Plan health bar */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Plan Setup</h3>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {completedCount}/{setupChecklist.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted mb-4 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              allDone ? 'bg-emerald-500' : 'bg-primary'
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {setupChecklist.map((item) => (
            <button
              key={item.label}
              onClick={() => !item.done && onNavigate(item.action)}
              className={cn(
                'flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors text-sm',
                item.done
                  ? 'cursor-default'
                  : 'hover:bg-muted/60 cursor-pointer'
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={cn('font-medium text-xs', item.done && 'text-muted-foreground line-through')}>
                  {item.label}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Setup section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
            Setup
          </p>
          <div className="flex-1 border-t border-dashed" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {setupSections.map((s) => (
            <SectionCard key={s.id} {...s} onNavigate={onNavigate} />
          ))}
        </div>
      </div>

      {/* Analysis section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
            Analysis
          </p>
          <div className="flex-1 border-t border-dashed" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analysisSections.map((s) => (
            <SectionCard key={s.id} {...s} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  )
}

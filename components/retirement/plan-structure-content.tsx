'use client'

import React from 'react'
import {
  ArrowRight,
  SlidersHorizontal,
  GitBranch,
  BarChart2,
  ShieldAlert,
  Coins,
  Wrench,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const setupSections = [
  {
    id: 'plan-details',
    label: 'Plan Setup',
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
  showOpen?: boolean
  onNavigate?: (id: string) => void
}

function SectionCard({
  id, label, icon: Icon, description, accent, bg, disabled, showOpen = true, onNavigate,
}: SectionCardProps) {
  const isInteractive = showOpen && onNavigate && !disabled

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card p-5 flex flex-col transition-all',
        isInteractive && 'hover:shadow-md hover:border-primary/25 cursor-pointer',
        disabled && 'opacity-50'
      )}
      onClick={() => isInteractive && onNavigate?.(id)}
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
      {isInteractive && (
        <div className={cn('mt-4 flex items-center gap-1 text-xs font-medium transition-colors', accent)}>
          Open
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </div>
  )
}

export interface PlanStructureContentProps {
  /** When true, show Open link and make cards clickable. When false (no plan selected), cards are static. */
  showOpen?: boolean
  onNavigate?: (id: string) => void
}

export function PlanStructureContent({ showOpen = false, onNavigate }: PlanStructureContentProps) {
  return (
    <div className="space-y-8 max-w-4xl">
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
            <SectionCard key={s.id} {...s} showOpen={showOpen} onNavigate={onNavigate} />
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
            <SectionCard key={s.id} {...s} showOpen={showOpen} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  )
}

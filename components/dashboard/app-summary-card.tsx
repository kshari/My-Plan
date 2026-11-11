"use client"

import Link from 'next/link'
import { CheckCircle2, Circle, ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppSummary, MetricTone } from '@/lib/dashboard/types'

interface AppConfig {
  icon: LucideIcon
  accent: string
  bg: string
  border: string
  badge: string
  badgeColor: string
}

interface AppSummaryCardProps {
  summary: AppSummary
  config: AppConfig
  name: string
  authHref: string
}

export function AppSummaryCard({ summary, config, name, authHref }: AppSummaryCardProps) {
  const { setup, metrics, primaryCta, started } = summary

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border bg-card transition-all duration-200',
        config.border,
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', config.bg)}>
            <config.icon className={cn('h-5 w-5', config.accent)} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight truncate">{name}</h2>
            <span className={cn('mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', config.badgeColor)}>
              {config.badge}
            </span>
          </div>
        </div>

        {/* Setup progress ring (small) */}
        <div className="shrink-0 relative h-9 w-9 mt-0.5" title={`Setup ${setup.pctComplete}% complete`}>
          <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/25" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3"
              strokeDasharray={`${setup.pctComplete} ${100 - setup.pctComplete}`}
              strokeLinecap="round"
              className={cn(
                'transition-all duration-700',
                setup.pctComplete >= 100
                  ? 'text-emerald-500'
                  : setup.pctComplete >= 50
                  ? config.accent
                  : 'text-muted-foreground/50',
              )}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
            {setup.pctComplete}%
          </span>
        </div>
      </div>

      {/* Not started state */}
      {!started ? (
        <div className="flex flex-1 flex-col px-4 pb-4">
          <div className="flex-1 rounded-xl border border-dashed border-muted/60 bg-muted/10 flex items-center justify-center py-4 mb-3">
            <p className="text-xs text-muted-foreground text-center px-2">
              Not started yet — get set up to see your metrics here.
            </p>
          </div>
          <SetupSteps steps={setup.steps} />
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-4 pb-4 gap-3">
          {/* Metrics */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {metrics.slice(0, 4).map((metric) => (
                <div key={metric.label} className="rounded-lg bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground truncate">{metric.label}</p>
                  <p className={cn('text-sm font-semibold tabular-nums', metricToneClass(metric.tone))}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Setup steps */}
          <SetupSteps steps={setup.steps} />
        </div>
      )}

      {/* Footer CTA */}
      <div className={cn('border-t px-4 py-3', config.border)}>
        <Link
          href={primaryCta.href}
          className={cn(
            'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all',
            'bg-background border hover:shadow-sm hover:-translate-y-px',
            config.border,
          )}
        >
          <span className={config.accent}>{primaryCta.label}</span>
          <ArrowRight className={cn('h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5', config.accent)} />
        </Link>
      </div>
    </div>
  )
}

function SetupSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ul className="space-y-1">
      {steps.map((step) => (
        <li key={step.label} className="flex items-center gap-2 text-xs">
          {step.done ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
          )}
          <span className={cn(step.done ? 'text-muted-foreground line-through' : 'text-foreground/80')}>
            {step.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function metricToneClass(tone?: MetricTone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'negative':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-foreground'
  }
}

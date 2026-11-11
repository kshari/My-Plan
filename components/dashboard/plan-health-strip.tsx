"use client"

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppSummary } from '@/lib/dashboard/types'

interface PlanHealthStripProps {
  summaries: AppSummary[]
}

export function PlanHealthStrip({ summaries }: PlanHealthStripProps) {
  // Setup completeness: average pctComplete across all 4 apps, weighted by started
  const appsStarted = summaries.filter((s) => s.started).length
  const avgSetup = summaries.length > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.setup.pctComplete, 0) / summaries.length)
    : 0

  // Top next action: first app with incomplete setup steps and a non-trivial CTA
  const topAction = summaries.find((s) => s.setup.pctComplete < 100 && s.primaryCta)
  ?? summaries[0]

  // Ring circumference for SVG progress circle (r=15.5)
  const circumference = 2 * Math.PI * 15.5
  const ringOffset = circumference * (1 - avgSetup / 100)

  return (
    <div className="rounded-2xl border bg-card p-5 mb-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {/* Setup ring */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative h-16 w-16">
            <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <circle
                cx="18" cy="18" r="15.5"
                fill="none" stroke="currentColor" strokeWidth="2"
                className="text-muted/30"
              />
              <circle
                cx="18" cy="18" r="15.5"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray={`${avgSetup} ${100 - avgSetup}`}
                strokeLinecap="round"
                className={cn(
                  'transition-all duration-700',
                  avgSetup >= 75 ? 'text-emerald-500' : avgSetup >= 40 ? 'text-amber-500' : 'text-orange-500',
                )}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {avgSetup}%
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Setup Progress</p>
            <p className="text-sm font-semibold">
              {appsStarted} of {summaries.length} apps active
            </p>
          </div>
        </div>

        <div className="h-px sm:h-10 sm:w-px bg-border" />

        {/* Top next action */}
        {topAction && (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">Suggested next step</p>
            <Link
              href={topAction.primaryCta.href}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {topAction.primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
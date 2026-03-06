'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SCORE_LABELS } from '@/lib/constants/pulse-defaults'
import type { ResilienceBreakdown } from '@/lib/utils/pulse-calculations'

interface ResilienceScoreProps {
  score: ResilienceBreakdown
}

export function ResilienceScore({ score }: ResilienceScoreProps) {
  const [expanded, setExpanded] = useState(false)

  const total = Number(score.total)
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.min(100, total)) : 0
  const label = SCORE_LABELS.find((l) => safeTotal >= l.min && safeTotal <= l.max)
  const strokeColor = label?.color ?? 'text-muted-foreground'
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (safeTotal / 100) * circumference

  const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0)
  const breakdown = [
    { label: 'Emergency Fund', value: safe(score.emergencyFund), weight: '25%' },
    { label: 'Savings Rate', value: safe(score.savingsRate), weight: '25%' },
    { label: 'Debt Health', value: safe(score.debtHealth), weight: '25%' },
    { label: 'Net Worth vs. Peers', value: safe(score.netWorthPercentile), weight: '25%' },
  ]

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
        {/* Gauge */}
        <div className="relative h-32 w-32 shrink-0">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={cn('transition-all duration-700', strokeColor)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{safeTotal}</span>
            <span className="text-[10px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Label and summary */}
        <div className="text-center sm:text-left">
          <h2 className="text-xl font-bold">Financial Resilience</h2>
          <p className={cn('mt-1 text-sm font-semibold', label?.color)}>{label?.label}</p>
          <p className="mt-2 text-xs text-muted-foreground max-w-xs">
            A composite score based on your emergency fund, savings rate, debt health, and how your net worth compares to peers in your age group.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {expanded ? 'Hide breakdown' : 'See breakdown'}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Breakdown */}
      {expanded && (
        <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-500"
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <div className="shrink-0 w-40 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

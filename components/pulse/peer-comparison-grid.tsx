'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PeerComparison } from '@/lib/hooks/use-benchmarks'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface PeerComparisonGridProps {
  comparisons: PeerComparison[]
}

export function PeerComparisonGrid({ comparisons }: PeerComparisonGridProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Complete your profile to see how you compare to peers in your age group.
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {comparisons.map((c) => (
          <PeerCard key={c.metric} comparison={c} />
        ))}
      </div>
    </TooltipProvider>
  )
}

function PeerCard({ comparison }: { comparison: PeerComparison }) {
  const { label, userValue, peerMedian, percentile, format, lowerIsBetter, mathTooltip } = comparison
  const isAboveMedian = lowerIsBetter ? percentile < 50 : percentile >= 50

  function fmt(value: number): string {
    if (format === 'currency') {
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
      return `$${value.toLocaleString()}`
    }
    if (format === 'months') return `${value.toFixed(1)} mo`
    return `${value.toFixed(1)}%`
  }

  const card = (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tracking-tight">{fmt(userValue)}</p>
          <p className="text-xs text-muted-foreground">Your value</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-muted-foreground">{fmt(peerMedian)}</p>
          <p className="text-xs text-muted-foreground">Peer median</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <PercentileBadge percentile={percentile} above={isAboveMedian} />
      </div>
    </div>
  )

  if (mathTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{card}</div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-line text-xs font-normal">
          {mathTooltip}
        </TooltipContent>
      </Tooltip>
    )
  }

  return card
}

function PercentileBadge({ percentile, above }: { percentile: number; above: boolean }) {
  const Icon = above ? ArrowUp : percentile === 50 ? Minus : ArrowDown
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
      above
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    )}>
      <Icon className="h-3 w-3" />
      {percentile}{percentile === 1 ? 'st' : percentile === 2 ? 'nd' : percentile === 3 ? 'rd' : 'th'} percentile
    </span>
  )
}

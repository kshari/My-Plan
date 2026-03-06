'use client'

import { SCENARIO_METADATA } from '@/lib/constants/pulse-defaults'

interface ExplorationProgressProps {
  explored: string[]
}

export function ExplorationProgress({ explored }: ExplorationProgressProps) {
  const total = SCENARIO_METADATA.length
  const count = explored.filter((id) => SCENARIO_METADATA.some((s) => s.id === id)).length
  const pct = total > 0 ? (count / total) * 100 : 0

  if (count === total) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
        <span className="font-semibold">All {total} scenarios explored!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-muted/30 overflow-hidden max-w-xs">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        <span className="font-semibold text-foreground">{count}</span> of {total} scenarios explored
      </span>
    </div>
  )
}

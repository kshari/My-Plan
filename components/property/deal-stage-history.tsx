'use client'

import { cn } from '@/lib/utils'
import { DEAL_STAGE_LABELS, DEAL_STAGE_BADGE_STYLES } from '@/lib/constants/property-defaults'
import type { DealStageHistoryEntry } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Clock } from 'lucide-react'

interface DealStageHistoryProps {
  history: DealStageHistoryEntry[]
}

export function DealStageHistory({ history }: DealStageHistoryProps) {
  if (!history.length) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No stage history yet.
      </p>
    )
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.entered_at).getTime() - new Date(a.entered_at).getTime()
  )

  return (
    <div className="space-y-2">
      {sorted.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
          <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[entry.stage])}>
                {DEAL_STAGE_LABELS[entry.stage]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.entered_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </div>
            {entry.notes && (
              <p className="text-xs text-muted-foreground mt-0.5">{entry.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

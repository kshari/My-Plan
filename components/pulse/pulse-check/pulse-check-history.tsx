'use client'

import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/formatting'
import { MOOD_EMOJIS, MOOD_LABELS, SCORE_LABELS } from '@/lib/constants/pulse-defaults'
import type { PulseCheck } from '@/lib/demographics'

interface PulseCheckHistoryProps {
  checks: PulseCheck[]
}

export function PulseCheckHistory({ checks }: PulseCheckHistoryProps) {
  if (checks.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No pulse checks yet. Take your first one to start building your financial journal.
      </div>
    )
  }

  const sorted = [...checks].sort(
    (a, b) => parseLocalDate(b.check_date).getTime() - parseLocalDate(a.check_date).getTime()
  )

  return (
    <div className="space-y-3">
      {sorted.map((check, i) => {
        const prev = sorted[i + 1]
        const nwDelta = prev ? check.net_worth_snapshot - prev.net_worth_snapshot : null
        const scoreDelta = prev ? check.resilience_score - prev.resilience_score : null
        const scoreLabel = SCORE_LABELS.find((l) => check.resilience_score >= l.min && check.resilience_score <= l.max)

        return (
          <div key={check.id ?? i} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{MOOD_EMOJIS[check.mood]}</span>
                <div>
                  <p className="text-sm font-semibold">
                    {parseLocalDate(check.check_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className={cn('text-xs', scoreLabel?.color)}>
                    Score: {check.resilience_score} — {scoreLabel?.label}
                    {scoreDelta !== null && (
                      <span className={cn('ml-1.5', scoreDelta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        ({scoreDelta >= 0 ? '+' : ''}{scoreDelta})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">${check.net_worth_snapshot.toLocaleString()}</p>
                {nwDelta !== null && (
                  <p className={cn('text-xs font-medium', nwDelta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {nwDelta >= 0 ? '+' : ''}${nwDelta.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            {check.reflection_answer && (
              <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground mb-0.5">{check.reflection_question}</p>
                <p className="text-xs leading-relaxed">{check.reflection_answer}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

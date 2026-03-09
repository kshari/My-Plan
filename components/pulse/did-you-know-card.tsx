'use client'

import { Lightbulb } from 'lucide-react'
import { useDailyFact } from '@/lib/hooks/use-daily-fact'
import { FUN_FACTS } from '@/lib/constants/fun-facts'

export function DidYouKnowCard() {
  const fact = useDailyFact(FUN_FACTS)

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
        <Lightbulb className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-1">Did you know?</p>
        <p className="text-sm leading-relaxed">{fact.text}</p>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Source: {fact.source}</p>
      </div>
    </div>
  )
}

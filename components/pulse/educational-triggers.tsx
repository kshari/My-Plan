'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, AlertTriangle, Info, CheckCircle2, ArrowRight, User, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EducationalTrigger } from '@/lib/hooks/use-educational-triggers'

interface EducationalTriggersProps {
  triggers: EducationalTrigger[]
}

const severityStyles = {
  info: 'border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20',
  warning: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20',
  success: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20',
}

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
}

const severityIconColor = {
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  success: 'text-emerald-600 dark:text-emerald-400',
}

export function EducationalTriggers({ triggers }: EducationalTriggersProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = triggers.filter((t) => !dismissed.has(t.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-3">
      {visible.map((trigger) => {
        const Icon = severityIcons[trigger.severity]
        return (
          <div key={trigger.id} className={cn('rounded-xl border p-4 flex items-start gap-3', severityStyles[trigger.severity])}>
            <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', severityIconColor[trigger.severity])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{trigger.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{trigger.description}</p>
              {trigger.scenarioLink && (
                <Link
                  href={`/apps/pulse/scenarios/${trigger.scenarioLink}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try this scenario <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              {trigger.profileLink && (
                <Link
                  href="/apps/pulse/profile"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Complete profile <User className="h-3 w-3" />
                </Link>
              )}
              {trigger.pulseCheckLink && (
                <Link
                  href="/apps/pulse/pulse-check"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Start Pulse Check <ClipboardCheck className="h-3 w-3" />
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissed((prev) => new Set(prev).add(trigger.id))}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

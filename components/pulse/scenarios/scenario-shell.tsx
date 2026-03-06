'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FunFact } from '@/lib/constants/fun-facts'

interface ScenarioShellProps {
  title: string
  description: string
  scenarioId: string
  backHref?: string
  insightText?: string
  funFact?: FunFact
  children: React.ReactNode
}

export function ScenarioShell({ title, description, scenarioId, backHref, insightText, funFact, children }: ScenarioShellProps) {
  useEffect(() => {
    async function markExplored() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('fp_profiles')
          .select('explored_scenarios')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!profile) return
        const current: string[] = Array.isArray(profile.explored_scenarios) ? profile.explored_scenarios : []
        if (current.includes(scenarioId)) return
        await supabase
          .from('fp_profiles')
          .update({ explored_scenarios: [...current, scenarioId] })
          .eq('user_id', user.id)
      } else {
        try {
          const LOCAL_KEY = 'fp_local_profile'
          const saved = localStorage.getItem(LOCAL_KEY)
          if (!saved) return
          const profile = JSON.parse(saved)
          const current: string[] = Array.isArray(profile.explored_scenarios) ? profile.explored_scenarios : []
          if (current.includes(scenarioId)) return
          profile.explored_scenarios = [...current, scenarioId]
          localStorage.setItem(LOCAL_KEY, JSON.stringify(profile))
        } catch {}
      }
    }
    markExplored()
  }, [scenarioId])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <Link href={backHref ?? '/apps/pulse/scenarios'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Scenarios
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>
      </div>

      {children}

      {/* Insight card */}
      {insightText && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-sm leading-relaxed">
          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Key Insight</p>
          <p>{insightText}</p>
        </div>
      )}

      {/* Fun fact */}
      {funFact && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
          <Lightbulb className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm leading-relaxed">{funFact.text}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Source: {funFact.source}</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Coffee, TrendingUp, PiggyBank, Swords, ShieldCheck, CreditCard, Calculator } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { SCENARIO_METADATA } from '@/lib/constants/pulse-defaults'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Coffee, TrendingUp, PiggyBank, Sword: Swords, ShieldCheck, CreditCard, Calculator,
}

export default function ScenariosPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Financial Learning Lab</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Drag sliders, watch charts move, build financial intuition. Each scenario teaches a core personal finance concept.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCENARIO_METADATA.map((scenario) => {
          const Icon = ICONS[scenario.icon] ?? Calculator
          return (
            <Link
              key={scenario.id}
              href={`/apps/pulse/scenarios/${scenario.id}`}
              className="group flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-semibold mb-1">{scenario.name}</h2>
              <p className="flex-1 text-xs text-muted-foreground leading-relaxed">{scenario.description}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 transition-all group-hover:gap-2">
                Try it <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { futureValue } from '@/lib/utils/pulse-calculations'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: 'The average American underestimates their subscription spending by 2.5x.',
  source: 'Chase Bank survey, 2023',
}

const CATEGORY_COLORS: Record<string, string> = {
  entertainment: '#f97316',
  productivity: '#3b82f6',
  health: '#22c55e',
  news: '#8b5cf6',
  cloud: '#06b6d4',
  other: '#94a3b8',
}

const SUGGESTIONS = ['Netflix', 'Spotify', 'Gym', 'iCloud', 'YouTube Premium', 'Amazon Prime', 'NYT', 'ChatGPT Plus']

interface Sub { name: string; monthly_cost: number; category: string }

export function SubscriptionAuditScenario({ backHref }: { backHref?: string }) {
  const [subs, setSubs] = useState<Sub[]>([
    { name: 'Netflix', monthly_cost: 15.49, category: 'entertainment' },
    { name: 'Spotify', monthly_cost: 10.99, category: 'entertainment' },
    { name: 'Gym', monthly_cost: 49, category: 'health' },
    { name: 'iCloud', monthly_cost: 2.99, category: 'cloud' },
  ])

  const totalMonthly = useMemo(() => subs.reduce((s, sub) => s + sub.monthly_cost, 0), [subs])
  const totalAnnual = totalMonthly * 12
  const invested10 = Math.round(futureValue(0, totalMonthly, 0.08 / 12, 10 * 12))
  const invested20 = Math.round(futureValue(0, totalMonthly, 0.08 / 12, 20 * 12))
  const invested30 = Math.round(futureValue(0, totalMonthly, 0.08 / 12, 30 * 12))

  const pieData = useMemo(() => {
    const catTotals: Record<string, number> = {}
    for (const sub of subs) {
      catTotals[sub.category] = (catTotals[sub.category] ?? 0) + sub.monthly_cost
    }
    return Object.entries(catTotals).map(([cat, val]) => ({ name: cat, value: Math.round(val * 100) / 100 }))
  }, [subs])

  const insight = `Your $${totalMonthly.toFixed(0)}/month in subscriptions = $${totalAnnual.toLocaleString()}/year. Invested at 8% for 20 years, that's $${invested20.toLocaleString()}.`

  return (
    <ScenarioShell
      title="Subscription Audit"
      description="Add your subscriptions, see the total, then see what that money could become if invested."
      scenarioId="subscription-audit"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Subscription list */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Subscriptions</p>
            {subs.map((sub, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input className="h-8 text-xs flex-1" value={sub.name} onChange={(e) => updateSub(i, 'name', e.target.value)} />
                <div className="relative w-24">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <Input className="h-8 text-xs pl-5" type="number" step={0.01} value={sub.monthly_cost || ''} onChange={(e) => updateSub(i, 'monthly_cost', Number(e.target.value))} />
                </div>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={sub.category}
                  onChange={(e) => updateSub(i, 'category', e.target.value)}
                >
                  {Object.keys(CATEGORY_COLORS).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSubs(subs.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {SUGGESTIONS.filter((s) => !subs.some((sub) => sub.name === s)).slice(0, 4).map((s) => (
                <button key={s} onClick={() => setSubs([...subs, { name: s, monthly_cost: 0, category: 'other' }])} className="rounded-full border px-2.5 py-1 text-[11px] hover:bg-accent transition-colors">
                  + {s}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setSubs([...subs, { name: '', monthly_cost: 0, category: 'other' }])}>
              <Plus className="h-3 w-3 mr-1" /> Add subscription
            </Button>
          </div>

          {/* Projections */}
          <div className="grid grid-cols-3 gap-3">
            {[{ y: 10, v: invested10 }, { y: 20, v: invested20 }, { y: 30, v: invested30 }].map(({ y, v }) => (
              <div key={y} className="rounded-xl border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">If invested {y}yr</p>
                <p className="text-lg font-bold mt-1">${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Donut chart and totals */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Monthly Total</p>
            <p className="text-3xl font-bold">${totalMonthly.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">${totalAnnual.toLocaleString()}/year</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toFixed(2)}/mo`} />
                <Legend formatter={(value: string) => <span className="text-xs capitalize">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </ScenarioShell>
  )

  function updateSub(i: number, key: string, value: any) {
    const next = [...subs]
    next[i] = { ...next[i], [key]: value }
    setSubs(next)
  }
}

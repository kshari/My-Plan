'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { simulateDebtPayoff } from '@/lib/utils/pulse-calculations'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: 'Research shows Snowball works better psychologically — people who pay off small debts first are more likely to become debt-free.',
  source: 'Harvard Business Review, 2016',
}

const DEFAULT_DEBTS = [
  { name: 'Credit Card', balance: 5000, rate: 22, min_payment: 150 },
  { name: 'Car Loan', balance: 12000, rate: 6.5, min_payment: 300 },
  { name: 'Student Loan', balance: 25000, rate: 5, min_payment: 280 },
]

export function DebtPayoffScenario({ backHref }: { backHref?: string }) {
  const [debts, setDebts] = useState(DEFAULT_DEBTS)
  const [extraPayment, setExtraPayment] = useState(200)

  const avalanche = useMemo(() => simulateDebtPayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment])
  const snowball = useMemo(() => simulateDebtPayoff(debts, extraPayment, 'snowball'), [debts, extraPayment])

  const maxLen = Math.max(avalanche.timeline.length, snowball.timeline.length)
  const chartData = useMemo(() => {
    const data: { month: number; avalanche: number; snowball: number }[] = []
    for (let m = 0; m < maxLen; m++) {
      data.push({
        month: m,
        avalanche: avalanche.timeline[m]?.remaining ?? 0,
        snowball: snowball.timeline[m]?.remaining ?? 0,
      })
    }
    return data
  }, [avalanche, snowball, maxLen])

  const interestDiff = snowball.totalInterest - avalanche.totalInterest
  const monthDiff = snowball.months - avalanche.months

  const insight = `Avalanche saves $${Math.abs(interestDiff).toLocaleString()} in interest and pays off ${Math.abs(monthDiff)} months ${monthDiff > 0 ? 'sooner' : 'later'} than Snowball. ${monthDiff > 0 ? 'Snowball pays off your smallest debt first for an early motivational win.' : 'Both strategies perform similarly with your debts.'}`

  return (
    <ScenarioShell
      title="Debt Payoff: Avalanche vs. Snowball"
      description="Two proven strategies to crush debt. Avalanche targets highest interest first. Snowball targets smallest balance first. Which wins for you?"
      scenarioId="debt-payoff"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Extra monthly payment</Label>
              <span className="text-sm font-semibold">${extraPayment}</span>
            </div>
            <Slider value={[extraPayment]} min={0} max={1000} step={25} onValueChange={([v]) => setExtraPayment(v)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">Debts</Label>
            {debts.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <Input className="h-8 text-xs flex-1" value={d.name} onChange={(e) => updateDebt(i, 'name', e.target.value)} />
                <Input className="h-8 text-xs w-20" type="number" value={d.balance || ''} onChange={(e) => updateDebt(i, 'balance', Number(e.target.value))} placeholder="Bal" />
                <Input className="h-8 text-xs w-16" type="number" step={0.1} value={d.rate || ''} onChange={(e) => updateDebt(i, 'rate', Number(e.target.value))} placeholder="APR" />
                <Input className="h-8 text-xs w-16" type="number" value={d.min_payment || ''} onChange={(e) => updateDebt(i, 'min_payment', Number(e.target.value))} placeholder="Min" />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDebts(debts.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setDebts([...debts, { name: '', balance: 0, rate: 0, min_payment: 0 }])}>
              <Plus className="h-3 w-3 mr-1" /> Add debt
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2 text-center">
              <p className="text-muted-foreground">Avalanche</p>
              <p className="font-bold">{avalanche.months} mo</p>
              <p className="text-muted-foreground">${avalanche.totalInterest.toLocaleString()} interest</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-2 text-center">
              <p className="text-muted-foreground">Snowball</p>
              <p className="font-bold">{snowball.months} mo</p>
              <p className="text-muted-foreground">${snowball.totalInterest.toLocaleString()} interest</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} label={{ value: 'Months', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="avalanche" name="Avalanche" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="snowball" name="Snowball" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ScenarioShell>
  )

  function updateDebt(i: number, key: string, value: any) {
    const next = [...debts]
    next[i] = { ...next[i], [key]: value }
    setDebts(next)
  }
}

'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { simulateLifestyleCreep } from '@/lib/utils/pulse-calculations'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: "Parkinson's Law of Money: expenses rise to meet income. The only cure is automating savings before you see the money.",
  source: 'C. Northcote Parkinson, 1955 (adapted)',
}

export function LifestyleCreepScenario({ backHref }: { backHref?: string }) {
  const [income, setIncome] = useState(75000)
  const [raiseRate, setRaiseRate] = useState(3)
  const [spendOfRaise, setSpendOfRaise] = useState(80)
  const [savingsRate, setSavingsRate] = useState(10)
  const [returnRate, setReturnRate] = useState(8)

  const data = useMemo(() => {
    return simulateLifestyleCreep(income, raiseRate, spendOfRaise, savingsRate, returnRate, 20)
  }, [income, raiseRate, spendOfRaise, savingsRate, returnRate])

  const last = data[data.length - 1]
  const diff = (last?.mindful ?? 0) - (last?.creep ?? 0)

  const insight = `Saving half of every raise gets you to $${(last?.mindful ?? 0).toLocaleString()} in 20 years — $${diff.toLocaleString()} more than full lifestyle creep.`

  return (
    <ScenarioShell
      title="Lifestyle Creep Calculator"
      description="What happens when your spending rises with your income? Compare mindful spending vs. full lifestyle creep."
      scenarioId="lifestyle-creep"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5 rounded-xl border bg-card p-4">
          <SliderField label="Annual income" value={income} min={30000} max={300000} step={5000} format={(v) => `$${(v / 1000).toFixed(0)}K`} onChange={setIncome} />
          <SliderField label="Annual raise" value={raiseRate} min={0} max={10} step={0.5} format={(v) => `${v}%`} onChange={setRaiseRate} />
          <SliderField label="% of raise you spend" value={spendOfRaise} min={0} max={100} step={5} format={(v) => `${v}%`} onChange={setSpendOfRaise} />
          <SliderField label="Current savings rate" value={savingsRate} min={1} max={40} step={1} format={(v) => `${v}%`} onChange={setSavingsRate} />
          <SliderField label="Expected return" value={returnRate} min={4} max={14} step={0.5} format={(v) => `${v}%`} onChange={setReturnRate} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="mindful" name="Mindful (save 50%)" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="custom" name="Your Choice" stroke="#f97316" strokeWidth={2.5} dot={false} strokeDasharray="6 3" />
              <Line type="monotone" dataKey="creep" name="Full Creep (spend 100%)" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ScenarioShell>
  )
}

function SliderField({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-sm font-semibold">{format(value)}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

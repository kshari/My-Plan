'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { futureValue } from '@/lib/utils/pulse-calculations'
import { ScenarioShell } from './scenario-shell'

const RATES = [5, 10, 15, 20, 25]
const COLORS = ['#94a3b8', '#f97316', '#22c55e', '#3b82f6', '#a855f7']

const FUN_FACT = {
  text: 'The average American savings rate is ~4.6%. At 15%, you\'d reach financial independence decades sooner.',
  source: 'Bureau of Economic Analysis, 2024',
}

export function PayYourselfFirstScenario({ backHref }: { backHref?: string }) {
  const [monthlyIncome, setMonthlyIncome] = useState(6000)
  const [returnRate, setReturnRate] = useState(8)
  const [years, setYears] = useState(25)
  const [highlight, setHighlight] = useState(10)

  const data = useMemo(() => {
    const points: Record<string, any>[] = []
    for (let y = 0; y <= years; y++) {
      const row: Record<string, any> = { year: y }
      for (const rate of RATES) {
        const monthly = monthlyIncome * (rate / 100)
        row[`rate_${rate}`] = Math.round(futureValue(0, monthly, returnRate / 100, y))
      }
      points.push(row)
    }
    return points
  }, [monthlyIncome, returnRate, years])

  const val10 = data[data.length - 1]?.[`rate_${highlight}`] ?? 0
  const val15 = data[data.length - 1]?.[`rate_${Math.min(highlight + 5, 25)}`] ?? 0
  const diff = val15 - val10

  const insight = `Going from ${highlight}% to ${Math.min(highlight + 5, 25)}% savings adds $${diff.toLocaleString()} over ${years} years. That's the power of 5 more cents on every dollar.`

  return (
    <ScenarioShell
      title="Pay Yourself First"
      description="How your savings rate shapes your financial future. Watch all 5 lines simultaneously — then find yours."
      scenarioId="pay-yourself-first"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5 rounded-xl border bg-card p-4">
          <SliderField label="Monthly gross income" value={monthlyIncome} min={2000} max={30000} step={500} format={(v) => `$${v.toLocaleString()}`} onChange={setMonthlyIncome} />
          <SliderField label="Expected return" value={returnRate} min={4} max={14} step={0.5} format={(v) => `${v}%`} onChange={setReturnRate} />
          <SliderField label="Time horizon" value={years} min={5} max={40} step={1} format={(v) => `${v} years`} onChange={setYears} />
          <div className="space-y-2">
            <Label className="text-xs">Highlight savings rate</Label>
            <div className="flex gap-2">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => setHighlight(r)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors ${highlight === r ? 'bg-orange-500 text-white border-orange-500' : 'hover:bg-accent'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`} />
              <Legend />
              {RATES.map((rate, i) => (
                <Line
                  key={rate}
                  type="monotone"
                  dataKey={`rate_${rate}`}
                  name={`${rate}% savings`}
                  stroke={COLORS[i]}
                  strokeWidth={rate === highlight ? 3 : 1.5}
                  dot={false}
                  opacity={rate === highlight ? 1 : 0.5}
                />
              ))}
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

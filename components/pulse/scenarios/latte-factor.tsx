'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { generateCompoundingCurve } from '@/lib/utils/pulse-calculations'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: 'Warren Buffett bought his first stock at age 11 and says he wishes he\'d started sooner.',
  source: 'Berkshire Hathaway shareholder letters',
}

export function LatteFactorScenario({ backHref }: { backHref?: string }) {
  const [dailySpend, setDailySpend] = useState(5)
  const [returnRate, setReturnRate] = useState(8)
  const [years, setYears] = useState(20)

  const data = useMemo(() => {
    const monthlyAmount = dailySpend * 30.44
    const invested = generateCompoundingCurve(0, monthlyAmount, returnRate / 100, years)
    return invested.map((p) => ({
      year: p.year,
      spent: Math.round(dailySpend * 365.25 * p.year),
      invested: Math.round(p.value),
    }))
  }, [dailySpend, returnRate, years])

  const last = data[data.length - 1]
  const totalSpent = last?.spent ?? 0
  const totalInvested = last?.invested ?? 0
  const gap = totalInvested - totalSpent

  const insight = `$${dailySpend}/day for ${years} years = $${totalSpent.toLocaleString()} spent. Invested instead: $${totalInvested.toLocaleString()}. The gap is $${gap.toLocaleString()} — that's compound interest working for you.`

  return (
    <ScenarioShell
      title="The Latte Factor"
      description="See how small daily spending compounds into a fortune over time. What if you invested that daily amount instead?"
      scenarioId="latte-factor"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Controls */}
        <div className="space-y-6 rounded-xl border bg-card p-4">
          <SliderField label="Daily spend" value={dailySpend} min={1} max={50} step={1} format={(v) => `$${v}`} onChange={setDailySpend} />
          <SliderField label="Expected return" value={returnRate} min={4} max={14} step={0.5} format={(v) => `${v}%`} onChange={setReturnRate} />
          <SliderField label="Time horizon" value={years} min={5} max={40} step={1} format={(v) => `${v} years`} onChange={setYears} />
        </div>

        {/* Chart */}
        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: 'Years', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`} />
              <Legend />
              <Area type="monotone" dataKey="spent" name="Total Spent" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} strokeWidth={2} />
              <Area type="monotone" dataKey="invested" name="If Invested" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
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

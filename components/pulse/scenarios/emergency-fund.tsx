'use client'

import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: '56% of Americans can\'t cover a $1,000 emergency expense. Building even 1 month of runway puts you ahead of half the country.',
  source: 'Bankrate Emergency Fund Report, 2024',
}

export function EmergencyFundScenario({ backHref }: { backHref?: string }) {
  const [monthlyExpenses, setMonthlyExpenses] = useState(4000)
  const [currentFund, setCurrentFund] = useState(5000)
  const [monthlyContrib, setMonthlyContrib] = useState(300)

  const data = useMemo(() => {
    const points: { month: number; balance: number; months_covered: number }[] = []
    let bal = currentFund
    for (let m = 0; m <= 24; m++) {
      points.push({ month: m, balance: Math.round(bal), months_covered: Math.round((bal / monthlyExpenses) * 10) / 10 })
      bal += monthlyContrib
    }
    return points
  }, [monthlyExpenses, currentFund, monthlyContrib])

  const currentMonths = monthlyExpenses > 0 ? currentFund / monthlyExpenses : 0
  const monthsTo6 = monthlyExpenses > 0 && monthlyContrib > 0
    ? Math.max(0, Math.ceil((monthlyExpenses * 6 - currentFund) / monthlyContrib))
    : Infinity

  const target3 = monthlyExpenses * 3
  const target6 = monthlyExpenses * 6
  const target12 = monthlyExpenses * 12

  const insight = monthsTo6 === Infinity
    ? `You currently have ${currentMonths.toFixed(1)} months of runway.`
    : `You currently have ${currentMonths.toFixed(1)} months of runway. At $${monthlyContrib}/month, you'll hit 6 months in ${monthsTo6} months (${Math.ceil(monthsTo6 / 4.33)} weeks).`

  return (
    <ScenarioShell
      title="Emergency Fund Runway"
      description="How fast can you build your safety net? See your fund grow month by month toward the 3/6/12-month targets."
      scenarioId="emergency-fund"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5 rounded-xl border bg-card p-4">
          <SliderField label="Monthly expenses" value={monthlyExpenses} min={1000} max={15000} step={250} format={(v) => `$${v.toLocaleString()}`} onChange={setMonthlyExpenses} />
          <SliderField label="Current emergency fund" value={currentFund} min={0} max={100000} step={500} format={(v) => `$${v.toLocaleString()}`} onChange={setCurrentFund} />
          <SliderField label="Monthly contribution" value={monthlyContrib} min={0} max={2000} step={25} format={(v) => `$${v}`} onChange={setMonthlyContrib} />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} label={{ value: 'Months', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`} />
              <Legend />
              <ReferenceLine y={target3} stroke="#f97316" strokeDasharray="6 3" label={{ value: '3 mo', position: 'right', fontSize: 11, fill: '#f97316' }} />
              <ReferenceLine y={target6} stroke="#22c55e" strokeDasharray="6 3" label={{ value: '6 mo', position: 'right', fontSize: 11, fill: '#22c55e' }} />
              {target12 <= (data[data.length - 1]?.balance ?? 0) * 1.3 && (
                <ReferenceLine y={target12} stroke="#3b82f6" strokeDasharray="6 3" label={{ value: '12 mo', position: 'right', fontSize: 11, fill: '#3b82f6' }} />
              )}
              <Area type="monotone" dataKey="balance" name="Fund Balance" stroke="#f97316" fill="#f97316" fillOpacity={0.15} strokeWidth={2} />
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

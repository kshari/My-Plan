'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { ScenarioShell } from './scenario-shell'

const FUN_FACT = {
  text: 'Einstein supposedly called compound interest the eighth wonder of the world. He probably didn\'t, but the math checks out.',
  source: 'Often attributed, origin unknown',
}

export function RuleOf72Scenario({ backHref }: { backHref?: string }) {
  const [rate, setRate] = useState(8)
  const [startAmount, setStartAmount] = useState(10000)

  const doublingYears = rate > 0 ? 72 / rate : Infinity

  const data = useMemo(() => {
    if (rate <= 0) return []
    const points: { label: string; value: number; year: number }[] = []
    let value = startAmount
    let year = 0
    const maxDoublings = 6
    for (let d = 0; d <= maxDoublings; d++) {
      points.push({
        label: d === 0 ? 'Start' : `${d}x doubled`,
        value: Math.round(value),
        year: Math.round(year),
      })
      value *= 2
      year += doublingYears
      if (year > 80) break
    }
    return points
  }, [rate, startAmount, doublingYears])

  const last = data[data.length - 1]
  const insight = rate > 0
    ? `At ${rate}%, your money doubles every ${doublingYears.toFixed(1)} years. $${startAmount.toLocaleString()} becomes $${(last?.value ?? 0).toLocaleString()} in ${(last?.year ?? 0)} years — with zero additional contributions.`
    : 'Set a return rate above 0% to see the doubling effect.'

  return (
    <ScenarioShell
      title="The Rule of 72"
      description="The simplest way to understand compound growth. Divide 72 by your return rate to see how many years until your money doubles."
      scenarioId="rule-of-72"
      backHref={backHref}
      insightText={insight}
      funFact={FUN_FACT}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5 rounded-xl border bg-card p-4">
          <SliderField label="Annual return rate" value={rate} min={1} max={20} step={0.5} format={(v) => `${v}%`} onChange={setRate} />
          <SliderField label="Starting amount" value={startAmount} min={1000} max={100000} step={1000} format={(v) => `$${v.toLocaleString()}`} onChange={setStartAmount} />

          <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Doubles every</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {rate > 0 ? `${doublingYears.toFixed(1)} years` : '∞'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">72 ÷ {rate} = {rate > 0 ? doublingYears.toFixed(1) : '∞'}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ top: 20, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip
                formatter={(value: number | undefined) => `$${(value ?? 0).toLocaleString()}`}
                labelFormatter={(label: any, payload: readonly any[]) => {
                  const year = payload?.[0]?.payload?.year
                  return year !== undefined ? `${label} (Year ${year})` : String(label)
                }}
              />
              <Bar dataKey="value" name="Portfolio Value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#94a3b8' : '#f97316'} fillOpacity={0.3 + (i / data.length) * 0.7} />
                ))}
                <LabelList dataKey="year" position="top" formatter={(v: any) => `Yr ${v}`} style={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              </Bar>
            </BarChart>
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

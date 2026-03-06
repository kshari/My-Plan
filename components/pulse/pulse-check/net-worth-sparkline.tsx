'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { parseLocalDate } from '@/lib/utils/formatting'
import type { PulseCheck } from '@/lib/demographics'

interface NetWorthSparklineProps {
  checks: PulseCheck[]
}

export function NetWorthSparkline({ checks }: NetWorthSparklineProps) {
  if (checks.length < 2) return null

  const data = [...checks]
    .sort((a, b) => parseLocalDate(a.check_date).getTime() - parseLocalDate(b.check_date).getTime())
    .map((c) => ({
      date: c.check_date,
      value: c.net_worth_snapshot,
    }))

  const min = Math.min(...data.map((d) => d.value))
  const max = Math.max(...data.map((d) => d.value))
  const latest = data[data.length - 1].value
  const first = data[0].value
  const trending = latest >= first

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net Worth Trend</p>
        <span className={`text-xs font-semibold ${trending ? 'text-emerald-600' : 'text-red-500'}`}>
          {trending ? '+' : ''}{(latest - first).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data}>
          <YAxis domain={[min * 0.95, max * 1.05]} hide />
          <Tooltip
            formatter={(value: number | undefined) => (value ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            labelFormatter={(label: string) => parseLocalDate(label).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={trending ? '#22c55e' : '#ef4444'}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

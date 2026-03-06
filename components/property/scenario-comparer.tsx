'use client'

import { useState, useMemo } from 'react'
import { Check } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend,
} from 'recharts'

interface ScenarioComparerProps {
  scenarios: any[]
  propertyId: number
}

interface MetricRow {
  label: string
  values: (string | number)[]
  rawValues: number[]
  higherIsBetter: boolean
  format: 'currency' | 'percent' | 'ratio' | 'number'
}

function formatValue(value: number, format: MetricRow['format']): string {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    case 'percent':
      return `${value.toFixed(2)}%`
    case 'ratio':
      return `${value.toFixed(2)}x`
    case 'number':
      return value.toLocaleString()
  }
}

function calculateMetrics(scenario: any) {
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const noi = grossIncome - operatingExpenses
  const hasLoan = scenario['Has Loan'] || false
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
  const monthlyMortgage = parseFloat(scenario['Monthly Mortgage']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount

  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
  const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0

  let annualMortgage = 0
  let firstYearInterest = 0
  let firstYearPrincipal = 0

  if (hasLoan && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
    let mp = monthlyMortgage
    if (!mp) {
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      if (numPayments > 0 && monthlyRate > 0) {
        mp = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      }
    }
    if (mp > 0) {
      annualMortgage = mp * 12
      const monthlyRate = interestRate / 100 / 12
      let balance = loanPrincipal
      for (let month = 1; month <= 12; month++) {
        const interestPayment = balance * monthlyRate
        const principalPayment = mp - interestPayment
        firstYearInterest += interestPayment
        firstYearPrincipal += principalPayment > balance ? balance : principalPayment
        balance = Math.max(0, balance - principalPayment)
      }
    }
  }

  const firstYearCashFlow = hasLoan
    ? noi - firstYearInterest - firstYearPrincipal
    : noi
  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0
  const dscr = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null
  const ltv = hasLoan && purchasePrice > 0 ? ((purchasePrice - downPaymentAmount) / purchasePrice) * 100 : null

  return {
    purchasePrice, grossIncome, operatingExpenses, noi, capRate, grm,
    totalCashInvested, firstYearCashFlow, firstYearCoCR, dscr, ltv,
    hasLoan, annualMortgage,
  }
}

export default function ScenarioComparer({ scenarios, propertyId }: ScenarioComparerProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(
    scenarios.slice(0, Math.min(3, scenarios.length)).map(s => s.id)
  )

  const toggleScenario = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev
        return prev.filter(x => x !== id)
      }
      if (prev.length >= 3) return prev
      return [...prev, id]
    })
  }

  const selectedScenarios = useMemo(
    () => scenarios.filter(s => selectedIds.includes(s.id)),
    [scenarios, selectedIds]
  )

  const metricsData = useMemo(
    () => selectedScenarios.map(s => ({ scenario: s, metrics: calculateMetrics(s) })),
    [selectedScenarios]
  )

  const rows: MetricRow[] = useMemo(() => {
    if (metricsData.length === 0) return []

    const r: MetricRow[] = [
      {
        label: 'Purchase Price',
        values: metricsData.map(m => formatValue(m.metrics.purchasePrice, 'currency')),
        rawValues: metricsData.map(m => m.metrics.purchasePrice),
        higherIsBetter: false,
        format: 'currency',
      },
      {
        label: 'Gross Income',
        values: metricsData.map(m => formatValue(m.metrics.grossIncome, 'currency')),
        rawValues: metricsData.map(m => m.metrics.grossIncome),
        higherIsBetter: true,
        format: 'currency',
      },
      {
        label: 'Operating Expenses',
        values: metricsData.map(m => formatValue(m.metrics.operatingExpenses, 'currency')),
        rawValues: metricsData.map(m => m.metrics.operatingExpenses),
        higherIsBetter: false,
        format: 'currency',
      },
      {
        label: 'NOI',
        values: metricsData.map(m => formatValue(m.metrics.noi, 'currency')),
        rawValues: metricsData.map(m => m.metrics.noi),
        higherIsBetter: true,
        format: 'currency',
      },
      {
        label: 'Cap Rate',
        values: metricsData.map(m => formatValue(m.metrics.capRate, 'percent')),
        rawValues: metricsData.map(m => m.metrics.capRate),
        higherIsBetter: true,
        format: 'percent',
      },
      {
        label: 'Total Cash Invested',
        values: metricsData.map(m => formatValue(m.metrics.totalCashInvested, 'currency')),
        rawValues: metricsData.map(m => m.metrics.totalCashInvested),
        higherIsBetter: false,
        format: 'currency',
      },
      {
        label: 'First Year Cash Flow',
        values: metricsData.map(m => formatValue(m.metrics.firstYearCashFlow, 'currency')),
        rawValues: metricsData.map(m => m.metrics.firstYearCashFlow),
        higherIsBetter: true,
        format: 'currency',
      },
      {
        label: 'First Year CoCR',
        values: metricsData.map(m => formatValue(m.metrics.firstYearCoCR, 'percent')),
        rawValues: metricsData.map(m => m.metrics.firstYearCoCR),
        higherIsBetter: true,
        format: 'percent',
      },
      {
        label: 'Gross Rent Multiplier',
        values: metricsData.map(m => formatValue(m.metrics.grm, 'ratio')),
        rawValues: metricsData.map(m => m.metrics.grm),
        higherIsBetter: false,
        format: 'ratio',
      },
    ]

    if (metricsData.some(m => m.metrics.dscr !== null)) {
      r.push({
        label: 'DSCR',
        values: metricsData.map(m => m.metrics.dscr !== null ? formatValue(m.metrics.dscr, 'ratio') : '-'),
        rawValues: metricsData.map(m => m.metrics.dscr ?? 0),
        higherIsBetter: true,
        format: 'ratio',
      })
    }

    return r
  }, [metricsData])

  const getBestIndex = (row: MetricRow): number => {
    if (row.rawValues.every(v => v === 0)) return -1
    return row.higherIsBetter
      ? row.rawValues.indexOf(Math.max(...row.rawValues))
      : row.rawValues.indexOf(Math.min(...row.rawValues.filter(v => v > 0)))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium mb-3">Select 2-3 scenarios to compare:</p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map(s => {
            const isSelected = selectedIds.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggleScenario(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
                {s['Scenario Name'] || `Scenario #${s.id}`}
              </button>
            )
          })}
        </div>
      </div>

      {selectedScenarios.length >= 2 && (() => {
        const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b']
        const radarMetrics = ['Cap Rate', 'CoCR', 'NOI', 'Cash Flow', 'GRM']
        const radarData = radarMetrics.map(metric => {
          const entry: any = { metric }
          metricsData.forEach((m, i) => {
            const name = m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`
            switch (metric) {
              case 'Cap Rate': entry[name] = m.metrics.capRate; break
              case 'CoCR': entry[name] = m.metrics.firstYearCoCR; break
              case 'NOI': entry[name] = m.metrics.noi / 1000; break
              case 'Cash Flow': entry[name] = m.metrics.firstYearCashFlow / 1000; break
              case 'GRM': entry[name] = m.metrics.grm; break
            }
          })
          return entry
        })
        const scenarioNames = metricsData.map(m => m.scenario['Scenario Name'] || `Scenario #${m.scenario.id}`)

        return (
          <>
            <div className="rounded-xl border bg-card p-4">
              <h4 className="text-sm font-semibold mb-2 text-center">Metric Comparison</h4>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  {scenarioNames.map((name, i) => (
                    <Radar
                      key={name}
                      name={name}
                      dataKey={name}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-1">NOI and Cash Flow shown in thousands ($K)</p>
            </div>
          </>
        )
      })()}

      {selectedScenarios.length >= 2 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Metric
                  </th>
                  {selectedScenarios.map(s => (
                    <th key={s.id} className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {s['Scenario Name'] || `Scenario #${s.id}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(row => {
                  const bestIdx = getBestIndex(row)
                  return (
                    <tr key={row.label} className="hover:bg-muted/50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                        {row.label}
                      </td>
                      {row.values.map((val, i) => (
                        <td
                          key={i}
                          className={`whitespace-nowrap px-4 py-3 text-right text-sm tabular-nums ${
                            i === bestIdx
                              ? 'font-bold text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {val}
                          {i === bestIdx && <span className="ml-1 text-xs">&#9733;</span>}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

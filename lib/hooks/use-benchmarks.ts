'use client'

import { useMemo } from 'react'
import type { DemographicProfile, BenchmarkRow } from '@/lib/demographics'
import { BENCHMARK_DATA } from '@/lib/constants/benchmark-data'
import { findBenchmark, estimatePercentile, computeNetWorth } from '@/lib/utils/pulse-calculations'

export interface PeerComparison {
  metric: string
  label: string
  userValue: number
  peerMedian: number
  percentile: number
  format: 'currency' | 'months' | 'percent'
  lowerIsBetter?: boolean
  /** Short formula/explanation for tooltip */
  mathTooltip?: string
}

export function useBenchmarks(profile: DemographicProfile | null): PeerComparison[] {
  return useMemo(() => {
    if (!profile) return []
    const benchmarks = BENCHMARK_DATA
    const comparisons: PeerComparison[] = []

    const nwBench = findBenchmark(benchmarks, 'net_worth', profile.age)
    if (nwBench) {
      const nw = computeNetWorth(profile)
      const assets = profile.total_retirement_savings + profile.emergency_fund + profile.stock_investments + profile.real_estate_investments + (profile.home_value ?? 0) + (profile.college_529_balance ?? 0)
      const liabilities = (profile.mortgage_balance ?? 0) + profile.debts.reduce((sum, d) => sum + d.balance, 0)
      comparisons.push({
        metric: 'net_worth',
        label: 'Net Worth',
        userValue: nw,
        peerMedian: nwBench.percentile_50,
        percentile: Math.round(estimatePercentile(nw, nwBench)),
        format: 'currency',
        mathTooltip: `Assets − Liabilities = Net worth\nAssets: retirement + emergency fund + investments + home value + 529 = $${assets.toLocaleString()}\nLiabilities: mortgage + debt balances = $${liabilities.toLocaleString()}\nPercentile: where your value falls vs peers in your age group (benchmark median).`,
      })
    }

    const retBench = findBenchmark(benchmarks, 'retirement_savings', profile.age)
    if (retBench && profile.total_retirement_savings > 0) {
      comparisons.push({
        metric: 'retirement_savings',
        label: 'Retirement Savings',
        userValue: profile.total_retirement_savings,
        peerMedian: retBench.percentile_50,
        percentile: Math.round(estimatePercentile(profile.total_retirement_savings, retBench)),
        format: 'currency',
        mathTooltip: `Your total retirement savings (from profile).\nCompared to peer median for your age.\nPercentile = where you rank (e.g. 60th = you have more than 60% of peers).`,
      })
    }

    const emBench = findBenchmark(benchmarks, 'emergency_months', profile.age)
    if (emBench && profile.monthly_expenses > 0) {
      const months = profile.emergency_fund / profile.monthly_expenses
      comparisons.push({
        metric: 'emergency_months',
        label: 'Emergency Fund',
        userValue: Math.round(months * 10) / 10,
        peerMedian: emBench.percentile_50,
        percentile: Math.round(estimatePercentile(months, emBench)),
        format: 'months',
        mathTooltip: `Emergency fund ÷ Monthly expenses = months of runway\n${profile.emergency_fund.toLocaleString()} ÷ ${profile.monthly_expenses.toLocaleString()} = ${months.toFixed(1)} mo\nCompared to peer median (${emBench.percentile_50} mo). Higher is better.`,
      })
    }

    const srBench = findBenchmark(benchmarks, 'savings_rate', profile.age)
    if (srBench && profile.annual_gross_income > 0) {
      const rate = (profile.monthly_savings / (profile.annual_gross_income / 12)) * 100
      const monthlyGross = profile.annual_gross_income / 12
      comparisons.push({
        metric: 'savings_rate',
        label: 'Savings Rate',
        userValue: Math.round(rate * 10) / 10,
        peerMedian: srBench.percentile_50,
        percentile: Math.round(estimatePercentile(rate, srBench)),
        format: 'percent',
        mathTooltip: `Monthly savings ÷ Monthly gross income × 100\n${profile.monthly_savings.toLocaleString()} ÷ ${monthlyGross.toLocaleString()} × 100 = ${rate.toFixed(1)}%\nCompared to peer median (${srBench.percentile_50}%). Higher is better.`,
      })
    }

    const dtiBench = findBenchmark(benchmarks, 'dti_ratio', profile.age)
    if (dtiBench && profile.annual_gross_income > 0) {
      const monthlyGross = profile.annual_gross_income / 12
      const totalPayments = profile.debts.reduce((s, d) => s + d.min_payment, 0)
      const dti = (totalPayments / monthlyGross) * 100
      comparisons.push({
        metric: 'dti_ratio',
        label: 'Debt-to-Income',
        userValue: Math.round(dti * 10) / 10,
        peerMedian: dtiBench.percentile_50,
        percentile: Math.round(estimatePercentile(dti, dtiBench)),
        format: 'percent',
        lowerIsBetter: true,
        mathTooltip: `Total monthly debt payments ÷ Monthly gross income × 100\n${totalPayments.toLocaleString()} ÷ ${monthlyGross.toLocaleString()} × 100 = ${dti.toFixed(1)}%\nCompared to peer median (${dtiBench.percentile_50}%). Lower is better.`,
      })
    }

    return comparisons
  }, [profile])
}

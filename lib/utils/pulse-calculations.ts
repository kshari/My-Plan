import type { DemographicProfile, BenchmarkRow } from '@/lib/demographics'

// ── Compounding helpers ──

export function futureValue(pv: number, monthlyAdd: number, annualRate: number, years: number): number {
  const r = annualRate / 12
  const n = years * 12
  if (r === 0) return pv + monthlyAdd * n
  const fvPv = pv * Math.pow(1 + r, n)
  const fvPmt = monthlyAdd * ((Math.pow(1 + r, n) - 1) / r)
  return fvPv + fvPmt
}

export function yearsToDouble(annualRate: number): number {
  if (annualRate <= 0) return Infinity
  return 72 / (annualRate * 100)
}

export function generateCompoundingCurve(
  pv: number,
  monthlyAdd: number,
  annualRate: number,
  years: number,
): { year: number; value: number }[] {
  const points: { year: number; value: number }[] = []
  for (let y = 0; y <= years; y++) {
    points.push({ year: y, value: futureValue(pv, monthlyAdd, annualRate, y) })
  }
  return points
}

// ── Resilience Score ──

export interface ResilienceBreakdown {
  emergencyFund: number
  savingsRate: number
  debtHealth: number
  netWorthPercentile: number
  total: number
}

export function computeResilienceScore(
  profile: DemographicProfile,
  benchmarks: BenchmarkRow[],
): ResilienceBreakdown {
  const monthlyGross = profile.annual_gross_income / 12

  // Emergency fund: months of expenses saved, target = 6
  const emergencyMonths = profile.monthly_expenses > 0
    ? profile.emergency_fund / profile.monthly_expenses
    : 0
  const emergencyFund = Math.min(100, (emergencyMonths / 6) * 100)

  // Savings rate vs 20% target
  const savingsRatePct = monthlyGross > 0
    ? (profile.monthly_savings / monthlyGross) * 100
    : 0
  const savingsRate = Math.min(100, (savingsRatePct / 20) * 100)

  // Debt health: inverse of DTI vs 36% threshold
  const totalDebtPayments = profile.debts.reduce((sum, d) => sum + d.min_payment, 0)
  const dti = monthlyGross > 0 ? (totalDebtPayments / monthlyGross) * 100 : 0
  const debtHealth = dti >= 36 ? 0 : Math.min(100, ((36 - dti) / 36) * 100)

  // Net worth percentile in age bracket
  const netWorth = computeNetWorth(profile)
  const nwBenchmark = findBenchmark(benchmarks, 'net_worth', profile.age)
  let netWorthPercentile = 50
  if (nwBenchmark) {
    netWorthPercentile = estimatePercentile(netWorth, nwBenchmark)
  }

  const total = Math.round(
    emergencyFund * 0.25 +
    savingsRate * 0.25 +
    debtHealth * 0.25 +
    netWorthPercentile * 0.25
  )

  return {
    emergencyFund: Math.round(emergencyFund),
    savingsRate: Math.round(savingsRate),
    debtHealth: Math.round(debtHealth),
    netWorthPercentile: Math.round(netWorthPercentile),
    total: Math.max(0, Math.min(100, total)),
  }
}

export function computeNetWorth(profile: DemographicProfile): number {
  const assets =
    profile.total_retirement_savings +
    profile.emergency_fund +
    profile.stock_investments +
    profile.real_estate_investments +
    (profile.home_value ?? 0) +
    (profile.college_529_balance ?? 0)
  const liabilities =
    (profile.mortgage_balance ?? 0) +
    profile.debts.reduce((sum, d) => sum + d.balance, 0)
  return assets - liabilities
}

// ── Benchmark helpers ──

export function findBenchmark(
  benchmarks: BenchmarkRow[],
  metric: string,
  age: number,
): BenchmarkRow | undefined {
  return benchmarks.find(
    (b) => b.metric === metric && age >= b.age_min && age <= b.age_max
  )
}

export function estimatePercentile(value: number, benchmark: BenchmarkRow): number {
  const { percentile_25, percentile_50, percentile_75, percentile_90 } = benchmark
  if (value <= percentile_25) return Math.max(0, (value / percentile_25) * 25)
  if (value <= percentile_50) return 25 + ((value - percentile_25) / (percentile_50 - percentile_25)) * 25
  if (value <= percentile_75) return 50 + ((value - percentile_50) / (percentile_75 - percentile_50)) * 25
  if (value <= percentile_90) return 75 + ((value - percentile_75) / (percentile_90 - percentile_75)) * 15
  return Math.min(99, 90 + ((value - percentile_90) / percentile_90) * 9)
}

// ── Debt payoff strategies ──

export interface DebtPayoffResult {
  months: number
  totalInterest: number
  timeline: { month: number; remaining: number }[]
}

export function simulateDebtPayoff(
  debts: { balance: number; rate: number; min_payment: number }[],
  extraMonthly: number,
  strategy: 'avalanche' | 'snowball',
): DebtPayoffResult {
  if (debts.length === 0) return { months: 0, totalInterest: 0, timeline: [] }

  const sorted = debts.map((d) => ({ ...d }))
  sorted.sort((a, b) =>
    strategy === 'avalanche' ? b.rate - a.rate : a.balance - b.balance
  )

  const balances = sorted.map((d) => d.balance)
  const rates = sorted.map((d) => d.rate / 100 / 12)
  const mins = sorted.map((d) => d.min_payment)

  let month = 0
  let totalInterest = 0
  const timeline: { month: number; remaining: number }[] = [
    { month: 0, remaining: balances.reduce((s, b) => s + b, 0) },
  ]

  while (balances.some((b) => b > 0.01) && month < 600) {
    month++
    let extra = extraMonthly

    for (let i = 0; i < balances.length; i++) {
      if (balances[i] <= 0) continue
      const interest = balances[i] * rates[i]
      totalInterest += interest
      balances[i] += interest

      let payment = mins[i]
      if (i === balances.findIndex((b) => b > 0)) {
        payment += extra
        extra = 0
      }
      payment = Math.min(payment, balances[i])
      balances[i] -= payment

      if (balances[i] < 0.01) {
        extra += mins[i]
        balances[i] = 0
      }
    }

    timeline.push({
      month,
      remaining: balances.reduce((s, b) => s + b, 0),
    })
  }

  return { months: month, totalInterest: Math.round(totalInterest), timeline }
}

// ── Lifestyle creep ──

export function simulateLifestyleCreep(
  annualIncome: number,
  raisePercent: number,
  spendPercent: number,
  currentSavingsRate: number,
  expectedReturn: number,
  years: number,
): { year: number; mindful: number; creep: number; custom: number }[] {
  const result: { year: number; mindful: number; creep: number; custom: number }[] = []

  let incomeM = annualIncome
  let incomeC = annualIncome
  let incomeCustom = annualIncome

  let portfolioM = 0
  let portfolioC = 0
  let portfolioCustom = 0

  for (let y = 0; y <= years; y++) {
    result.push({
      year: y,
      mindful: Math.round(portfolioM),
      creep: Math.round(portfolioC),
      custom: Math.round(portfolioCustom),
    })

    if (y === years) break

    const raiseM = incomeM * (raisePercent / 100)
    const raiseFractionM = raiseM * 0.5
    const savingsM = incomeM * (currentSavingsRate / 100) + raiseFractionM
    portfolioM = (portfolioM + savingsM) * (1 + expectedReturn / 100)
    incomeM += raiseM

    const raiseC = incomeC * (raisePercent / 100)
    const savingsC = incomeC * (currentSavingsRate / 100)
    portfolioC = (portfolioC + savingsC) * (1 + expectedReturn / 100)
    incomeC += raiseC

    const raiseCustom = incomeCustom * (raisePercent / 100)
    const raiseFractionCustom = raiseCustom * ((100 - spendPercent) / 100)
    const savingsCustom = incomeCustom * (currentSavingsRate / 100) + raiseFractionCustom
    portfolioCustom = (portfolioCustom + savingsCustom) * (1 + expectedReturn / 100)
    incomeCustom += raiseCustom
  }

  return result
}

'use client'

import { IRR_INITIAL_GUESS, IRR_TOLERANCE, IRR_MAX_ITERATIONS } from '@/lib/constants/property-defaults'

interface FinancialMetricsProps {
  scenario: any
  loan?: any
  showTitle?: boolean
}

function calculateIRR(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0
  const hasNegative = cashFlows.some(cf => cf < 0)
  const hasPositive = cashFlows.some(cf => cf > 0)
  if (!hasNegative || !hasPositive) return 0

  let irr = IRR_INITIAL_GUESS

  for (let i = 0; i < IRR_MAX_ITERATIONS; i++) {
    let npv = 0
    let npvDerivative = 0

    for (let j = 0; j < cashFlows.length; j++) {
      const discountFactor = Math.pow(1 + irr, j)
      if (isFinite(discountFactor) && discountFactor !== 0) {
        npv += cashFlows[j] / discountFactor
        if (j > 0) {
          npvDerivative -= (j * cashFlows[j]) / (discountFactor * (1 + irr))
        }
      }
    }

    if (Math.abs(npv) < IRR_TOLERANCE) break
    if (Math.abs(npvDerivative) < IRR_TOLERANCE || !isFinite(npvDerivative)) break

    const newIrr = irr - npv / npvDerivative
    if (!isFinite(newIrr) || newIrr < -0.99 || newIrr > 0.99) break
    irr = newIrr
  }

  const result = irr * 100
  if (!isFinite(result) || result < -99 || result > 99) return 0
  return result
}

export default function FinancialMetrics({ scenario, loan, showTitle = true }: FinancialMetricsProps) {
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const hasLoan = scenario['Has Loan'] || false
  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount

  const annualMortgage = loan
    ? parseFloat(loan['Annual Mortgage']?.toString() || '0') || 0
    : parseFloat(scenario['Annual Mortgage']?.toString() || '0') || 0

  const noi = grossIncome - operatingExpenses
  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
  const debtServiceCoverageRatio = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null
  const grossRentMultiplier = grossIncome > 0 ? purchasePrice / grossIncome : 0
  const loanToValue = purchasePrice > 0 ? ((purchasePrice - downPaymentAmount) / purchasePrice) * 100 : 0

  // Calculate first-year IRR (assumes sale at end of year 1)
  let firstYearIRR = 0
  if (totalCashInvested > 0 && purchasePrice > 0) {
    let firstYearInterest = 0
    let firstYearPrincipal = 0
    let remainingBalance = loanPrincipal

    if (hasLoan && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      let mp = 0
      if (numPayments > 0 && monthlyRate > 0) {
        mp = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      }
      if (mp > 0) {
        let balance = loanPrincipal
        for (let month = 1; month <= 12; month++) {
          const interestPayment = balance * monthlyRate
          const principalPayment = mp - interestPayment
          firstYearInterest += interestPayment
          firstYearPrincipal += principalPayment > balance ? balance : principalPayment
          balance = Math.max(0, balance - principalPayment)
        }
        remainingBalance = balance
      }
    }

    const netIncome = noi - firstYearInterest
    const cashFlow = netIncome - firstYearPrincipal
    const equity = hasLoan ? purchasePrice - remainingBalance : purchasePrice
    const cashFlows = [-totalCashInvested, cashFlow + equity]
    firstYearIRR = calculateIRR(cashFlows)
  }

  const metrics = [
    { label: 'Cap Rate', value: `${capRate.toFixed(2)}%`, highlight: true },
    ...(firstYearIRR !== 0
      ? [{ label: 'Year 1 IRR', value: `${firstYearIRR.toFixed(2)}%`, highlight: false }]
      : []),
    ...(hasLoan && debtServiceCoverageRatio !== null
      ? [{ label: 'DSCR', value: `${debtServiceCoverageRatio.toFixed(2)}x`, highlight: false }]
      : []),
    ...(hasLoan
      ? [{ label: 'Loan-to-Value', value: `${loanToValue.toFixed(2)}%`, highlight: false }]
      : []),
    { label: 'Gross Rent Multiplier', value: `${grossRentMultiplier.toFixed(2)}x`, highlight: false },
    {
      label: 'Total Cash Invested',
      value: `$${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      highlight: false,
    },
  ]

  const content = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">{m.label}</p>
          <p className={`mt-1 text-sm font-semibold tabular-nums ${m.highlight ? 'text-primary' : ''}`}>
            {m.value}
          </p>
        </div>
      ))}
    </div>
  )

  if (!showTitle) {
    return <div>{content}</div>
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="mb-4 text-base font-semibold">Financial Metrics</h3>
      {content}
    </div>
  )
}

'use client'

import { IRR_INITIAL_GUESS, IRR_TOLERANCE, IRR_MAX_ITERATIONS } from '@/lib/constants/property-defaults'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

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

  const metrics: { label: string; value: string; highlight: boolean; tip: string }[] = [
    {
      label: 'Cap Rate',
      value: `${capRate.toFixed(2)}%`,
      highlight: true,
      tip: `Annual profit ÷ purchase price — how much the property earns relative to its cost, without considering the mortgage.\n\nRule of thumb: ≥8% great · 5–8% solid · <5% low yield.\n\nYour profit: $${noi.toLocaleString(undefined, { maximumFractionDigits: 0 })} ÷ $${purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${capRate.toFixed(2)}%`,
    },
    ...(firstYearIRR !== 0 ? [{
      label: 'Total Return % (IRR)',
      value: `${firstYearIRR.toFixed(2)}%`,
      highlight: false,
      tip: `Year 1 Internal Rate of Return — combines your cash flow AND the equity you'd gain if you sold after one year, into a single annual return percentage.\n\nRule of thumb: ≥15% great · 10–15% good · <10% low.\nGood to compare against stocks (historically ~10%/yr).`,
    }] : []),
    ...(hasLoan && debtServiceCoverageRatio !== null ? [{
      label: 'Loan Coverage Ratio (DSCR)',
      value: `${debtServiceCoverageRatio.toFixed(2)}x`,
      highlight: false,
      tip: `Debt Service Coverage Ratio — how many times over your rental profit covers the mortgage payment.\n\n1.0x = income exactly covers mortgage · >1.25x comfortable · <1.0x shortfall (you cover the gap out of pocket).\n\nLenders typically require ≥1.2x for investment property loans.`,
    }] : []),
    ...(hasLoan ? [{
      label: '% Financed (LTV)',
      value: `${loanToValue.toFixed(2)}%`,
      highlight: false,
      tip: `Loan-to-Value — the share of the purchase price covered by the mortgage.\n\n≤75% conservative (more equity, better rates) · 75–80% typical investment · >80% higher risk, may require mortgage insurance.\n\nLower = more of your own money in, less you owe.`,
    }] : []),
    {
      label: 'Price-to-Rent Ratio (GRM)',
      value: `${grossRentMultiplier.toFixed(2)}x`,
      highlight: false,
      tip: `Gross Rent Multiplier — how many years of rental income it takes to equal the purchase price.\n\nLower is better value. ≤8 excellent · 8–12 good · >15 expensive relative to rent.\n\nQuick comparison tool — doesn't include expenses or financing.`,
    },
    {
      label: 'Upfront Cash Needed',
      value: `$${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      highlight: false,
      tip: hasLoan
        ? `Down payment + closing fees — the actual cash you need to bring to closing.\n\nThis is used to calculate your Cash Return % (CoCR).`
        : `Full purchase price + closing fees — you're paying all cash, so no mortgage.\n\nThis is used to calculate your overall return %.`,
    },
  ]

  const content = (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0" aria-label={`About ${m.label}`}>
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left leading-relaxed whitespace-pre-line text-xs">
                {m.tip}
              </TooltipContent>
            </Tooltip>
          </div>
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
      <h3 className="mb-4 text-base font-semibold">Investment Metrics</h3>
      {content}
    </div>
  )
}

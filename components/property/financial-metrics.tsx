'use client'

interface FinancialMetricsProps {
  scenario: any
  loan?: any
  showTitle?: boolean
}

export default function FinancialMetrics({ scenario, loan, showTitle = true }: FinancialMetricsProps) {
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const annualInterest = parseFloat(scenario['Annual Interest']?.toString() || '0') || 0
  const annualPrincipal = parseFloat(scenario['Annual Principal']?.toString() || '0') || 0
  const hasLoan = scenario['Has Loan'] || false

  // Get annual mortgage from loan data if available, otherwise from scenario
  const annualMortgage = loan 
    ? parseFloat(loan['Annual Mortgage']?.toString() || '0') || 0
    : parseFloat(scenario['Annual Mortgage']?.toString() || '0') || 0

  // Calculate metrics
  const noi = grossIncome - operatingExpenses // Net Operating Income
  // Net Income = NOI (if no loan) or NOI - Annual Interest (if loan exists)
  const netIncome = hasLoan ? noi - annualInterest : noi
  // Total Cash Invested: No loan = Purchase Price + Purchase Closing Costs, With loan = Down Payment + Loan Closing Costs + Purchase Closing Costs
  const totalCashInvested = hasLoan 
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts
  const cashOnCashReturn = totalCashInvested > 0 ? (netIncome / totalCashInvested) * 100 : 0
  const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
  // DSCR = NOI / Annual Mortgage Payment (debt service)
  const debtServiceCoverageRatio = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null
  const grossRentMultiplier = grossIncome > 0 ? purchasePrice / grossIncome : 0
  const loanToValue = purchasePrice > 0 ? ((purchasePrice - downPaymentAmount) / purchasePrice) * 100 : 0

  const content = (
    <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Cap Rate</dt>
            <dd className="mt-1 text-lg font-semibold">{capRate.toFixed(2)}%</dd>
          </div>
          {scenario['Has Loan'] && (
            <>
              {debtServiceCoverageRatio !== null && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Debt Service Coverage Ratio (DSCR)</dt>
                  <dd className="mt-1 text-lg font-semibold">{debtServiceCoverageRatio.toFixed(2)}x</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Loan-to-Value (LTV)</dt>
                <dd className="mt-1 text-lg font-semibold">{loanToValue.toFixed(2)}%</dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Gross Rent Multiplier</dt>
            <dd className="mt-1 text-lg font-semibold">{grossRentMultiplier.toFixed(2)}x</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Cash Invested</dt>
            <dd className="mt-1 text-lg">${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
    </dl>
  )

  if (!showTitle) {
    return <div>{content}</div>
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Financial Metrics</h3>
      {content}
    </div>
  )
}

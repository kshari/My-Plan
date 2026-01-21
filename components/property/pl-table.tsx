'use client'

import { useMemo } from 'react'

interface PLTableProps {
  scenario: any
  years?: number
}

// Function to calculate IRR using Newton-Raphson method
function calculateIRR(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0
  
  // Check if we have at least one negative and one positive cash flow
  const hasNegative = cashFlows.some(cf => cf < 0)
  const hasPositive = cashFlows.some(cf => cf > 0)
  if (!hasNegative || !hasPositive) return 0
  
  // Initial guess between -99% and 99% to avoid division by zero
  let irr = 0.1
  const maxIterations = 100
  const tolerance = 0.0001

  for (let i = 0; i < maxIterations; i++) {
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

    if (Math.abs(npv) < tolerance) {
      break
    }

    if (Math.abs(npvDerivative) < tolerance || !isFinite(npvDerivative)) {
      break
    }

    const newIrr = irr - npv / npvDerivative
    
    // Constrain IRR to reasonable bounds (-99% to 99%)
    if (!isFinite(newIrr) || newIrr < -0.99 || newIrr > 0.99) {
      break
    }
    
    irr = newIrr
  }

  // Return as percentage, clamp to reasonable range
  const result = irr * 100
  if (!isFinite(result) || result < -99 || result > 99) {
    return 0
  }
  
  return result
}

export default function PLTable({ scenario, years }: PLTableProps) {
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const baseGrossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const baseOperatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const incomeIncreasePercent = parseFloat(scenario['Income Increase']?.toString() || '0') || 0
  const expensesIncreasePercent = parseFloat(scenario['Expenses Increase']?.toString() || '0') || 0
  const propertyValueIncreasePercent = parseFloat(scenario['Property Value Increase']?.toString() || '0') || 0
  const hasLoan = scenario['Has Loan'] || false
  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const monthlyMortgage = parseFloat(scenario['Monthly Mortgage']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount
  // Total Cash Invested: No loan = Purchase Price + Purchase Closing Costs, With loan = Down Payment + Loan Closing Costs + Purchase Closing Costs
  const totalCashInvested = hasLoan 
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  // Determine number of years to show
  const displayYears = years || (hasLoan && loanTerm > 0 ? loanTerm : 10)

  const plData = useMemo(() => {
    const data = []
    let remainingLoanBalance = hasLoan ? loanPrincipal : 0

    // Calculate amortization schedule for accurate year-by-year principal and interest
    let amortizationSchedule: { year: number; interest: number; principal: number; balance: number }[] = []
    if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0 && monthlyMortgage > 0) {
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      let balance = loanPrincipal

      for (let year = 1; year <= loanTerm; year++) {
        let yearInterest = 0
        let yearPrincipal = 0

        for (let month = 1; month <= 12; month++) {
          const paymentNum = (year - 1) * 12 + month
          if (paymentNum <= numPayments && balance > 0.01) {
            const interestPayment = balance * monthlyRate
            const principalPayment = monthlyMortgage - interestPayment
            yearInterest += interestPayment
            yearPrincipal += principalPayment > balance ? balance : principalPayment
            balance = Math.max(0, balance - principalPayment)
          }
        }

        amortizationSchedule.push({
          year,
          interest: yearInterest,
          principal: yearPrincipal,
          balance: balance,
        })
      }
    }

    for (let year = 1; year <= displayYears; year++) {
      // Calculate annual increases: Year 1 = base, Year 2+ = compounded
      const incomeMultiplier = year === 1 ? 1 : Math.pow(1 + incomeIncreasePercent / 100, year - 1)
      const expensesMultiplier = year === 1 ? 1 : Math.pow(1 + expensesIncreasePercent / 100, year - 1)
      const propertyValueMultiplier = year === 1 ? 1 : Math.pow(1 + propertyValueIncreasePercent / 100, year - 1)
      
      const grossIncome = baseGrossIncome * incomeMultiplier
      const operatingExpenses = baseOperatingExpenses * expensesMultiplier
      const currentPropertyValue = purchasePrice * propertyValueMultiplier
      
      const noi = grossIncome - operatingExpenses
      
      let interest = 0
      let principal = 0
      
      if (hasLoan && amortizationSchedule.length > 0) {
        const yearData = amortizationSchedule[year - 1]
        if (yearData) {
          interest = yearData.interest
          principal = yearData.principal
          remainingLoanBalance = yearData.balance
        }
      } else if (hasLoan) {
        // Fallback: use stored annual values
        interest = parseFloat(scenario['Annual Interest']?.toString() || '0') || 0
        principal = parseFloat(scenario['Annual Principal']?.toString() || '0') || 0
        if (year <= loanTerm) {
          remainingLoanBalance = Math.max(0, remainingLoanBalance - principal)
        } else {
          interest = 0
          principal = 0
        }
      }
      
      const netIncome = noi - interest
      // Cash flow = Net Income - Principal (closing costs are part of initial investment, not an expense)
      const cashFlow = netIncome - principal
      const cashOnCashReturn = totalCashInvested > 0 ? (cashFlow / totalCashInvested) * 100 : 0
      
      // Equity = Current Property Value - Remaining Loan Balance (or just Current Property Value if no loan)
      const equity = hasLoan ? currentPropertyValue - remainingLoanBalance : currentPropertyValue

      data.push({
        year,
        grossIncome,
        operatingExpenses,
        noi,
        interest,
        principal,
        netIncome,
        cashFlow,
        cashOnCashReturn,
        remainingLoanBalance: hasLoan ? remainingLoanBalance : 0,
        equity,
        irr: 0, // Will be calculated below
      })
    }

    // Calculate IRR for each year
    // For year-by-year IRR, each year assumes the property is sold at the end of that year
    // Cash flows: [-initial investment, year1_cf, year2_cf, ..., yearN_cf + equity]
    for (let i = 0; i < data.length; i++) {
      const yearCashFlows: number[] = [-totalCashInvested] // Year 0: Initial investment (negative)
      
      // Add annual cash flows up to and including this year
      for (let j = 0; j <= i; j++) {
        if (j === i) {
          // This year: include equity (assumes sale at end of year)
          yearCashFlows.push(data[j].cashFlow + data[j].equity)
        } else {
          // Previous years: just the cash flow
          yearCashFlows.push(data[j].cashFlow)
        }
      }
      
      data[i].irr = calculateIRR(yearCashFlows)
    }

    return data
  }, [scenario, displayYears, purchasePrice, baseGrossIncome, baseOperatingExpenses, incomeIncreasePercent, expensesIncreasePercent, propertyValueIncreasePercent, hasLoan, loanTerm, loanPrincipal, interestRate, monthlyMortgage])

  const totalClosingCosts = loanClosingCosts + purchaseClosingCosts

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Profit & Loss by Year</h3>
      <div className="mb-4 rounded-lg bg-gray-50 p-4">
        <div className="mb-2 font-semibold text-gray-900">Total Cash Invested</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {hasLoan ? (
            <>
              <div>
                <div className="text-gray-600">Down Payment</div>
                <div className="font-medium text-gray-900">${downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-gray-600">Loan Closing Costs</div>
                <div className="font-medium text-gray-900">${loanClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-gray-600">Purchase Closing Costs</div>
                <div className="font-medium text-gray-900">${purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-gray-600">Total</div>
                <div className="font-medium text-gray-900">${totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-gray-600">Purchase Price</div>
                <div className="font-medium text-gray-900">${purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-gray-600">Purchase Closing Costs</div>
                <div className="font-medium text-gray-900">${purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-gray-600">Total</div>
                <div className="font-medium text-gray-900">${totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Year</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Gross Income</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Operating Expenses</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">NOI</th>
              {hasLoan && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Interest</th>}
              {hasLoan && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Principal</th>}
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Net Income</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cash Flow</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cash on Cash Return (%)</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Equity</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">IRR (%)</th>
              {hasLoan && <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Remaining Loan Balance</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {plData.map((row) => (
              <tr key={row.year} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{row.year}</td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                  ${row.grossIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                  ${row.operatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${row.noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {hasLoan && (
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                )}
                {hasLoan && (
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                )}
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                  ${row.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${row.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${row.cashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${row.cashOnCashReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {row.cashOnCashReturn.toFixed(2)}%
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                  ${row.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-medium ${row.irr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {row.irr.toFixed(2)}%
                </td>
                {hasLoan && (
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${Math.max(0, row.remainingLoanBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

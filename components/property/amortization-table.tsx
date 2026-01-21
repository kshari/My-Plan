'use client'

import { useMemo } from 'react'

interface AmortizationTableProps {
  loanTerm: number | null // in years
  principal: number | null
  interestRate: number | null // annual percentage
  monthlyPayment: number | null
}

interface AmortizationRow {
  paymentNumber: number
  paymentAmount: number
  principal: number
  interest: number
  remainingBalance: number
}

export default function AmortizationTable({
  loanTerm,
  principal,
  interestRate,
  monthlyPayment,
}: AmortizationTableProps) {
  const amortizationSchedule = useMemo(() => {
    if (!loanTerm || !principal || !interestRate || !monthlyPayment || principal <= 0 || interestRate <= 0 || monthlyPayment <= 0) {
      return []
    }

    const schedule: AmortizationRow[] = []
    const monthlyRate = interestRate / 100 / 12
    const totalPayments = loanTerm * 12
    let remainingBalance = principal

    // Recalculate monthly payment to ensure accuracy
    const calculatedMonthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1)
    
    // Use the provided monthly payment if available, otherwise use calculated
    const paymentAmount = monthlyPayment || calculatedMonthlyPayment

    for (let i = 1; i <= totalPayments && remainingBalance > 0.01; i++) {
      const interestPayment = remainingBalance * monthlyRate
      const principalPayment = paymentAmount - interestPayment
      const newBalance = remainingBalance - principalPayment

      schedule.push({
        paymentNumber: i,
        paymentAmount,
        principal: principalPayment > remainingBalance ? remainingBalance : principalPayment,
        interest: interestPayment,
        remainingBalance: newBalance < 0 ? 0 : newBalance,
      })

      remainingBalance = newBalance < 0 ? 0 : newBalance
    }

    return schedule
  }, [loanTerm, principal, interestRate, monthlyPayment])

  // Calculate totals
  const totals = useMemo(() => {
    return amortizationSchedule.reduce(
      (acc, row) => ({
        totalPrincipal: acc.totalPrincipal + row.principal,
        totalInterest: acc.totalInterest + row.interest,
        totalPayments: acc.totalPayments + row.paymentAmount,
      }),
      { totalPrincipal: 0, totalInterest: 0, totalPayments: 0 }
    )
  }, [amortizationSchedule])

  // Determine principal and interest rate from props or calculate from loan data
  const displayPrincipal = principal || 0
  const displayInterestRate = interestRate || 0
  const displayMonthlyPayment = monthlyPayment || 0

  if (!loanTerm || !principal || !interestRate || !monthlyPayment || principal <= 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">Amortization Schedule</h3>
        <p className="mb-4 text-sm text-gray-600">Enter loan details to view the amortization schedule</p>
        <p className="text-sm text-gray-500">Please fill in the loan information above to generate the amortization schedule.</p>
      </div>
    )
  }

  // Show only first 12 months, last 12 months, and allow user to see more
  const firstYear = amortizationSchedule.slice(0, 12)
  const lastYear = amortizationSchedule.slice(-12)
  const showFullSchedule = amortizationSchedule.length <= 24

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="mb-2 text-lg font-semibold text-gray-900">Amortization Schedule</h3>
      <p className="mb-4 text-sm text-gray-600">
        Loan Principal: ${displayPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 
        Interest Rate: {displayInterestRate.toFixed(2)}% | 
        Monthly Payment: ${displayMonthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Payment #</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Payment Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Principal</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Interest</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Remaining Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {showFullSchedule ? (
              amortizationSchedule.map((row) => (
                <tr key={row.paymentNumber} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{row.paymentNumber}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                    ${row.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <>
                {firstYear.map((row) => (
                  <tr key={row.paymentNumber} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{row.paymentNumber}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 italic">
                    ... {amortizationSchedule.length - 24} payments hidden ...
                  </td>
                </tr>
                {lastYear.map((row) => (
                  <tr key={row.paymentNumber} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{row.paymentNumber}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                      ${row.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </>
            )}
            <tr className="font-semibold bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">Totals</td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                ${totals.totalPayments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                ${totals.totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">
                ${totals.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-900">$0.00</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>Total of {amortizationSchedule.length} payments over {loanTerm} years</p>
        <p>Total Interest Paid: ${totals.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
    </div>
  )
}

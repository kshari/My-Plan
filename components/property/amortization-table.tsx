'use client'

import { useMemo } from 'react'
import { BALANCE_THRESHOLD } from '@/lib/constants/property-defaults'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

interface AmortizationTableProps {
  loanTerm: number | null
  principal: number | null
  interestRate: number | null
  monthlyPayment: number | null
}

interface AmortizationRow {
  paymentNumber: number
  paymentAmount: number
  principal: number
  interest: number
  remainingBalance: number
}

const fmt = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const columns: ColumnDef<AmortizationRow>[] = [
  {
    accessorKey: 'paymentNumber',
    header: 'Payment #',
    cell: ({ getValue }) => <span className="tabular-nums font-medium">{getValue<number>()}</span>,
  },
  {
    accessorKey: 'paymentAmount',
    header: 'Payment',
    cell: ({ getValue }) => <span className="tabular-nums">{fmt(getValue<number>())}</span>,
  },
  {
    accessorKey: 'principal',
    header: 'Principal',
    cell: ({ getValue }) => <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(getValue<number>())}</span>,
  },
  {
    accessorKey: 'interest',
    header: 'Interest',
    cell: ({ getValue }) => <span className="tabular-nums text-destructive">{fmt(getValue<number>())}</span>,
  },
  {
    accessorKey: 'remainingBalance',
    header: 'Balance',
    cell: ({ getValue }) => <span className="tabular-nums">{fmt(getValue<number>())}</span>,
  },
]

export default function AmortizationTable({
  loanTerm,
  principal,
  interestRate,
  monthlyPayment,
}: AmortizationTableProps) {
  const schedule = useMemo<AmortizationRow[]>(() => {
    if (!loanTerm || !principal || !interestRate || !monthlyPayment || principal <= 0 || interestRate <= 0 || monthlyPayment <= 0) {
      return []
    }
    const monthlyRate = interestRate / 100 / 12
    const totalPayments = loanTerm * 12
    let balance = principal
    const rows: AmortizationRow[] = []

    for (let i = 1; i <= totalPayments && balance > BALANCE_THRESHOLD; i++) {
      const interestPayment = balance * monthlyRate
      const principalPayment = monthlyPayment - interestPayment
      const newBalance = balance - principalPayment

      rows.push({
        paymentNumber: i,
        paymentAmount: monthlyPayment,
        principal: principalPayment > balance ? balance : principalPayment,
        interest: interestPayment,
        remainingBalance: newBalance < 0 ? 0 : newBalance,
      })
      balance = newBalance < 0 ? 0 : newBalance
    }
    return rows
  }, [loanTerm, principal, interestRate, monthlyPayment])

  const totals = useMemo(
    () =>
      schedule.reduce(
        (acc, row) => ({
          totalPrincipal: acc.totalPrincipal + row.principal,
          totalInterest: acc.totalInterest + row.interest,
          totalPayments: acc.totalPayments + row.paymentAmount,
        }),
        { totalPrincipal: 0, totalInterest: 0, totalPayments: 0 }
      ),
    [schedule]
  )

  if (!loanTerm || !principal || !interestRate || !monthlyPayment || principal <= 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-2 text-base font-semibold">Amortization Schedule</h3>
        <p className="text-sm text-muted-foreground">Enter loan details above to generate the amortization schedule.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold">Amortization Schedule</h3>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Principal: <strong className="text-foreground">{fmt(principal)}</strong></span>
          <span>Rate: <strong className="text-foreground">{interestRate.toFixed(2)}%</strong></span>
          <span>Monthly: <strong className="text-foreground">{fmt(monthlyPayment)}</strong></span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Paid', value: fmt(totals.totalPayments) },
          { label: 'Total Principal', value: fmt(totals.totalPrincipal), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Interest', value: fmt(totals.totalInterest), color: 'text-destructive' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`mt-1 text-sm font-semibold tabular-nums ${item.color ?? ''}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Table with pagination */}
      <DataTable
        columns={columns}
        data={schedule}
        searchPlaceholder="Jump to payment #…"
        pageSize={24}
        emptyMessage="No schedule generated."
      />

      <p className="text-xs text-muted-foreground">
        {schedule.length} payments over {loanTerm} year{loanTerm !== 1 ? 's' : ''} ·{' '}
        Total interest: {fmt(totals.totalInterest)}
      </p>
    </div>
  )
}

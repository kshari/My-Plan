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
  /**
   * 'screen' (default): paginated, searchable interactive table.
   * 'print':  renders ALL rows in a single static table so they survive
   *           the static PDF export (browsers otherwise only capture the
   *           currently-visible UI page).
   */
  variant?: 'screen' | 'print'
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
  variant = 'screen',
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

      {/* Table: paginated on screen, full static render for print */}
      {variant === 'print' ? (
        <div className="print-amort-table">
          <table className="w-full border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-border">
                {columns.map((c) => (
                  <th
                    key={String(c.id ?? (c as { accessorKey?: string }).accessorKey)}
                    className="px-2 py-1.5 text-left font-medium text-muted-foreground"
                  >
                    {typeof c.header === 'string' ? c.header : String(c.id ?? '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.paymentNumber} className="border-b border-border/40">
                  <td className="px-2 py-1 font-medium">{row.paymentNumber}</td>
                  <td className="px-2 py-1">{fmt(row.paymentAmount)}</td>
                  <td className="px-2 py-1 text-emerald-700">{fmt(row.principal)}</td>
                  <td className="px-2 py-1 text-red-700">{fmt(row.interest)}</td>
                  <td className="px-2 py-1">{fmt(row.remainingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={schedule}
          searchPlaceholder="Jump to payment #…"
          pageSize={24}
          emptyMessage="No schedule generated."
        />
      )}

      {/* In print, the three summary cards above + the final row (#N with
          $0.00 balance) already convey "N payments · Total interest $X",
          so hide this trailing paragraph to avoid an orphan line when the
          last schedule page fills completely. */}
      {variant !== 'print' && (
        <p className="text-xs text-muted-foreground">
          {schedule.length} payments over {loanTerm} year{loanTerm !== 1 ? 's' : ''} ·{' '}
          Total interest: {fmt(totals.totalInterest)}
        </p>
      )}
    </div>
  )
}

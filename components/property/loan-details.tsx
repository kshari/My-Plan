import DeleteLoanButton from '@/components/property/delete-loan-button'

interface Loan {
  'Loan Term': number | null
  'Down Payment Percentage': number | null
  'Down Payment Amount': number | null
  'Purchase Price': number | null
  'Interest Rate': number | null
  'Monthly Mortgage': number | null
  'Monthly Principal': number | null
  'Monthly Interest': number | null
  'Closing Costs': number | null
  'Annual Mortgage': number | null
  'Annual Principal': number | null
  'Annual Interest': number | null
}

interface LoanDetailsProps {
  loan: Loan
  propertyId?: number
  scenarioId?: number
}

export default function LoanDetails({ loan, propertyId, scenarioId }: LoanDetailsProps) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Loan Information</h3>
        {propertyId && scenarioId && (
          <DeleteLoanButton propertyId={propertyId} scenarioId={scenarioId} />
        )}
      </div>
      <dl className="space-y-4">
        {loan['Loan Term'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Loan Term</dt>
            <dd className="mt-1 text-lg tabular-nums">{loan['Loan Term']} years</dd>
          </div>
        )}
        {loan['Purchase Price'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Purchase Price</dt>
            <dd className="mt-1 text-lg tabular-nums">${loan['Purchase Price'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        )}
        {loan['Down Payment Percentage'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Down Payment</dt>
            <dd className="mt-1 text-lg tabular-nums">
              {loan['Down Payment Percentage']}%
              {loan['Down Payment Amount'] && (
                <span className="text-muted-foreground"> (${loan['Down Payment Amount'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
              )}
            </dd>
          </div>
        )}
        {loan['Interest Rate'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Interest Rate</dt>
            <dd className="mt-1 text-lg tabular-nums">{loan['Interest Rate']}%</dd>
          </div>
        )}
        {loan['Monthly Mortgage'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Monthly Mortgage Payment</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">${loan['Monthly Mortgage'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        )}
        {loan['Monthly Principal'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Monthly Principal</dt>
            <dd className="mt-1 text-lg tabular-nums">${loan['Monthly Principal'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        )}
        {loan['Monthly Interest'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Monthly Interest</dt>
            <dd className="mt-1 text-lg tabular-nums">${loan['Monthly Interest'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        )}
        {loan['Closing Costs'] && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Closing Costs</dt>
            <dd className="mt-1 text-lg tabular-nums">${loan['Closing Costs'].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

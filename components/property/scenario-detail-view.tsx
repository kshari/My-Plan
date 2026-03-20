import type { ReactNode } from 'react'
import Link from 'next/link'
import FinancialMetrics from '@/components/property/financial-metrics'
import LoanDetails, { type Loan } from '@/components/property/loan-details'
import AmortizationTable from '@/components/property/amortization-table'
import PLTable from '@/components/property/pl-table'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'

export interface ScenarioDetailViewProps {
  backHref: string
  address: string | null
  scenario: Record<string, unknown>
  loan: Record<string, unknown> | null
  subtitle?: string | null
  titleOverride?: string | null
  actions?: ReactNode
  loanMeta?: { propertyId: number; scenarioId: number }
}

export default function ScenarioDetailView({
  backHref,
  address,
  scenario,
  loan,
  subtitle,
  titleOverride,
  actions,
  loanMeta,
}: ScenarioDetailViewProps) {
  const hasLoan = !!scenario['Has Loan']
  const title =
    titleOverride ??
    ((scenario['Scenario Name'] as string | null | undefined) || 'Scenario Details')

  const purchasePrice = parseFloat(String(scenario['Purchase Price'] ?? '0')) || 0
  const grossIncome = parseFloat(String(scenario['Gross Income'] ?? '0')) || 0
  const operatingExpenses = parseFloat(String(scenario['Operating Expenses'] ?? '0')) || 0
  const noi = grossIncome - operatingExpenses
  const downPaymentAmount = parseFloat(String(scenario['Down Payment Amount'] ?? '0')) || 0
  const loanClosingCosts = parseFloat(String(scenario['Closing Costs'] ?? '0')) || 0
  const purchaseClosingCosts = parseFloat(String(scenario['Purchase Closing Costs'] ?? '0')) || 0
  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  let firstYearInterest = 0
  let firstYearPrincipal = 0
  let firstYearCashFlow = noi

  if (hasLoan && loan) {
    firstYearInterest = parseFloat(String(loan['Annual Interest'] ?? '0')) || 0
    firstYearPrincipal = parseFloat(String(loan['Annual Principal'] ?? '0')) || 0
    firstYearCashFlow = noi - firstYearInterest - firstYearPrincipal
  }

  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0

  const amt = (v: unknown) =>
    v != null && v !== ''
      ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '0.00'

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={backHref} className={BACK_LINK}>
        &larr; Back to Property
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{address || 'Property'}</p>
          {subtitle ? (
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3 shrink-0">{actions}</div> : null}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">Deal Assumptions</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Purchase Price</dt>
                <dd className="mt-1 text-sm tabular-nums">${amt(scenario['Purchase Price'])}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Annual Rental Income</dt>
                <dd className="mt-1 text-sm tabular-nums">${amt(scenario['Gross Income'])}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Annual Running Costs</dt>
                <dd className="mt-1 text-sm tabular-nums">${amt(scenario['Operating Expenses'])}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Annual Profit Before Mortgage</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">${amt(noi)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Financed with Mortgage</dt>
                <dd className="mt-1 text-sm">{hasLoan ? 'Yes' : 'No'}</dd>
              </div>
              {!!scenario['Income Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Rent Growth Rate / yr</dt>
                  <dd className="mt-1 text-sm tabular-nums">{String(scenario['Income Increase'])}%</dd>
                </div>
              )}
              {!!scenario['Expenses Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Cost Growth Rate / yr</dt>
                  <dd className="mt-1 text-sm tabular-nums">{String(scenario['Expenses Increase'])}%</dd>
                </div>
              )}
              {!!scenario['Property Value Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Appreciation Rate / yr</dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    {String(scenario['Property Value Increase'])}%
                  </dd>
                </div>
              )}
              {!!scenario['Purchase Closing Costs'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Buying Fees (Closing Costs)</dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    ${amt(scenario['Purchase Closing Costs'])}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {hasLoan ? (
            loan ? (
              <LoanDetails
                loan={loan as unknown as Loan}
                propertyId={loanMeta?.propertyId}
                scenarioId={loanMeta?.scenarioId}
              />
            ) : (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">Mortgage Details</h3>
                <p className="text-muted-foreground">No mortgage details found for this scenario.</p>
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">Mortgage Details</h3>
              <p className="text-muted-foreground">This scenario is an all-cash purchase (no mortgage).</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <FinancialMetrics scenario={scenario} loan={loan ?? undefined} />

          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">Year 1 Summary</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Annual Profit Before Mortgage (NOI)</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">${amt(noi)}</dd>
              </div>
              {hasLoan && loan ? (
                <>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Year 1 Mortgage Interest</dt>
                    <dd className="mt-1 text-lg tabular-nums">${amt(firstYearInterest)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Year 1 Loan Repaid (Principal)</dt>
                    <dd className="mt-1 text-lg tabular-nums">${amt(firstYearPrincipal)}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Year 1 Cash in Your Pocket</dt>
                <dd
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    firstYearCashFlow >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive'
                  }`}
                >
                  ${amt(firstYearCashFlow)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Upfront Cash Needed</dt>
                <dd className="mt-1 text-lg tabular-nums">${amt(totalCashInvested)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Year 1 Cash Return % (CoCR)</dt>
                <dd
                  className={`mt-1 text-lg font-bold tabular-nums ${
                    firstYearCoCR >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-destructive'
                  }`}
                >
                  {firstYearCoCR.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <PLTable scenario={scenario} />

      {hasLoan &&
      loan &&
      loan['Loan Term'] != null &&
      loan['Interest Rate'] != null &&
      loan['Monthly Mortgage'] != null ? (
          <div className="mt-6">
            <AmortizationTable
              loanTerm={Number(loan['Loan Term'])}
              principal={
                scenario['Purchase Price'] && scenario['Down Payment Amount']
                  ? Number(scenario['Purchase Price']) - Number(scenario['Down Payment Amount'])
                  : null
              }
              interestRate={Number(loan['Interest Rate'])}
              monthlyPayment={Number(loan['Monthly Mortgage'])}
            />
          </div>
        ) : null}
    </div>
  )
}

import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import FinancialMetrics from '@/components/property/financial-metrics'
import LoanDetails from '@/components/property/loan-details'
import AmortizationTable from '@/components/property/amortization-table'
import PLTable from '@/components/property/pl-table'
import DeleteScenarioButton from '@/components/property/delete-scenario-button'

interface ScenarioDetailPageProps {
  params: Promise<{ id: string; scenarioId: string }>
}

export default async function ScenarioDetailPage({ params }: ScenarioDetailPageProps) {
  const { id, scenarioId } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  const scenarioIdNum = parseInt(scenarioId)

  if (isNaN(propertyId) || isNaN(scenarioIdNum)) {
    notFound()
  }

  const { data: property, error: propertyError } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) {
    notFound()
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('id', scenarioIdNum)
    .eq('Property ID', propertyId)
    .single()

  if (scenarioError || !scenario) {
    notFound()
  }

  const { data: loan } = await supabase
    .from('pi_loans')
    .select('*')
    .eq('scenario_id', scenarioIdNum)
    .single()

  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const noi = grossIncome - operatingExpenses
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const totalCashInvested = scenario['Has Loan']
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  let firstYearInterest = 0
  let firstYearPrincipal = 0
  let firstYearCashFlow = noi

  if (scenario['Has Loan'] && loan) {
    firstYearInterest = parseFloat(loan['Annual Interest']?.toString() || '0') || 0
    firstYearPrincipal = parseFloat(loan['Annual Principal']?.toString() || '0') || 0
    firstYearCashFlow = noi - firstYearInterest - firstYearPrincipal
  }

  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/property/properties/${propertyId}`} className={BACK_LINK}>
        &larr; Back to Property
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {scenario['Scenario Name'] || 'Scenario Details'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{property.address || 'Property'}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/apps/property/properties/${propertyId}/scenarios/${scenarioIdNum}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Edit Scenario
          </Link>
          <DeleteScenarioButton
            propertyId={propertyId}
            scenarioId={scenarioIdNum}
            scenarioName={scenario['Scenario Name'] || undefined}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">Scenario Details</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Purchase Price</dt>
                <dd className="mt-1 text-sm tabular-nums">
                  ${scenario['Purchase Price']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Gross Income</dt>
                <dd className="mt-1 text-sm tabular-nums">
                  ${scenario['Gross Income']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Operating Expenses</dt>
                <dd className="mt-1 text-sm tabular-nums">
                  ${scenario['Operating Expenses']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">NOI</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Has Loan</dt>
                <dd className="mt-1 text-sm">{scenario['Has Loan'] ? 'Yes' : 'No'}</dd>
              </div>
              {scenario['Income Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Annual Income Increase</dt>
                  <dd className="mt-1 text-sm tabular-nums">{scenario['Income Increase']}%</dd>
                </div>
              )}
              {scenario['Expenses Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Annual Expenses Increase</dt>
                  <dd className="mt-1 text-sm tabular-nums">{scenario['Expenses Increase']}%</dd>
                </div>
              )}
              {scenario['Property Value Increase'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Annual Property Value Increase</dt>
                  <dd className="mt-1 text-sm tabular-nums">{scenario['Property Value Increase']}%</dd>
                </div>
              )}
              {scenario['Purchase Closing Costs'] && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Purchase Closing Costs</dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    ${scenario['Purchase Closing Costs']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {scenario['Has Loan'] ? (
            loan ? (
              <LoanDetails loan={loan} propertyId={propertyId} scenarioId={scenarioIdNum} />
            ) : (
              <div className="rounded-xl border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">Loan Information</h3>
                <p className="text-muted-foreground">No loan details found for this scenario.</p>
              </div>
            )
          ) : (
            <div className="rounded-xl border bg-card p-6">
              <h3 className="mb-4 text-base font-semibold">Loan Information</h3>
              <p className="text-muted-foreground">This scenario does not include a loan.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <FinancialMetrics scenario={scenario} loan={loan} />

          <div className="rounded-xl border bg-card p-6">
            <h3 className="mb-4 text-base font-semibold">First Year Financials</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Net Operating Income (NOI)</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </dd>
              </div>
              {scenario['Has Loan'] && loan && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">First Year Interest</dt>
                    <dd className="mt-1 text-lg tabular-nums">
                      ${firstYearInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">First Year Principal</dt>
                    <dd className="mt-1 text-lg tabular-nums">
                      ${firstYearPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt className="text-sm font-medium text-muted-foreground">First Year Cash Flow</dt>
                <dd className={`mt-1 text-lg font-bold tabular-nums ${firstYearCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  ${firstYearCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Total Cash Invested</dt>
                <dd className="mt-1 text-lg tabular-nums">
                  ${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">First Year CoCR</dt>
                <dd className={`mt-1 text-lg font-bold tabular-nums ${firstYearCoCR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {firstYearCoCR.toFixed(2)}%
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <PLTable scenario={scenario} />

      {scenario['Has Loan'] && loan && loan['Loan Term'] && loan['Interest Rate'] && loan['Monthly Mortgage'] && (
        <div className="mt-6">
          <AmortizationTable
            loanTerm={loan['Loan Term']}
            principal={scenario['Purchase Price'] && scenario['Down Payment Amount']
              ? scenario['Purchase Price'] - scenario['Down Payment Amount']
              : null}
            interestRate={loan['Interest Rate']}
            monthlyPayment={loan['Monthly Mortgage']}
          />
        </div>
      )}
    </div>
  )
}

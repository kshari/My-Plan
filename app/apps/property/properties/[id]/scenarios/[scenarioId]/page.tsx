import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import FinancialMetrics from '@/components/property/financial-metrics'
import LoanDetails from '@/components/property/loan-details'
import AmortizationTable from '@/components/property/amortization-table'
import DeleteScenarioButton from '@/components/property/delete-scenario-button'

interface ScenarioDetailPageProps {
  params: Promise<{ id: string; scenarioId: string }>
}

export default async function ScenarioDetailPage({ params }: ScenarioDetailPageProps) {
  const { id, scenarioId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const propertyId = parseInt(id)
  const scenarioIdNum = parseInt(scenarioId)
  
  if (isNaN(propertyId) || isNaN(scenarioIdNum)) {
    notFound()
  }

  // Fetch the property and verify it belongs to the user
  const { data: property, error: propertyError } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) {
    notFound()
  }

  // Fetch the scenario and verify it belongs to the property
  const { data: scenario, error: scenarioError } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('id', scenarioIdNum)
    .eq('Property ID', propertyId)
    .single()

  if (scenarioError || !scenario) {
    notFound()
  }

  // Fetch loan if scenario has one
  const { data: loan } = await supabase
    .from('pi_loans')
    .select('*')
    .eq('scanario', scenarioIdNum)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link 
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              ← My Plan / Property Investment
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href={`/apps/property/properties/${propertyId}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Back to Property
              </Link>
              <Link
                href="/apps/property/dashboard"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href={`/apps/property/properties/${propertyId}`}
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Property
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {scenario['Scenario Name'] || 'Scenario Details'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{property.address || 'Property'}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/apps/property/properties/${propertyId}/scenarios/${scenarioIdNum}/edit`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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

        {/* Top Row: Scenario Details + Loan Info (left) | Financial Metrics + First Year Financials (right) */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Scenario Details + Loan Information */}
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Scenario Details</h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Purchase Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${scenario['Purchase Price']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Gross Income</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${scenario['Gross Income']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Operating Expenses</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${scenario['Operating Expenses']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Net Operating Income (NOI)</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    ${((scenario['Gross Income'] || 0) - (scenario['Operating Expenses'] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Has Loan</dt>
                  <dd className="mt-1 text-sm text-gray-900">{scenario['Has Loan'] ? 'Yes' : 'No'}</dd>
                </div>
                {scenario['Income Increase'] && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Annual Income Increase</dt>
                    <dd className="mt-1 text-sm text-gray-900">{scenario['Income Increase']}%</dd>
                  </div>
                )}
                {scenario['Expenses Increase'] && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Annual Expenses Increase</dt>
                    <dd className="mt-1 text-sm text-gray-900">{scenario['Expenses Increase']}%</dd>
                  </div>
                )}
                {scenario['Property Value Increase'] && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Annual Property Value Increase</dt>
                    <dd className="mt-1 text-sm text-gray-900">{scenario['Property Value Increase']}%</dd>
                  </div>
                )}
                {scenario['Purchase Closing Costs'] && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Purchase Closing Costs</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      ${scenario['Purchase Closing Costs']?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Loan Information */}
            {scenario['Has Loan'] ? (
              <>
                {loan ? (
                  <LoanDetails 
                    loan={loan} 
                    propertyId={propertyId} 
                    scenarioId={scenarioIdNum}
                  />
                ) : (
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">Loan Information</h3>
                    <p className="text-gray-600">No loan details found for this scenario.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Loan Information</h3>
                <p className="text-gray-600">This scenario does not include a loan.</p>
              </div>
            )}
          </div>

          {/* Right Column: Financial Metrics + First Year Financials */}
          <div className="space-y-6">
            {/* Financial Metrics */}
            <FinancialMetrics scenario={scenario} loan={loan} />
            
            {/* First Year Financials */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">First Year Financials</h3>
              <dl className="space-y-4">
                {(() => {
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
                  
                  // Calculate first year interest and principal if loan exists
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
                    <>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Net Operating Income (NOI)</dt>
                        <dd className="mt-1 text-lg font-semibold text-gray-900">
                          ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </dd>
                      </div>
                      {scenario['Has Loan'] && loan && (
                        <>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">First Year Interest</dt>
                            <dd className="mt-1 text-lg text-gray-900">
                              ${firstYearInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">First Year Principal</dt>
                            <dd className="mt-1 text-lg text-gray-900">
                              ${firstYearPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt className="text-sm font-medium text-gray-500">First Year Cash Flow</dt>
                        <dd className={`mt-1 text-lg font-bold ${firstYearCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          ${firstYearCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Total Cash Invested</dt>
                        <dd className="mt-1 text-lg text-gray-900">
                          ${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">First Year Cash on Cash Return (CoCR)</dt>
                        <dd className={`mt-1 text-lg font-bold ${firstYearCoCR >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {firstYearCoCR.toFixed(2)}%
                        </dd>
                      </div>
                    </>
                  )
                })()}
              </dl>
            </div>
          </div>
        </div>

        {/* Third Row: Amortization Schedule (full width) */}
        {scenario['Has Loan'] && loan && loan['Loan Term'] && loan['Interest Rate'] && loan['Monthly Mortgage'] && (
          <div>
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
      </main>
    </div>
  )
}

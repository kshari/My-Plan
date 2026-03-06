import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DeleteScenarioButton from '@/components/property/delete-scenario-button'
import DeleteAllScenariosButton from '@/components/property/delete-all-scenarios-button'
import { ErrorMessage } from '@/components/ui/error-message'
import { EmptyState } from '@/components/ui/empty-state'

interface FinancialScenariosListProps {
  propertyId: number
}

function computeMetrics(scenario: any) {
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const noi = grossIncome - operatingExpenses
  const hasLoan = scenario['Has Loan'] || false
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
  const monthlyMortgage = parseFloat(scenario['Monthly Mortgage']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount

  let firstYearInterest = 0
  let firstYearPrincipal = 0

  if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0) {
    let monthlyPayment = monthlyMortgage
    if (!monthlyPayment && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      if (numPayments > 0 && monthlyRate > 0) {
        monthlyPayment = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      }
    }

    if (monthlyPayment > 0) {
      const monthlyRate = interestRate / 100 / 12
      let balance = loanPrincipal
      for (let month = 1; month <= 12; month++) {
        const interestPayment = balance * monthlyRate
        const principalPayment = monthlyPayment - interestPayment
        firstYearInterest += interestPayment
        firstYearPrincipal += principalPayment > balance ? balance : principalPayment
        balance = Math.max(0, balance - principalPayment)
      }
    }
  }

  const totalCashInvested = hasLoan
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  const firstYearNetIncome = hasLoan ? noi - firstYearInterest : noi
  const firstYearCashFlow = hasLoan
    ? firstYearNetIncome - firstYearPrincipal
    : noi
  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0
  const capRate = purchasePrice > 0 && noi >= 0 ? (noi / purchasePrice) * 100 : 0

  return {
    purchasePrice, grossIncome, noi, capRate, totalCashInvested,
    firstYearCashFlow, firstYearCoCR, hasLoan,
  }
}

export default async function FinancialScenariosList({ propertyId }: FinancialScenariosListProps) {
  const supabase = await createClient()

  const { data: scenarios, error } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('created_at', { ascending: false })

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Financial Scenarios</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage financial scenarios and loan information for this property</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link 
            href={`/apps/property/properties/${propertyId}/scenarios/recommended`}
            className="rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Model Scenarios
          </Link>
          {scenarios && scenarios.length >= 2 && (
            <Link
              href={`/apps/property/properties/${propertyId}/compare`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              Compare
            </Link>
          )}
          <Link
            href={`/apps/property/properties/${propertyId}/scenarios/new`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Scenario
          </Link>
          {scenarios && scenarios.length > 0 && (
            <DeleteAllScenariosButton 
              propertyId={propertyId}
              scenarioCount={scenarios.length}
            />
          )}
        </div>
      </div>

      {error && <ErrorMessage message={`Error loading scenarios: ${error.message}`} />}

      {!scenarios || scenarios.length === 0 ? (
        <EmptyState
          message="No scenarios yet"
          description="Get started by adding your first financial scenario."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Scenario Name</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Purchase Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">NOI</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Cap Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Cash Invested</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Year 1 Cash Flow</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Year 1 CoCR</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scenarios.map((scenario: any) => {
                  const m = computeMetrics(scenario)
                  return (
                    <tr key={scenario.id} className="hover:bg-muted/50">
                      <td className="whitespace-nowrap px-4 py-4 text-sm font-medium">
                        <Link href={`/apps/property/properties/${propertyId}/scenarios/${scenario.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                          {scenario['Scenario Name'] || 'Unnamed Scenario'}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted-foreground tabular-nums">
                        {m.purchasePrice > 0 ? `$${m.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium text-foreground tabular-nums">
                        ${m.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted-foreground tabular-nums">
                        {m.capRate > 0 ? m.capRate.toFixed(2) + '%' : '-'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted-foreground tabular-nums">
                        ${m.totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums ${m.firstYearCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        ${m.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 text-right text-sm font-semibold tabular-nums ${m.firstYearCoCR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {m.firstYearCoCR.toFixed(2)}%
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-muted-foreground">
                        <DeleteScenarioButton 
                          propertyId={propertyId} 
                          scenarioId={scenario.id} 
                          scenarioName={scenario['Scenario Name'] || undefined} 
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {scenarios.map((scenario: any) => {
              const m = computeMetrics(scenario)
              return (
                <div key={scenario.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Link
                      href={`/apps/property/properties/${propertyId}/scenarios/${scenario.id}`}
                      className="font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {scenario['Scenario Name'] || 'Unnamed Scenario'}
                    </Link>
                    <DeleteScenarioButton
                      propertyId={propertyId}
                      scenarioId={scenario.id}
                      scenarioName={scenario['Scenario Name'] || undefined}
                    />
                  </div>
                  <Link
                    href={`/apps/property/properties/${propertyId}/scenarios/${scenario.id}`}
                    className="grid grid-cols-2 gap-2 text-sm"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">Purchase Price</p>
                      <p className="font-medium tabular-nums">{m.purchasePrice > 0 ? `$${m.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cap Rate</p>
                      <p className="font-medium tabular-nums">{m.capRate > 0 ? `${m.capRate.toFixed(2)}%` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Year 1 Cash Flow</p>
                      <p className={`font-semibold tabular-nums ${m.firstYearCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        ${m.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Year 1 CoCR</p>
                      <p className={`font-semibold tabular-nums ${m.firstYearCoCR >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {m.firstYearCoCR.toFixed(2)}%
                      </p>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

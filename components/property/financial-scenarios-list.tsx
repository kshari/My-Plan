import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DeleteScenarioButton from '@/components/property/delete-scenario-button'
import DeleteAllScenariosButton from '@/components/property/delete-all-scenarios-button'

interface FinancialScenariosListProps {
  propertyId: number
}

export default async function FinancialScenariosList({ propertyId }: FinancialScenariosListProps) {
  const supabase = await createClient()

  const { data: scenarios, error } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('created_at', { ascending: false })

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Financial Scenarios</h3>
          <p className="mt-1 text-sm text-gray-600">Manage financial scenarios and loan information for this property</p>
        </div>
        <div className="flex gap-2">
          <Link 
            href={`/apps/property/properties/${propertyId}/scenarios/recommended`}
            className="rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Model Scenarios
          </Link>
          <Link 
            href={`/apps/property/properties/${propertyId}/scenarios/new`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          Error loading scenarios: {error.message}
        </div>
      )}

      {!scenarios || scenarios.length === 0 ? (
        <div className="py-12 text-center">
          <h3 className="mt-4 text-lg font-medium text-gray-900">No scenarios yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Get started by adding your first financial scenario.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Scenario Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Purchase Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Gross Income</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">NOI</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Cap Rate</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Total Cash Invested</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">First Year Cash Flow</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">First Year CoCR</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
                {scenarios.map((scenario: any) => {
                  // Calculate metrics
                  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
                  const grossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
                  const operatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
                  const noi = grossIncome - operatingExpenses
                  const hasLoan = scenario['Has Loan'] || false
                  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
                  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
                  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
                  // Calculate loan values if needed
                  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
                  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
                  const monthlyMortgage = parseFloat(scenario['Monthly Mortgage']?.toString() || '0') || 0
                  const loanPrincipal = purchasePrice - downPaymentAmount
                  
                  // Calculate first year interest and principal if loan exists
                  let firstYearInterest = 0
                  let firstYearPrincipal = 0
                  let annualMortgage = 0
                  
                  if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0) {
                    // Try to use stored monthly mortgage, or calculate it
                    let monthlyPayment = monthlyMortgage
                    if (!monthlyPayment && loanPrincipal > 0 && interestRate > 0 && loanTerm > 0) {
                      const monthlyRate = interestRate / 100 / 12
                      const numPayments = loanTerm * 12
                      if (numPayments > 0 && monthlyRate > 0) {
                        monthlyPayment = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
                      }
                    }
                    
                    if (monthlyPayment > 0) {
                      annualMortgage = monthlyPayment * 12
                      const monthlyRate = interestRate / 100 / 12
                      let balance = loanPrincipal
                      
                      // Calculate first 12 months
                      for (let month = 1; month <= 12; month++) {
                        const interestPayment = balance * monthlyRate
                        const principalPayment = monthlyPayment - interestPayment
                        firstYearInterest += interestPayment
                        firstYearPrincipal += principalPayment > balance ? balance : principalPayment
                        balance = Math.max(0, balance - principalPayment)
                      }
                    } else {
                      // Fallback: use stored annual values if available
                      firstYearInterest = parseFloat(scenario['Annual Interest']?.toString() || '0') || 0
                      firstYearPrincipal = parseFloat(scenario['Annual Principal']?.toString() || '0') || 0
                      annualMortgage = parseFloat(scenario['Annual Mortgage']?.toString() || '0') || 0
                    }
                  }
                  
                  // Total Cash Invested
                  const totalCashInvested = hasLoan 
                    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
                    : purchasePrice + purchaseClosingCosts
                  
                  // GRM (Gross Rent Multiplier)
                  const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0
                  
                  // DSCR (Debt Service Coverage Ratio) - only if loan exists
                  const dscr = hasLoan && annualMortgage > 0 ? noi / annualMortgage : null
                  
                  // LTV (Loan-to-Value) - only if loan exists
                  const ltv = hasLoan && purchasePrice > 0 ? ((purchasePrice - downPaymentAmount) / purchasePrice) * 100 : null
                  
                  // First Year Cash Flow (closing costs are part of initial investment, not an expense)
                  const firstYearNetIncome = hasLoan ? noi - firstYearInterest : noi
                  const firstYearCashFlow = hasLoan 
                    ? firstYearNetIncome - firstYearPrincipal
                    : noi
                  
                  // First Year Cash on Cash Return
                  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0
                  
                  return (
                    <tr key={scenario.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        <Link href={`/apps/property/properties/${propertyId}/scenarios/${scenario.id}`} className="hover:underline text-blue-600">
                          {scenario['Scenario Name'] || 'Unnamed Scenario'}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                        {purchasePrice > 0 ? `$${purchasePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                        {grossIncome > 0 ? `$${grossIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                        ${noi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                        {purchasePrice > 0 && noi >= 0 ? ((noi / purchasePrice) * 100).toFixed(2) + '%' : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
                        ${totalCashInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${firstYearCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${firstYearCashFlow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${firstYearCoCR >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {firstYearCoCR.toFixed(2)}%
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-500">
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
      )}
    </div>
  )
}

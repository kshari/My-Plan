'use client'

import { useState } from 'react'
import LoanForm from '@/components/property/loan-form'
import AmortizationTable from '@/components/property/amortization-table'

interface LoanFormWithTabsProps {
  scenarioId: number
  propertyId: number
  initialData?: any
}

export default function LoanFormWithTabs({
  scenarioId,
  propertyId,
  initialData,
}: LoanFormWithTabsProps) {
  const [activeTab, setActiveTab] = useState<'loan-details' | 'amortization'>('loan-details')
  
  // Extract loan data from initialData for amortization table
  const loanData = initialData || {}

  // Calculate principal from loan data
  const purchasePrice = loanData['Purchase Price']
  const downPaymentAmount = loanData['Down Payment Amount']
  const loanPrincipal = purchasePrice && downPaymentAmount
    ? parseFloat(purchasePrice.toString()) - parseFloat(downPaymentAmount.toString())
    : null

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('loan-details')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'loan-details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Loan Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('amortization')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'amortization'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Amortization Schedule
          </button>
        </nav>
      </div>

      {activeTab === 'loan-details' && (
        <LoanForm
          scenarioId={scenarioId}
          propertyId={propertyId}
          initialData={initialData}
        />
      )}

      {activeTab === 'amortization' && (
        <AmortizationTable
          loanTerm={loanData['Loan Term'] || null}
          principal={loanPrincipal}
          interestRate={loanData['Interest Rate'] ? parseFloat(loanData['Interest Rate'].toString()) : null}
          monthlyPayment={loanData['Monthly Mortgage'] ? parseFloat(loanData['Monthly Mortgage'].toString()) : null}
        />
      )}
    </div>
  )
}

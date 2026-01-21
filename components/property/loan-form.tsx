'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface LoanFormProps {
  scenarioId: number
  propertyId: number
  initialData?: any
}

export default function LoanForm({ scenarioId, propertyId, initialData }: LoanFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loanTerm, setLoanTerm] = useState(initialData?.['Loan Term']?.toString() || '')
  const [downPaymentPercent, setDownPaymentPercent] = useState(initialData?.['Down Payment Percentage']?.toString() || '')
  const [downPaymentAmount, setDownPaymentAmount] = useState(initialData?.['Down Payment Amount']?.toString() || '')
  const [purchasePrice, setPurchasePrice] = useState(initialData?.['Purchase Price']?.toString() || '')
  const [interestRate, setInterestRate] = useState(initialData?.['Interest Rate']?.toString() || '')
  const [monthlyMortgage, setMonthlyMortgage] = useState(initialData?.['Monthly Mortgage']?.toString() || '')
  const [monthlyPrincipal, setMonthlyPrincipal] = useState(initialData?.['Monthly Principle']?.toString() || '')
  const [monthlyInterest, setMonthlyInterest] = useState(initialData?.['Monthly Interest']?.toString() || '')
  const [closingCosts, setClosingCosts] = useState(initialData?.['Closing Costs']?.toString() || '')

  // Calculate down payment amount from percentage
  useEffect(() => {
    if (purchasePrice && downPaymentPercent) {
      const calculated = (parseFloat(purchasePrice) * parseFloat(downPaymentPercent)) / 100
      if (!initialData) {
        setDownPaymentAmount(calculated.toFixed(2))
      }
    }
  }, [purchasePrice, downPaymentPercent])

  // Calculate monthly mortgage payment (simplified calculation)
  useEffect(() => {
    if (purchasePrice && downPaymentAmount && interestRate && loanTerm) {
      const principal = parseFloat(purchasePrice) - parseFloat(downPaymentAmount)
      const monthlyRate = parseFloat(interestRate) / 100 / 12
      const numPayments = parseFloat(loanTerm) * 12

      if (numPayments > 0 && monthlyRate > 0) {
        const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        if (!initialData) {
          setMonthlyMortgage(monthlyPayment.toFixed(2))
        }
      }
    }
  }, [purchasePrice, downPaymentAmount, interestRate, loanTerm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const loanData: any = {
        'Loan Term': loanTerm ? parseInt(loanTerm) : null,
        'Down Payment Percentage': downPaymentPercent ? parseFloat(downPaymentPercent) : null,
        'Down Payment Amount': downPaymentAmount ? parseFloat(downPaymentAmount) : null,
        'Purchase Price': purchasePrice ? parseFloat(purchasePrice) : null,
        'Interest Rate': interestRate ? parseFloat(interestRate) : null,
        'Monthly Mortgage': monthlyMortgage ? parseFloat(monthlyMortgage) : null,
        'Monthly Principle': monthlyPrincipal ? parseFloat(monthlyPrincipal) : null,
        'Monthly Interest': monthlyInterest ? parseFloat(monthlyInterest) : null,
        'Closing Costs': closingCosts ? parseFloat(closingCosts) : null,
        'Annual Mortgage': monthlyMortgage ? parseFloat(monthlyMortgage) * 12 : null,
        'Annual Principal': monthlyPrincipal ? parseFloat(monthlyPrincipal) * 12 : null,
        'Annual Interest': monthlyInterest ? parseFloat(monthlyInterest) * 12 : null,
        'Scanario': scenarioId,
      }

      const { data: existingLoan } = await supabase
        .from('pi_loans')
        .select('id')
        .eq('Scanario', scenarioId)
        .single()

      if (existingLoan) {
        const { error } = await supabase
          .from('pi_loans')
          .update(loanData)
          .eq('id', existingLoan.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pi_loans')
          .insert([loanData])
        
        if (error) throw error
      }

      router.refresh()
      alert('Loan information saved successfully!')
    } catch (error: any) {
      setError(error.message || 'Failed to save loan information')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">
            Purchase Price ($)
          </label>
          <input
            id="purchasePrice"
            type="number"
            min="0"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="loanTerm" className="block text-sm font-medium text-gray-700">
            Loan Term (years)
          </label>
          <input
            id="loanTerm"
            type="number"
            min="1"
            value={loanTerm}
            onChange={(e) => setLoanTerm(e.target.value)}
            placeholder="30"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="downPaymentPercent" className="block text-sm font-medium text-gray-700">
            Down Payment Percentage (%)
          </label>
          <input
            id="downPaymentPercent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={downPaymentPercent}
            onChange={(e) => setDownPaymentPercent(e.target.value)}
            placeholder="20.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="downPaymentAmount" className="block text-sm font-medium text-gray-700">
            Down Payment Amount ($)
          </label>
          <input
            id="downPaymentAmount"
            type="number"
            min="0"
            step="0.01"
            value={downPaymentAmount}
            onChange={(e) => setDownPaymentAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700">
            Interest Rate (%)
          </label>
          <div className="mt-1 space-y-2">
            <input
              type="range"
              id="interestRate"
              min={0}
              max={25}
              step={0.01}
              value={parseFloat(interestRate) || 0}
              onChange={(e) => setInterestRate(parseFloat(e.target.value).toFixed(2))}
              className="w-full"
            />
            <input
              type="number"
              min="0"
              max="25"
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="4.50"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="closingCosts" className="block text-sm font-medium text-gray-700">
            Closing Costs ($)
          </label>
          <input
            id="closingCosts"
            type="number"
            min="0"
            step="0.01"
            value={closingCosts}
            onChange={(e) => setClosingCosts(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="monthlyMortgage" className="block text-sm font-medium text-gray-700">
            Monthly Mortgage Payment ($)
          </label>
          <input
            id="monthlyMortgage"
            type="number"
            step="0.01"
            value={monthlyMortgage}
            onChange={(e) => setMonthlyMortgage(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="monthlyPrincipal" className="block text-sm font-medium text-gray-700">
            Monthly Principal ($)
          </label>
          <input
            id="monthlyPrincipal"
            type="number"
            step="0.01"
            value={monthlyPrincipal}
            onChange={(e) => setMonthlyPrincipal(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="monthlyInterest" className="block text-sm font-medium text-gray-700">
            Monthly Interest ($)
          </label>
          <input
            id="monthlyInterest"
            type="number"
            step="0.01"
            value={monthlyInterest}
            onChange={(e) => setMonthlyInterest(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Loan Information'}
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AmortizationTable from '@/components/property/amortization-table'

interface ScenarioFormProps {
  propertyId: number
  scenarioId?: number
  initialData?: any
  propertyAskingPrice?: number | null
  propertyGrossIncome?: number | null
  propertyOperatingExpenses?: number | null
}

export default function ScenarioForm({ propertyId, scenarioId, initialData, propertyAskingPrice, propertyGrossIncome, propertyOperatingExpenses }: ScenarioFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'amortization'>('details')

  const defaultPurchasePrice = initialData?.['Purchase Price'] || propertyAskingPrice || 0
  const [scenarioName, setScenarioName] = useState(initialData?.['Scenario Name'] || '')
  const [purchasePrice, setPurchasePrice] = useState(defaultPurchasePrice.toString())
  // If editing, use initialData; if creating new, use property values as defaults
  const defaultGrossIncome = initialData?.['Gross Income'] ?? (scenarioId ? null : propertyGrossIncome)
  const defaultOperatingExpenses = initialData?.['Operating Expenses'] ?? (scenarioId ? null : propertyOperatingExpenses)
  const [grossIncome, setGrossIncome] = useState(defaultGrossIncome?.toString() || '')
  const [operatingExpenses, setOperatingExpenses] = useState(defaultOperatingExpenses?.toString() || '')
  const [capRate, setCapRate] = useState(initialData?.['Cap Rate']?.toString() || '')
  // Calculate initial NOI from initial data if available
  const initialGross = parseFloat(initialData?.['Gross Income']?.toString() || '0') || 0
  const initialExpenses = parseFloat(initialData?.['Operating Expenses']?.toString() || '0') || 0
  const initialNOI = initialData ? (initialGross - initialExpenses).toString() : ''
  const [netOperatingIncome, setNetOperatingIncome] = useState(initialNOI)
  const [netIncome, setNetIncome] = useState(initialData?.['Net Income']?.toString() || '')
  const [taxableIncome, setTaxableIncome] = useState(initialData?.['Taxable Income After Depreciation']?.toString() || '')

  // Loan fields
  const [hasLoan, setHasLoan] = useState(initialData?.['Has Loan'] || false)
  const [loanTerm, setLoanTerm] = useState(initialData?.['Loan Term']?.toString() || '')
  const [downPaymentPercent, setDownPaymentPercent] = useState(initialData?.['Down Payment Percentage']?.toString() || '')
  const [downPaymentAmount, setDownPaymentAmount] = useState(initialData?.['Down Payment Amount']?.toString() || '')
  const [interestRate, setInterestRate] = useState(initialData?.['Interest Rate']?.toString() || '')
  const [loanClosingCosts, setLoanClosingCosts] = useState(initialData?.['Closing Costs']?.toString() || '')
  const [purchaseClosingCosts, setPurchaseClosingCosts] = useState(initialData?.['Purchase Closing Costs']?.toString() || '')
  
  // Calculate monthly mortgage payment (used for amortization, not stored as user input)
  const loanPrincipal = purchasePrice && downPaymentAmount ? parseFloat(purchasePrice) - parseFloat(downPaymentAmount) : 0
  const calculatedMonthlyMortgage = hasLoan && loanPrincipal > 0 && interestRate && loanTerm
    ? (() => {
        const monthlyRate = parseFloat(interestRate) / 100 / 12
        const numPayments = parseFloat(loanTerm) * 12
        if (numPayments > 0 && monthlyRate > 0) {
          return loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
        }
        return 0
      })()
    : 0
  
  // Annual increases
  const [incomeIncrease, setIncomeIncrease] = useState(initialData?.['Income Increase']?.toString() || '0')
  const [expensesIncrease, setExpensesIncrease] = useState(initialData?.['Expenses Increase']?.toString() || '0')
  const [propertyValueIncrease, setPropertyValueIncrease] = useState(initialData?.['Property Value Increase']?.toString() || '0')

  // Calculate net operating income (NOI) and net income
  useEffect(() => {
    const gross = parseFloat(grossIncome) || 0
    const expenses = parseFloat(operatingExpenses) || 0
    const noi = gross - expenses // Net Operating Income
    setNetOperatingIncome(noi.toString())
    if (!scenarioId) {
      // Net Income = NOI (if no loan) or calculated from loan (if loan exists)
      if (hasLoan && loanPrincipal > 0 && interestRate && loanTerm) {
        // Calculate first year interest for net income
        const monthlyRate = parseFloat(interestRate) / 100 / 12
        const numPayments = parseFloat(loanTerm) * 12
        if (numPayments > 0 && monthlyRate > 0 && calculatedMonthlyMortgage > 0) {
          let balance = loanPrincipal
          let firstYearInterest = 0
          for (let month = 1; month <= 12 && month <= numPayments; month++) {
            const interestPayment = balance * monthlyRate
            const principalPayment = calculatedMonthlyMortgage - interestPayment
            firstYearInterest += interestPayment
            balance = Math.max(0, balance - principalPayment)
          }
          setNetIncome((noi - firstYearInterest).toString())
        } else {
          setNetIncome(noi.toString())
        }
      } else {
        setNetIncome(noi.toString())
      }
    }
  }, [grossIncome, operatingExpenses, hasLoan, loanPrincipal, interestRate, loanTerm, calculatedMonthlyMortgage, scenarioId])

  // Calculate cap rate (using Net Operating Income, not Net Income)
  useEffect(() => {
    const purchase = parseFloat(purchasePrice) || 0
    const gross = parseFloat(grossIncome) || 0
    const expenses = parseFloat(operatingExpenses) || 0
    const noi = gross - expenses // Cap rate is calculated using NOI
    if (purchase > 0 && noi >= 0) {
      const calculated = purchase > 0 ? (noi / purchase) * 100 : 0
      if (!scenarioId) {
        setCapRate(calculated.toFixed(2))
      }
    }
  }, [purchasePrice, grossIncome, operatingExpenses, scenarioId])

  // Calculate down payment amount from percentage
  useEffect(() => {
    if (purchasePrice && downPaymentPercent) {
      const calculated = (parseFloat(purchasePrice) * parseFloat(downPaymentPercent)) / 100
      if (!initialData) {
        setDownPaymentAmount(calculated.toFixed(2))
      }
    }
  }, [purchasePrice, downPaymentPercent, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const scenarioData: any = {
        'Scenario Name': scenarioName || null,
        'Purchase Price': purchasePrice ? parseFloat(purchasePrice) : null,
        'Gross Income': grossIncome ? parseFloat(grossIncome) : null,
        'Operating Expenses': operatingExpenses ? parseFloat(operatingExpenses) : null,
        'Cap Rate': capRate ? parseFloat(capRate) : null,
        'Net Income': netIncome ? parseFloat(netIncome) : null,
        'Taxable Income After Depreciation': taxableIncome ? parseFloat(taxableIncome) : null,
        'Income Increase': incomeIncrease ? parseFloat(incomeIncrease) : 0,
        'Expenses Increase': expensesIncrease ? parseFloat(expensesIncrease) : 0,
        'Property Value Increase': propertyValueIncrease ? parseFloat(propertyValueIncrease) : 0,
        'Property ID': propertyId,
        'Has Loan': hasLoan,
        'Loan Term': hasLoan && loanTerm ? parseInt(loanTerm) : null,
        'Down Payment Percentage': hasLoan && downPaymentPercent ? parseFloat(downPaymentPercent) : null,
        'Down Payment Amount': hasLoan && downPaymentAmount ? parseFloat(downPaymentAmount) : null,
        'Interest Rate': hasLoan && interestRate ? parseFloat(interestRate) : null,
        'Closing Costs': hasLoan && loanClosingCosts ? parseFloat(loanClosingCosts) : null,
        'Purchase Closing Costs': purchaseClosingCosts ? parseFloat(purchaseClosingCosts) : null,
      }

      if (scenarioId) {
        const { error } = await supabase
          .from('pi_financial_scenarios')
          .update(scenarioData)
          .eq('id', scenarioId)
        
        if (error) throw error
        router.refresh()
        router.push(`/apps/property/properties/${propertyId}/scenarios/${scenarioId}`)
      } else {
        const { data, error } = await supabase
          .from('pi_financial_scenarios')
          .insert([scenarioData])
          .select()
          .single()
        
        if (error) throw error
        router.push(`/apps/property/properties/${propertyId}/scenarios/${data.id}`)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save scenario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Scenario Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('amortization')}
            disabled={!hasLoan || !scenarioId}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'amortization'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } ${(!hasLoan || !scenarioId) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Amortization Schedule
          </button>
        </nav>
      </div>

      {activeTab === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="scenarioName" className="block text-sm font-medium text-gray-700">
              Scenario Name
            </label>
            <input
              id="scenarioName"
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., Base Case, Optimistic, Conservative"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700">
                Purchase Price ($)
                {propertyAskingPrice && (
                  <span className="text-sm text-gray-500 ml-2">(Asking: ${propertyAskingPrice.toLocaleString()})</span>
                )}
              </label>
              <div className="mt-1 space-y-2">
                <input
                  type="range"
                  id="purchasePrice"
                  min={0}
                  max={propertyAskingPrice ? propertyAskingPrice * 2 : 10000000}
                  step={1000}
                  value={parseFloat(purchasePrice) || 0}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="0.00"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grossIncome" className="block text-sm font-medium text-gray-700">
                Gross Income ($)
              </label>
              <input
                id="grossIncome"
                type="number"
                min="0"
                step="0.01"
                value={grossIncome}
                onChange={(e) => setGrossIncome(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="operatingExpenses" className="block text-sm font-medium text-gray-700">
                Operating Expenses ($)
              </label>
              <input
                id="operatingExpenses"
                type="number"
                min="0"
                step="0.01"
                value={operatingExpenses}
                onChange={(e) => setOperatingExpenses(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="netOperatingIncome" className="block text-sm font-medium text-gray-700">
                Net Operating Income (NOI) ($)
              </label>
              <input
                id="netOperatingIncome"
                type="number"
                step="0.01"
                value={netOperatingIncome}
                onChange={(e) => {
                  const noi = parseFloat(e.target.value) || 0
                  setNetOperatingIncome(e.target.value)
                  if (!scenarioId) {
                    if (hasLoan && loanPrincipal > 0 && interestRate && loanTerm) {
                      // Calculate first year interest for net income
                      const monthlyRate = parseFloat(interestRate) / 100 / 12
                      const numPayments = parseFloat(loanTerm) * 12
                      if (numPayments > 0 && monthlyRate > 0 && calculatedMonthlyMortgage > 0) {
                        let balance = loanPrincipal
                        let firstYearInterest = 0
                        for (let month = 1; month <= 12 && month <= numPayments; month++) {
                          const interestPayment = balance * monthlyRate
                          const principalPayment = calculatedMonthlyMortgage - interestPayment
                          firstYearInterest += interestPayment
                          balance = Math.max(0, balance - principalPayment)
                        }
                        setNetIncome((noi - firstYearInterest).toString())
                      } else {
                        setNetIncome(noi.toString())
                      }
                    } else {
                      setNetIncome(noi.toString())
                    }
                  }
                }}
                placeholder="0.00"
                readOnly={!scenarioId}
                className={`mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 ${!scenarioId ? 'bg-gray-100' : ''}`}
              />
            </div>

            <div>
              <label htmlFor="netIncome" className="block text-sm font-medium text-gray-700">
                Net Income ($)
              </label>
              <input
                id="netIncome"
                type="number"
                step="0.01"
                value={netIncome}
                onChange={(e) => setNetIncome(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="capRate" className="block text-sm font-medium text-gray-700">
                Cap Rate (%)
              </label>
              <input
                id="capRate"
                type="number"
                step="0.01"
                value={capRate}
                onChange={(e) => setCapRate(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="taxableIncome" className="block text-sm font-medium text-gray-700">
                Taxable Income After Depreciation ($)
              </label>
              <input
                id="taxableIncome"
                type="number"
                step="0.01"
                value={taxableIncome}
                onChange={(e) => setTaxableIncome(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Purchase Closing Costs Section */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Purchase Closing Costs</h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div>
                <label htmlFor="purchaseClosingCosts" className="block text-sm font-medium text-gray-700">
                  Purchase Closing Costs ($)
                </label>
                <input
                  id="purchaseClosingCosts"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchaseClosingCosts}
                  onChange={(e) => setPurchaseClosingCosts(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Annual Increases Section */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Annual Increases</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="incomeIncrease" className="block text-sm font-medium text-gray-700">
                  Income Increase (%)
                </label>
                <input
                  id="incomeIncrease"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={incomeIncrease}
                  onChange={(e) => setIncomeIncrease(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="expensesIncrease" className="block text-sm font-medium text-gray-700">
                  Expenses Increase (%)
                </label>
                <input
                  id="expensesIncrease"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={expensesIncrease}
                  onChange={(e) => setExpensesIncrease(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="propertyValueIncrease" className="block text-sm font-medium text-gray-700">
                  Property Value Increase (%)
                </label>
                <input
                  id="propertyValueIncrease"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={propertyValueIncrease}
                  onChange={(e) => setPropertyValueIncrease(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Loan Section */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center space-x-2">
              <input
                id="hasLoan"
                type="checkbox"
                checked={hasLoan}
                onChange={(e) => setHasLoan(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="hasLoan" className="text-base font-medium text-gray-700 cursor-pointer">
                Include Loan Information
              </label>
            </div>

            {hasLoan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-gray-200">
                <div>
                  <label htmlFor="loanTerm" className="block text-sm font-medium text-gray-700">
                    Loan Term (years)
                  </label>
                  <input
                    id="loanTerm"
                    type="number"
                    min="1"
                    max="50"
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
                  <label htmlFor="loanClosingCosts" className="block text-sm font-medium text-gray-700">
                    Loan Closing Costs ($)
                  </label>
                  <input
                    id="loanClosingCosts"
                    type="number"
                    min="0"
                    step="0.01"
                    value={loanClosingCosts}
                    onChange={(e) => setLoanClosingCosts(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            {scenarioId && (
              <button
                type="button"
                onClick={() => router.push(`/apps/property/properties/${propertyId}/scenarios/${scenarioId}`)}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : scenarioId ? 'Update Scenario' : 'Create Scenario'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'amortization' && scenarioId && hasLoan && (
        <AmortizationTable
          loanTerm={loanTerm ? parseInt(loanTerm) : null}
          principal={loanPrincipal > 0 ? loanPrincipal : null}
          interestRate={interestRate ? parseFloat(interestRate) : null}
          monthlyPayment={calculatedMonthlyMortgage > 0 ? calculatedMonthlyMortgage : null}
        />
      )}
    </div>
  )
}

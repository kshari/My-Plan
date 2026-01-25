'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CompoundingTabProps {
  planId: number
}

interface Account {
  account_name: string
  balance: number
  account_type?: string
}

interface CompoundingProjection {
  year: number
  age: number
  totalValue: number
  growth: number
  cumulativeGrowth: number
}

export default function CompoundingTab({ planId }: CompoundingTabProps) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [projections, setProjections] = useState<CompoundingProjection[]>([])
  const [currentAge, setCurrentAge] = useState(50)
  
  // Input parameters
  const [startAge, setStartAge] = useState(50)
  const [endAge, setEndAge] = useState(100)
  const [annualGrowthRate, setAnnualGrowthRate] = useState(0.1)
  const [annualContribution, setAnnualContribution] = useState(0)

  useEffect(() => {
    loadPlanAndAccounts()
  }, [planId])

  useEffect(() => {
    calculateProjections()
  }, [accounts, startAge, endAge, annualGrowthRate, annualContribution, currentAge])

  const loadPlanAndAccounts = async () => {
    setLoading(true)
    try {
      // Load plan to get birth year and calculate current age
      const { data: planData, error: planError } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year')
        .eq('id', planId)
        .single()

      if (planData && planData.birth_year) {
        const currentYear = new Date().getFullYear()
        const age = currentYear - planData.birth_year
        setCurrentAge(age)
        setStartAge(age) // Set default start age to current age
      }

      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('rp_accounts')
        .select('account_name, balance, account_type')
        .eq('plan_id', planId)

      if (accountsError) throw accountsError
      setAccounts(accountsData || [])
    } catch (error) {
      console.error('Error loading plan and accounts:', error)
    } finally {
      setLoading(false)
    }
  }


  const calculateProjections = () => {
    const totalStartingBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
    
    if (totalStartingBalance === 0 && annualContribution === 0) {
      setProjections([])
      return
    }

    const newProjections: CompoundingProjection[] = []
    let currentValue = totalStartingBalance
    let cumulativeGrowth = 0

    for (let age = startAge; age <= endAge; age++) {
      const year = age - startAge + 1
      
      // Add annual contribution at the beginning of the year
      currentValue += annualContribution
      
      // Calculate growth for the year
      const growth = currentValue * annualGrowthRate
      currentValue += growth
      cumulativeGrowth += growth

      newProjections.push({
        year,
        age,
        totalValue: currentValue,
        growth,
        cumulativeGrowth,
      })
    }

    setProjections(newProjections)
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading accounts...</div>
  }

  const totalStartingBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const finalValue = projections.length > 0 ? projections[projections.length - 1].totalValue : 0
  const totalGrowth = finalValue - totalStartingBalance - (annualContribution * (endAge - startAge + 1))
  const totalContributions = annualContribution * (endAge - startAge + 1)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Compounding Calculator</h3>
        <p className="text-sm text-gray-600 mb-4">
          Visualize how your retirement accounts grow over time with the power of compounding. 
          This tool uses your current account balances and shows projected growth.
        </p>
      </div>

      {/* Input Parameters */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h4 className="font-medium text-gray-900 mb-4">Parameters</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Age</label>
            <input
              type="number"
              value={startAge}
              onChange={(e) => setStartAge(parseInt(e.target.value) || 50)}
              min={0}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Age</label>
            <input
              type="number"
              value={endAge}
              onChange={(e) => setEndAge(parseInt(e.target.value) || 70)}
              min={startAge}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Annual Growth Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={annualGrowthRate * 100}
              onChange={(e) => setAnnualGrowthRate((parseFloat(e.target.value) || 0) / 100)}
              min={0}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Annual Contribution ($)</label>
            <input
              type="number"
              step="100"
              value={annualContribution}
              onChange={(e) => setAnnualContribution(parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Current Accounts Summary */}
      {accounts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="font-medium text-gray-900 mb-3">Current Account Balances</h4>
          <div className="space-y-2">
            {accounts.map((account, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600">{account.account_name}</span>
                <span className="font-medium">${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold">
              <span>Total Starting Balance</span>
              <span>${totalStartingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      {projections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">Starting Balance</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totalStartingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">Total Contributions</div>
            <div className="text-2xl font-bold text-gray-900">
              ${totalContributions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">Total Growth</div>
            <div className="text-2xl font-bold text-green-600">
              ${totalGrowth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="text-sm text-blue-600">Final Value (Age {endAge})</div>
            <div className="text-2xl font-bold text-blue-900">
              ${finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* Projections Table */}
      {projections.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">Year-by-Year Projection</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Starting Value</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contribution</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Growth</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ending Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {projections.map((proj, index) => {
                  const previousValue = index > 0 ? projections[index - 1].totalValue : totalStartingBalance
                  const startingValue = previousValue + annualContribution
                  
                  return (
                    <tr key={proj.year} className={index % 5 === 0 ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-3 text-sm">{proj.year}</td>
                      <td className="px-4 py-3 text-sm font-medium">{proj.age}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        ${startingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {annualContribution > 0 ? `$${annualContribution.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">
                        ${proj.growth.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-blue-900">
                        ${proj.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalStartingBalance === 0 && annualContribution === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">
            Add accounts to see compounding projections, or enter an annual contribution amount.
          </p>
        </div>
      )}
    </div>
  )
}

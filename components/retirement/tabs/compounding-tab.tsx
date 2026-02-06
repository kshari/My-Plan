'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'

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
  const { selectedScenarioId } = useScenario()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [projections, setProjections] = useState<CompoundingProjection[]>([])
  const [currentAge, setCurrentAge] = useState(50)
  
  // Input parameters
  const [startAge, setStartAge] = useState(50)
  const [retirementAge, setRetirementAge] = useState(65) // Changed from endAge
  const [annualGrowthRate, setAnnualGrowthRate] = useState(0.1)
  const [annualContribution, setAnnualContribution] = useState(0)
  const [currentSavings, setCurrentSavings] = useState(0) // New field for current savings
  const [inflationRate, setInflationRate] = useState(0.04) // Inflation rate (default 4%)
  const [increaseContributionsForInflation, setIncreaseContributionsForInflation] = useState(false) // Checkbox for inflation adjustment

  useEffect(() => {
    loadPlanAndAccounts()
  }, [planId, selectedScenarioId])

  useEffect(() => {
    calculateProjections()
  }, [currentSavings, startAge, retirementAge, annualGrowthRate, annualContribution, currentAge, inflationRate, increaseContributionsForInflation])

  const loadPlanAndAccounts = async () => {
    setLoading(true)
    try {
      // Load plan to get birth year and calculate current age
      const { data: planData, error: planError } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year')
        .eq('id', planId)
        .single()

      let calculatedCurrentAge = 50
      if (planData && planData.birth_year) {
        const currentYear = new Date().getFullYear()
        calculatedCurrentAge = currentYear - planData.birth_year
        setCurrentAge(calculatedCurrentAge)
        setStartAge(calculatedCurrentAge) // Set default start age to current age
      }

      // Load accounts to pre-populate current savings and annual contributions
      const { data: accountsData, error: accountsError } = await supabase
        .from('rp_accounts')
        .select('account_name, balance, account_type, annual_contribution')
        .eq('plan_id', planId)

      if (accountsError) throw accountsError
      setAccounts(accountsData || [])
      
      // Pre-populate current savings from account balances
      const totalSavings = (accountsData || []).reduce((sum, acc) => sum + (acc.balance || 0), 0)
      setCurrentSavings(totalSavings)
      
      // Pre-populate annual contribution from account annual_contribution values
      const totalAnnualContribution = (accountsData || []).reduce((sum, acc) => sum + (acc.annual_contribution || 0), 0)
      setAnnualContribution(totalAnnualContribution)

      // Load scenario settings to get retirement age, growth rate, and inflation rate
      if (selectedScenarioId) {
        const { data: settingsData, error: settingsError } = await supabase
          .from('rp_calculator_settings')
          .select('retirement_age, growth_rate_before_retirement, inflation_rate')
          .eq('scenario_id', selectedScenarioId)
          .single()

        if (!settingsError && settingsData) {
          // Pre-populate retirement age from scenario settings
          if (settingsData.retirement_age) {
            setRetirementAge(settingsData.retirement_age)
          }
          
          // Pre-populate growth rate from scenario settings
          if (settingsData.growth_rate_before_retirement) {
            setAnnualGrowthRate(parseFloat(settingsData.growth_rate_before_retirement.toString()))
          }
          
          // Pre-populate inflation rate from scenario settings
          if (settingsData.inflation_rate) {
            setInflationRate(parseFloat(settingsData.inflation_rate.toString()))
          }
        }
      } else {
        // If no scenario selected, try to get default retirement age from plan basis
        // Default to 65 if not available
        setRetirementAge(65)
      }
    } catch (error) {
      console.error('Error loading plan and accounts:', error)
    } finally {
      setLoading(false)
    }
  }


  const calculateProjections = () => {
    // Use currentSavings instead of calculating from accounts
    const totalStartingBalance = currentSavings
    
    if (totalStartingBalance === 0 && annualContribution === 0) {
      setProjections([])
      return
    }

    const newProjections: CompoundingProjection[] = []
    let currentValue = totalStartingBalance
    let cumulativeGrowth = 0

    // Project from startAge to retirementAge (not endAge)
    for (let age = startAge; age <= retirementAge; age++) {
      const year = age - startAge + 1
      
      // Calculate contribution for this year (with inflation adjustment if enabled)
      let contributionForYear = annualContribution
      if (increaseContributionsForInflation && year > 1) {
        // Apply inflation: contribution increases by inflation rate each year
        // Year 1: base contribution
        // Year 2: base * (1 + inflation)
        // Year 3: base * (1 + inflation)^2
        const yearsOfInflation = year - 1
        contributionForYear = annualContribution * Math.pow(1 + inflationRate, yearsOfInflation)
      }
      
      // Add annual contribution at the beginning of the year
      currentValue += contributionForYear
      
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

  const totalStartingBalance = currentSavings
  const finalValue = projections.length > 0 ? projections[projections.length - 1].totalValue : 0
  const yearsToRetirement = Math.max(0, retirementAge - startAge + 1)
  
  // Calculate total contributions (accounting for inflation if enabled)
  let totalContributions = 0
  if (increaseContributionsForInflation) {
    // Sum contributions with inflation: base * (1 + inflation)^(year - 1)
    for (let year = 1; year <= yearsToRetirement; year++) {
      const contributionForYear = annualContribution * Math.pow(1 + inflationRate, year - 1)
      totalContributions += contributionForYear
    }
  } else {
    totalContributions = annualContribution * yearsToRetirement
  }
  
  const totalGrowth = finalValue - totalStartingBalance - totalContributions

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Savings ($)</label>
            <input
              type="number"
              step="1000"
              value={currentSavings}
              onChange={(e) => setCurrentSavings(parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Pre-populated from accounts</p>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Retirement Start Age</label>
            <input
              type="number"
              value={retirementAge}
              onChange={(e) => setRetirementAge(parseInt(e.target.value) || 65)}
              min={startAge}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Pre-populated from scenario</p>
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
            <p className="text-xs text-gray-500 mt-1">Pre-populated from scenario</p>
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
            <p className="text-xs text-gray-500 mt-1">Pre-populated from accounts</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-300">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Inflation Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={inflationRate * 100}
              onChange={(e) => setInflationRate((parseFloat(e.target.value) || 0) / 100)}
              min={0}
              max={100}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <p className="text-xs text-gray-500 mt-1">Pre-populated from scenario</p>
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={increaseContributionsForInflation}
                onChange={(e) => setIncreaseContributionsForInflation(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Increase contributions for inflation</span>
            </label>
          </div>
        </div>
      </div>

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
            <div className="text-sm text-blue-600">Final Value (Age {retirementAge})</div>
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
                  
                  // Calculate contribution for this year (with inflation adjustment if enabled)
                  let contributionForYear = annualContribution
                  if (increaseContributionsForInflation && proj.year > 1) {
                    const yearsOfInflation = proj.year - 1
                    contributionForYear = annualContribution * Math.pow(1 + inflationRate, yearsOfInflation)
                  }
                  
                  const startingValue = previousValue + contributionForYear
                  
                  return (
                    <tr key={proj.year} className={index % 5 === 0 ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-3 text-sm">{proj.year}</td>
                      <td className="px-4 py-3 text-sm font-medium">{proj.age}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        ${startingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {contributionForYear > 0 ? `$${contributionForYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
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
            Enter current savings and/or annual contribution to see compounding projections.
          </p>
        </div>
      )}
    </div>
  )
}

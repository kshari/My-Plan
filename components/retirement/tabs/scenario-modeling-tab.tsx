'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  type Account,
  type Expense,
  type OtherIncome,
} from '@/lib/utils/retirement-projections'

interface ScenarioModelingTabProps {
  planId: number
}

// Color palette for growth rate lines (3% to 15%)
const GROWTH_RATE_COLORS = [
  '#991b1b', // 3% - dark red
  '#dc2626', // 4% - red
  '#ef4444', // 5% - light red
  '#f97316', // 6% - orange
  '#f59e0b', // 7% - amber
  '#eab308', // 8% - yellow
  '#84cc16', // 9% - lime
  '#22c55e', // 10% - green
  '#14b8a6', // 11% - teal
  '#06b6d4', // 12% - cyan
  '#3b82f6', // 13% - blue
  '#8b5cf6', // 14% - violet
  '#a855f7', // 15% - purple
]

export default function ScenarioModelingTab({ planId }: ScenarioModelingTabProps) {
  const supabase = createClient()
  const { selectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [modelType, setModelType] = useState<'networth' | 'monthly_income'>('networth')
  const [modelingData, setModelingData] = useState<any[]>([])
  const [planData, setPlanData] = useState<any>(null)
  const [currentAge, setCurrentAge] = useState<number>(50)
  const [lifeExpectancy, setLifeExpectancy] = useState<number>(90)
  
  // Growth rate range
  const minGrowthRate = 3
  const maxGrowthRate = 15
  const growthRates = Array.from({ length: maxGrowthRate - minGrowthRate + 1 }, (_, i) => minGrowthRate + i)

  useEffect(() => {
    loadModelingData()
  }, [planId, selectedScenarioId])

  const loadModelingData = async () => {
    setLoading(true)
    try {
      // Load plan data
      const { data: plan } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year, life_expectancy, include_spouse, spouse_birth_year, spouse_life_expectancy, filing_status')
        .eq('id', planId)
        .single()

      if (!plan?.birth_year) {
        setLoading(false)
        return
      }

      setPlanData(plan)
      const currentYear = new Date().getFullYear()
      const calcCurrentAge = currentYear - plan.birth_year
      setCurrentAge(calcCurrentAge)
      setLifeExpectancy(plan.life_expectancy || 90)

      // Load accounts, expenses, other income
      const [accountsResult, expensesResult, incomeResult, settingsResult] = await Promise.all([
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        selectedScenarioId 
          ? supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single()
          : Promise.resolve({ data: null }),
      ])

      const accounts: Account[] = (accountsResult.data || []).map(acc => ({
        id: acc.id,
        account_name: acc.account_name,
        owner: acc.owner || '',
        balance: acc.balance || 0,
        account_type: acc.account_type,
        annual_contribution: acc.annual_contribution || 0,
      }))

      const expenses: Expense[] = (expensesResult.data || []).map(exp => ({
        id: exp.id,
        expense_name: exp.expense_name,
        amount_after_65: exp.amount_after_65 || 0,
        amount_before_65: exp.amount_before_65 || 0,
      }))

      const otherIncome: OtherIncome[] = (incomeResult.data || []).map(inc => ({
        id: inc.id,
        income_name: inc.income_source || '',
        amount: inc.annual_amount || 0,
        start_year: inc.start_year || undefined,
        end_year: inc.end_year || undefined,
        inflation_adjusted: inc.inflation_adjusted || false,
      }))

      // Generate data for each retirement age and growth rate combination
      const data: any[] = []
      
      // X-axis: from current age + 1 to 65
      const maxRetirementAge = 65
      for (let retirementAge = calcCurrentAge + 1; retirementAge <= maxRetirementAge; retirementAge++) {
        const dataPoint: any = { retirementAge }
        
        for (const growthRate of growthRates) {
          const yearsToRetirement = retirementAge - calcCurrentAge
          const annualExpenses = expenses.reduce((sum, exp) => {
            const amount = retirementAge >= 65 ? exp.amount_after_65 : exp.amount_before_65
            return sum + (amount || 0)
          }, 0) * 12

          // Build settings with varied growth rate
          const settings = buildCalculatorSettings(
            {
              ...settingsResult.data,
              retirement_age: retirementAge,
              growth_rate_before_retirement: growthRate / 100,
              growth_rate_during_retirement: (growthRate * 0.7) / 100, // During retirement is typically lower
            },
            plan,
            currentYear,
            retirementAge,
            yearsToRetirement,
            annualExpenses
          )
          settings.withdrawal_priority = 'default'
          settings.withdrawal_secondary_priority = 'tax_optimization'

          try {
            const projections = calculateRetirementProjections(
              plan.birth_year,
              accounts,
              expenses,
              otherIncome,
              settings,
              plan.life_expectancy || 90,
              plan.spouse_birth_year || undefined,
              plan.spouse_life_expectancy || undefined,
              true,
              plan.include_spouse || false
            )

            // Get ending networth (networth at life expectancy)
            const endingNetworth = projections[projections.length - 1]?.networth || 0
            dataPoint[`networth_${growthRate}`] = Math.max(0, endingNetworth)
            
            // Calculate monthly income using 4% withdrawal strategy
            // Get networth at retirement age
            const retirementProjection = projections.find(p => p.age === retirementAge)
            const networthAtRetirement = retirementProjection?.networth || 0
            // 4% annual withdrawal divided by 12 months
            const monthlyIncome = (networthAtRetirement * 0.04) / 12
            dataPoint[`income_${growthRate}`] = Math.max(0, monthlyIncome)
          } catch (error) {
            console.error(`Error calculating for retirement age ${retirementAge}, growth ${growthRate}:`, error)
            dataPoint[`networth_${growthRate}`] = 0
            dataPoint[`income_${growthRate}`] = 0
          }
        }
        
        data.push(dataPoint)
      }

      setModelingData(data)
    } catch (error) {
      console.error('Error loading modeling data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`
    }
    return `$${value.toFixed(0)}`
  }

  const renderChart = () => {
    if (modelingData.length === 0) return null

    const chartProps = {
      data: modelingData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    }

    const dataKeyPrefix = modelType === 'networth' ? 'networth' : 'income'
    
    const renderLines = () => (
      growthRates.map((rate, index) => {
        if (graphType === 'line') {
          return (
            <Line
              key={rate}
              type="monotone"
              dataKey={`${dataKeyPrefix}_${rate}`}
              name={`${rate}%`}
              stroke={GROWTH_RATE_COLORS[index]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )
        } else if (graphType === 'area') {
          return (
            <Area
              key={rate}
              type="monotone"
              dataKey={`${dataKeyPrefix}_${rate}`}
              name={`${rate}%`}
              stroke={GROWTH_RATE_COLORS[index]}
              fill={GROWTH_RATE_COLORS[index]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          )
        } else {
          return (
            <Bar
              key={rate}
              dataKey={`${dataKeyPrefix}_${rate}`}
              name={`${rate}%`}
              fill={GROWTH_RATE_COLORS[index]}
              stackId="growth"
            />
          )
        }
      })
    )

    const commonAxisProps = {
      tickFormatter: formatCurrency,
      tick: { fontSize: 12 },
    }
    
    const yAxisLabel = modelType === 'networth' 
      ? `Networth at ${lifeExpectancy} years age`
      : 'Monthly Income (4% Rule)'
    
    const tooltipSortRegex = modelType === 'networth' ? /networth_/ : /income_/
    
    const renderTooltipContent = ({ active, payload, label }: any) => {
      if (!active || !payload) return null
      // Sort payload by growth rate descending (15% to 3%)
      const sortedPayload = [...payload].sort((a, b) => {
        const rateA = parseInt(a.dataKey?.toString().replace(tooltipSortRegex, '') || '0')
        const rateB = parseInt(b.dataKey?.toString().replace(tooltipSortRegex, '') || '0')
        return rateB - rateA
      })
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-gray-900 mb-2">Retirement Start Age: {label}</p>
          <div className="space-y-1">
            {sortedPayload.map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600">{entry.name}:</span>
                <span className="font-medium">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    const renderLegendContent = (props: any) => {
      const { payload } = props
      if (!payload) return null
      
      // Sort payload by growth rate ascending (3% to 15%)
      const sortedPayload = [...payload].sort((a: any, b: any) => {
        const rateA = parseInt(a.dataKey?.toString().replace(tooltipSortRegex, '') || '0')
        const rateB = parseInt(b.dataKey?.toString().replace(tooltipSortRegex, '') || '0')
        return rateA - rateB
      })
      
      return (
        <ul className="flex flex-wrap justify-center gap-4 mt-4">
          {sortedPayload.map((entry: any, index: number) => (
            <li key={`item-${index}`} className="flex items-center gap-2 text-sm">
              <span 
                className="inline-block w-3 h-3 rounded" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.value || entry.name}</span>
            </li>
          ))}
        </ul>
      )
    }

    if (graphType === 'line') {
      return (
        <LineChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="retirementAge"
            label={{ value: 'Retirement Start Age', position: 'insideBottom', offset: -10, fontSize: 12, fontWeight: 'bold' }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            {...commonAxisProps}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 12, fontWeight: 'bold' }}
            width={100}
          />
          <RechartsTooltip content={renderTooltipContent} />
          <Legend 
            content={renderLegendContent}
          />
          {renderLines()}
        </LineChart>
      )
    } else if (graphType === 'area') {
      return (
        <AreaChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="retirementAge"
            label={{ value: 'Retirement Start Age', position: 'insideBottom', offset: -10, fontSize: 12, fontWeight: 'bold' }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            {...commonAxisProps}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 12, fontWeight: 'bold' }}
            width={100}
          />
          <RechartsTooltip content={renderTooltipContent} />
          <Legend 
            content={renderLegendContent}
          />
          {renderLines()}
        </AreaChart>
      )
    } else {
      return (
        <BarChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="retirementAge"
            label={{ value: 'Retirement Start Age', position: 'insideBottom', offset: -10, fontSize: 12, fontWeight: 'bold' }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            {...commonAxisProps}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', fontSize: 12, fontWeight: 'bold' }}
            width={100}
          />
          <RechartsTooltip content={renderTooltipContent} />
          <Legend 
            content={renderLegendContent}
          />
          {renderLines()}
        </BarChart>
      )
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        Calculating scenario models...
      </div>
    )
  }

  if (!planData?.birth_year) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please set your birth year in Plan Summary to use Scenario Modeling.
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Scenario Modeling</h2>
        <p className="text-sm text-gray-600">
          {modelType === 'networth' 
            ? 'Visualize how different retirement ages and growth rates affect your ending networth.'
            : 'Visualize how different retirement ages and growth rates affect your potential monthly income using the 4% withdrawal rule.'
          }
          {' '}Each line represents a different annual growth rate (3% to 15%).
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Model Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Model:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setModelType('networth')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                modelType === 'networth'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Ending Networth
            </button>
            <button
              onClick={() => setModelType('monthly_income')}
              className={`px-4 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                modelType === 'monthly_income'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Monthly Income
            </button>
          </div>
        </div>

        {/* Graph Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Graph Type:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setGraphType('line')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                graphType === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setGraphType('area')}
              className={`px-4 py-1.5 text-sm font-medium border-x border-gray-300 transition-colors ${
                graphType === 'area'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setGraphType('bar')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                graphType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Bar
            </button>
          </div>
        </div>

        <button
          onClick={loadModelingData}
          className="flex items-center gap-2 rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
        >
          Refresh Data
        </button>

        <div className="text-sm text-gray-500">
          Current Age: <span className="font-medium">{currentAge}</span> | 
          Life Expectancy: <span className="font-medium">{lifeExpectancy}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {modelingData.length > 0 ? (
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No data available. Please ensure you have accounts and expenses configured.
          </div>
        )}
      </div>

      {/* Legend explanation */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">How to Read This Chart</h4>
        {modelType === 'networth' ? (
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>X-Axis (Retirement Start Age):</strong> Shows different retirement ages from your current age to 65</li>
            <li>• <strong>Y-Axis (Networth at Life Expectancy):</strong> Shows your projected networth at {lifeExpectancy} years age</li>
            <li>• <strong>Colored Lines:</strong> Each line represents a different annual growth rate assumption (3% to 15%)</li>
            <li>• <strong>Higher Growth = Higher Networth:</strong> Notice how higher growth rates (purple/violet) result in higher ending networth</li>
            <li>• <strong>Optimal Retirement Age:</strong> Find where your ending networth meets your goals</li>
          </ul>
        ) : (
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>X-Axis (Retirement Start Age):</strong> Shows different retirement ages from your current age to 65</li>
            <li>• <strong>Y-Axis (Monthly Income):</strong> Shows your potential monthly income based on the 4% withdrawal rule</li>
            <li>• <strong>4% Withdrawal Rule:</strong> A widely-used guideline suggesting you can safely withdraw 4% of your portfolio annually in retirement</li>
            <li>• <strong>Calculation:</strong> Monthly Income = (Portfolio Value at Retirement × 4%) ÷ 12 months</li>
            <li>• <strong>Colored Lines:</strong> Each line represents a different annual growth rate assumption (3% to 15%)</li>
            <li>• <strong>Higher Growth = Higher Income:</strong> Better investment returns lead to a larger portfolio and higher sustainable monthly income</li>
            <li>• <strong>Planning Tip:</strong> Compare these values against your expected monthly expenses to ensure retirement sustainability</li>
          </ul>
        )}
      </div>

    </div>
  )
}

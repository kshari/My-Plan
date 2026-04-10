'use client'

import { useState, useEffect, useMemo } from 'react'
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
import { BarChart2, Table2 } from 'lucide-react'
import {
  calculateRetirementProjections,
  buildCalculatorSettings,
  calculateEstimatedSSA,
  type Account,
  type Expense,
  type OtherIncome,
} from '@/lib/utils/retirement-projections'
import { ssaClaimingMultiplier } from '@/lib/constants/ssa-constants'
import {
  DEFAULT_RETIREMENT_AGE,
  DEFAULT_LIFE_EXPECTANCY,
  DEFAULT_INFLATION_RATE,
  DEFAULT_INFLATION_RATE_PCT,
  DEFAULT_SSA_ANNUAL_BENEFIT,
  DEFAULT_SPOUSE_SSA_BENEFIT,
  SAFE_WITHDRAWAL_RATE,
} from '@/lib/constants/retirement-defaults'
import { LoadingState } from '@/components/ui/loading-state'
import { formatCurrencyShort as formatCurrency } from '@/lib/utils/formatting'

interface ScenarioModelingTabProps {
  planId: number
  /** Start with this model type instead of the default 'networth'. */
  initialModelType?: 'networth' | 'monthly_income'
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

export default function ScenarioModelingTab({ planId, initialModelType }: ScenarioModelingTabProps) {
  const supabase = createClient()
  const { selectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [graphType, setGraphType] = useState<'line' | 'area' | 'bar'>('line')
  const [modelType, setModelType] = useState<'networth' | 'monthly_income'>(initialModelType ?? 'networth')
  const [modelingData, setModelingData] = useState<any[]>([])
  const [planData, setPlanData] = useState<any>(null)
  const [currentAge, setCurrentAge] = useState<number>(50)
  const [lifeExpectancy, setLifeExpectancy] = useState<number>(90)
  const [settingsData, setSettingsData] = useState<any>(null)
  const [estimatedSSAIncome, setEstimatedSSAIncome] = useState<number | null>(null)
  const [estimatedSpouseSSAIncome, setEstimatedSpouseSSAIncome] = useState<number | null>(null)
  const [refMonthlyExpenses, setRefMonthlyExpenses] = useState<number>(0)
  
  // Growth rate range
  const minGrowthRate = 3
  const maxGrowthRate = 15
  const growthRates = Array.from({ length: maxGrowthRate - minGrowthRate + 1 }, (_, i) => minGrowthRate + i)

  useEffect(() => {
    loadModelingData()
  }, [planId, selectedScenarioId])

  const loadModelingData = async () => {
    setLoading(true)
    setEstimatedSSAIncome(null) // Reset SSA income estimate
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
      setLifeExpectancy(plan.life_expectancy || DEFAULT_LIFE_EXPECTANCY)

      // Load accounts, expenses, other income
      const [accountsResult, expensesResult, incomeResult, settingsResult] = await Promise.all([
        supabase.from('rp_accounts').select('*').eq('plan_id', planId),
        supabase.from('rp_expenses').select('*').eq('plan_id', planId),
        supabase.from('rp_other_income').select('*').eq('plan_id', planId),
        selectedScenarioId 
          ? supabase.from('rp_calculator_settings').select('*').eq('scenario_id', selectedScenarioId).single()
          : Promise.resolve({ data: null }),
      ])

      // Store settings for assumptions display
      setSettingsData(settingsResult.data)

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
      
      // Calculate estimated SSA amounts at start age
      const includePlannerSsa = settingsResult.data?.planner_ssa_income !== undefined ? settingsResult.data.planner_ssa_income : true
      
      // Automatically include spouse SSA if:
      // 1. User explicitly set it to true, OR
      // 2. Plan includes spouse (include_spouse = true), OR
      // 3. Filing status is "Married Filing Jointly"
      // This ensures realistic projections for married couples
      const explicitSpouseSsa = (settingsResult.data?.spouse_ssa_income !== undefined ? settingsResult.data.spouse_ssa_income : false)
      const hasSpouse = plan.include_spouse || false
      const isMarriedFilingJointly = plan.filing_status === 'Married Filing Jointly'
      const includeSpouseSsa = explicitSpouseSsa || hasSpouse || isMarriedFilingJointly
      
      const baseEstimatedPlannerSsa = includePlannerSsa
        ? (settingsResult.data?.planner_ssa_annual_benefit != null
            ? Number(settingsResult.data.planner_ssa_annual_benefit)
            : (settingsResult.data?.estimated_ssa_annual_income > 0
                ? calculateEstimatedSSA(Number(settingsResult.data.estimated_ssa_annual_income), true)
                : DEFAULT_SSA_ANNUAL_BENEFIT))
        : 0
      const baseEstimatedSpouseSsa = includeSpouseSsa
        ? (settingsResult.data?.spouse_ssa_annual_benefit != null
            ? Number(settingsResult.data.spouse_ssa_annual_benefit)
            : (settingsResult.data?.estimated_ssa_annual_income > 0
                ? calculateEstimatedSSA(Number(settingsResult.data.estimated_ssa_annual_income), false)
                : DEFAULT_SPOUSE_SSA_BENEFIT))
        : 0
      
      const ssaStartAge = settingsResult.data?.ssa_start_age || settingsResult.data?.retirement_age || DEFAULT_RETIREMENT_AGE
      // Use the same current_year the projection engine uses (may be stored in DB, else real year)
      const projectionCurrentYear = settingsResult.data?.current_year || currentYear
      const projectionCurrentAge = projectionCurrentYear - plan.birth_year
      const yearsToSsaStart = Math.max(0, ssaStartAge - projectionCurrentAge)
      const inflationRate = parseFloat(settingsResult.data?.inflation_rate?.toString() || String(DEFAULT_INFLATION_RATE))
      const inflationToSsaStart = Math.pow(1 + inflationRate, yearsToSsaStart)
      // Apply early-claiming reduction (permanent reduction when claiming before FRA 67)
      const claimingMultiplier = ssaClaimingMultiplier(ssaStartAge)

      // Values passed to the engine: inflation-adjusted only (engine applies claiming multiplier itself)
      const estimatedPlannerSsaAtStart = includePlannerSsa ? baseEstimatedPlannerSsa * inflationToSsaStart : undefined
      const estimatedSpouseSsaAtStart = includeSpouseSsa ? baseEstimatedSpouseSsa * inflationToSsaStart : undefined

      // Display values: inflation-adjusted AND claiming multiplier applied (matching snapshot tooltip formula)
      setEstimatedSSAIncome(estimatedPlannerSsaAtStart != null ? estimatedPlannerSsaAtStart * claimingMultiplier : null)
      setEstimatedSpouseSSAIncome(estimatedSpouseSsaAtStart != null ? estimatedSpouseSsaAtStart * claimingMultiplier : null)
      
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
              growth_rate_during_retirement: growthRate / 100, // Use same growth rate for before and during retirement
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
              plan.life_expectancy || DEFAULT_LIFE_EXPECTANCY,
              plan.spouse_birth_year || undefined,
              plan.spouse_life_expectancy || undefined,
              includePlannerSsa,
              includeSpouseSsa,
              estimatedPlannerSsaAtStart,
              estimatedSpouseSsaAtStart
            )

            // Get ending networth (networth at life expectancy)
            const endingNetworth = projections[projections.length - 1]?.networth || 0
            dataPoint[`networth_${growthRate}`] = Math.max(0, endingNetworth)
            
            // Calculate monthly income using 4% withdrawal strategy
            // Get networth at retirement age
            const retirementProj = projections.find(p => p.age === retirementAge)
            const networthAtRetirement = retirementProj?.networth || 0
            // 4% annual withdrawal divided by 12 months
            const monthlyIncome = (networthAtRetirement * SAFE_WITHDRAWAL_RATE) / 12
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

      // Compute reference monthly expenses at age 65 (before_65 side) for threshold coloring
      const refAnnual = expenses.reduce((sum, exp) => sum + (exp.amount_before_65 || 0), 0) * 12
      setRefMonthlyExpenses(refAnnual / 12)
    } catch (error) {
      console.error('Error loading modeling data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Table view ────────────────────────────────────────────────────────────
  const tablePrefix = modelType === 'networth' ? 'networth' : 'income'

  // Absolute risk-band thresholds based on the plan's own monthly expenses.
  // Networth bands: multiples of annual expenses remaining at life expectancy.
  // Income bands: fraction of monthly expenses covered by 4%-rule income.
  const RISK_BANDS = useMemo(() => {
    const annualExp = refMonthlyExpenses * 12
    if (modelType === 'networth') {
      return [
        { label: 'At Risk',       cls: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',            max: 0 },
        { label: 'Caution',       cls: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400', max: annualExp * 3 },
        { label: 'Near Expected', cls: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-500',     max: annualExp * 8 },
        { label: 'Safe',          cls: 'bg-lime-100 dark:bg-lime-950/40 text-lime-700 dark:text-lime-600',         max: annualExp * 15 },
        { label: 'Excellent',     cls: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400', max: Infinity },
      ]
    } else {
      const mo = refMonthlyExpenses
      return [
        { label: 'At Risk',       cls: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400',            max: mo * 0.6 },
        { label: 'Caution',       cls: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400', max: mo * 0.9 },
        { label: 'Near Expected', cls: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-500',     max: mo * 1.1 },
        { label: 'Safe',          cls: 'bg-lime-100 dark:bg-lime-950/40 text-lime-700 dark:text-lime-600',         max: mo * 1.5 },
        { label: 'Excellent',     cls: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400', max: Infinity },
      ]
    }
  }, [modelType, refMonthlyExpenses])

  const riskBandFor = (value: number) => {
    // Fall back to neutral if no expense reference is set
    if (refMonthlyExpenses === 0) return { label: '', cls: 'bg-muted/20 text-foreground' }
    for (const band of RISK_BANDS) {
      if (value <= band.max) return band
    }
    return RISK_BANDS[RISK_BANDS.length - 1]
  }

  const renderTable = () => {
    if (modelingData.length === 0) return null
    const annualExp = refMonthlyExpenses * 12
    const mo = refMonthlyExpenses
    const thresholds = modelType === 'networth'
      ? [
          { label: 'At Risk',       note: `NW ≤ $0` },
          { label: 'Caution',       note: `$0 – ${formatCurrency(annualExp * 3)} (< 3 yrs expenses)` },
          { label: 'Near Expected', note: `${formatCurrency(annualExp * 3)} – ${formatCurrency(annualExp * 8)}` },
          { label: 'Safe',          note: `${formatCurrency(annualExp * 8)} – ${formatCurrency(annualExp * 15)}` },
          { label: 'Excellent',     note: `> ${formatCurrency(annualExp * 15)} (> 15 yrs expenses)` },
        ]
      : [
          { label: 'At Risk',       note: `< ${formatCurrency(mo * 0.6)}/mo (< 60% of expenses)` },
          { label: 'Caution',       note: `${formatCurrency(mo * 0.6)} – ${formatCurrency(mo * 0.9)}/mo` },
          { label: 'Near Expected', note: `${formatCurrency(mo * 0.9)} – ${formatCurrency(mo * 1.1)}/mo` },
          { label: 'Safe',          note: `${formatCurrency(mo * 1.1)} – ${formatCurrency(mo * 1.5)}/mo` },
          { label: 'Excellent',     note: `> ${formatCurrency(mo * 1.5)}/mo (> 150% of expenses)` },
        ]
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap sticky left-0 bg-muted/60 z-10">
                Retire Age
              </th>
              {growthRates.map((rate, i) => (
                <th
                  key={rate}
                  className="px-3 py-2.5 text-center font-semibold whitespace-nowrap"
                  style={{ color: GROWTH_RATE_COLORS[i] }}
                >
                  {rate}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelingData.map((row, rowIdx) => (
              <tr
                key={row.retirementAge}
                className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-muted/10'}`}
              >
                <td className="px-4 py-2 font-medium text-foreground sticky left-0 bg-background z-10 border-r border-border/30">
                  {row.retirementAge}
                </td>
                {growthRates.map((rate, i) => {
                  const val = row[`${tablePrefix}_${rate}`] as number
                  const band = riskBandFor(val)
                  return (
                    <td
                      key={rate}
                      className={`px-3 py-2 text-center tabular-nums font-medium ${band.cls}`}
                      title={band.label}
                    >
                      {formatCurrency(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-muted/20 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            {modelType === 'networth' ? 'Thresholds based on your annual expenses' : 'Thresholds based on your monthly expenses'}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {thresholds.map((t, i) => (
              <div key={t.label} className="flex items-center gap-1.5 text-[11px]">
                <span className={`inline-block w-2.5 h-2.5 rounded-sm ${RISK_BANDS[i]?.cls.split(' ')[0]}`} />
                <span className="font-medium">{t.label}:</span>
                <span className="text-muted-foreground">{t.note}</span>
              </div>
            ))}
          </div>
          {refMonthlyExpenses === 0 && (
            <p className="text-[11px] text-amber-600">Add expenses in Plan Details to enable risk-band coloring.</p>
          )}
        </div>
      </div>
    )
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
              // Removed stackId to show bars side-by-side, each starting from 0
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
    return <LoadingState message="Calculating scenario models…" />
  }

  if (!planData?.birth_year) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please set your birth year in Plan Setup to use Scenario Modeling.
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
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Model Type Selector */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setModelType('networth')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              modelType === 'networth'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Ending Networth
          </button>
          <button
            onClick={() => setModelType('monthly_income')}
            className={`px-3 py-1.5 text-sm font-medium border-l border-border transition-colors ${
              modelType === 'monthly_income'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            Monthly Income
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('chart')}
            title="Chart view"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'chart'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            title="Table view"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-l border-border transition-colors ${
              viewMode === 'table'
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            Table
          </button>
        </div>

        {/* Graph Type Selector — only visible in chart mode */}
        {viewMode === 'chart' && (
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['line', 'area', 'bar'] as const).map((type, idx) => (
              <button
                key={type}
                onClick={() => setGraphType(type)}
                className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${idx > 0 ? 'border-l border-border' : ''} ${
                  graphType === type
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={loadModelingData}
          className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Refresh Data
        </button>

        <div className="text-sm text-gray-500">
          Current Age: <span className="font-medium">{currentAge}</span> | 
          Life Expectancy: <span className="font-medium">{lifeExpectancy}</span>
        </div>
      </div>

      {/* Chart / Table */}
      <div className="rounded-lg border border-border bg-card p-4">
        {modelingData.length > 0 ? (
          viewMode === 'chart' ? (
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          ) : (
            renderTable()
          )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
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

      {/* Assumptions */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Key Assumptions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">Inflation Rate:</span>{' '}
            <span className="text-gray-600">
              {settingsData?.inflation_rate ? `${(parseFloat(settingsData.inflation_rate.toString()) * 100).toFixed(2)}%` : `${DEFAULT_INFLATION_RATE_PCT.toFixed(2)}% (default)`}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Growth Rate (Before Retirement):</span>{' '}
            <span className="text-gray-600">3% to 15% (varies by line)</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Growth Rate (During Retirement):</span>{' '}
            <span className="text-gray-600">Same as before-retirement rate (3% to 15%, varies by line)</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Social Security Income:</span>{' '}
            <span className="text-gray-600">
              {settingsData?.planner_ssa_income !== false ? 'Included' : 'Not included'}
              {planData?.include_spouse && settingsData?.spouse_ssa_income !== false ? ' (Planner + Spouse)' : ''}
              {settingsData?.ssa_start_age ? ` starting at age ${settingsData.ssa_start_age}` : ` starting at retirement age ${settingsData?.retirement_age || DEFAULT_RETIREMENT_AGE} (default)`}
              {(() => {
                const planner = estimatedSSAIncome ?? 0
                const spouse = estimatedSpouseSSAIncome ?? 0
                const combined = planner + spouse
                if (combined <= 0) return null
                if (planner > 0 && spouse > 0) {
                  return (
                    <> - Estimated: ${combined.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year (Planner: ${planner.toLocaleString(undefined, { maximumFractionDigits: 0 })} + Spouse: ${spouse.toLocaleString(undefined, { maximumFractionDigits: 0 })})</>
                  )
                }
                return <> - Estimated: ${combined.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year</>
              })()}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Filing Status:</span>{' '}
            <span className="text-gray-600">
              {planData?.filing_status || (planData?.include_spouse ? 'Married Filing Jointly' : 'Single')}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Life Expectancy:</span>{' '}
            <span className="text-gray-600">{lifeExpectancy} years</span>
          </div>
          {modelType === 'monthly_income' && (
            <div className="md:col-span-2">
              <span className="font-medium text-gray-700">Withdrawal Strategy:</span>{' '}
              <span className="text-gray-600">4% Rule - Annual withdrawal of 4% of portfolio value at retirement</span>
            </div>
          )}
          <div className="md:col-span-2">
            <span className="font-medium text-gray-700">Tax Calculation:</span>{' '}
            <span className="text-gray-600">Uses progressive IRS tax brackets (2024 rates) for income tax and capital gains tax</span>
          </div>
          <div className="md:col-span-2">
            <span className="font-medium text-gray-700">Expenses:</span>{' '}
            <span className="text-gray-600">Based on your configured expenses, adjusted for inflation each year</span>
          </div>
          <div className="md:col-span-2">
            <span className="font-medium text-gray-700">Accounts:</span>{' '}
            <span className="text-gray-600">Uses your current account balances and contributions</span>
          </div>
        </div>
      </div>

    </div>
  )
}

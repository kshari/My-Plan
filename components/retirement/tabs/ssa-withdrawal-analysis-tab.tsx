'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useScenario } from '../scenario-context'
import { calculateEstimatedSSA } from '@/lib/utils/retirement-projections'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts'
import { Info, TrendingUp, TrendingDown, Calculator, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/property/ui/tooltip'

interface SSAWithdrawalAnalysisTabProps {
  planId: number
}

interface SSAAnalysisResult {
  startAge: number
  monthlyBenefit: number
  annualBenefit: number
  lifetimeTotal: number
  breakEvenAge: number
  yearsToBreakEven: number
  totalValueAtLifeExpectancy: number
  benefitsGainLoss: number
  netValue: number
  recommendation: string
  benefitsGainLossCalculation?: {
    yearsEarly?: number
    yearsDelayed?: number
    earlyBenefitsWithInvestment?: number
    fraLifetimeTotal?: number
    lostBenefitsInvested?: number
    investmentReturnRate: number
    earlyBenefitsBreakdown?: Array<{ year: number; benefit: number; yearsToInvest: number; investedValue: number }>
    fraBenefitsBreakdown?: Array<{ year: number; benefit: number }>
    lostBenefitsBreakdown?: Array<{ year: number; benefit: number; yearsToInvest: number; investedValue: number }>
  }
}

interface Demographics {
  gender?: 'Male' | 'Female'
  education?: 'High School' | 'Some College' | 'Bachelor' | 'Graduate'
  income?: 'Low' | 'Medium' | 'High'
  health?: 'Poor' | 'Average' | 'Good' | 'Excellent'
  smoking?: boolean
  exercise?: 'None' | 'Light' | 'Moderate' | 'Heavy'
}

// Life expectancy adjustments based on demographics (in years)
function calculateAdjustedLifeExpectancy(
  baseLifeExpectancy: number,
  demographics: Demographics
): number {
  let adjustment = 0

  // Gender adjustment
  if (demographics.gender === 'Female') {
    adjustment += 5 // Women live ~5 years longer on average
  } else if (demographics.gender === 'Male') {
    adjustment -= 2 // Men live ~2 years less on average
  }

  // Education adjustment
  if (demographics.education === 'Graduate') {
    adjustment += 3
  } else if (demographics.education === 'Bachelor') {
    adjustment += 2
  } else if (demographics.education === 'Some College') {
    adjustment += 1
  } else if (demographics.education === 'High School') {
    adjustment -= 1
  }

  // Income adjustment
  if (demographics.income === 'High') {
    adjustment += 2
  } else if (demographics.income === 'Low') {
    adjustment -= 2
  }

  // Health adjustment
  if (demographics.health === 'Excellent') {
    adjustment += 4
  } else if (demographics.health === 'Good') {
    adjustment += 2
  } else if (demographics.health === 'Average') {
    adjustment += 0
  } else if (demographics.health === 'Poor') {
    adjustment -= 3
  }

  // Smoking adjustment
  if (demographics.smoking) {
    adjustment -= 5
  }

  // Exercise adjustment
  if (demographics.exercise === 'Heavy') {
    adjustment += 3
  } else if (demographics.exercise === 'Moderate') {
    adjustment += 2
  } else if (demographics.exercise === 'Light') {
    adjustment += 1
  } else if (demographics.exercise === 'None') {
    adjustment -= 1
  }

  return Math.max(65, Math.min(100, baseLifeExpectancy + adjustment))
}

export default function SSAWithdrawalAnalysisTab({ planId }: SSAWithdrawalAnalysisTabProps) {
  const supabase = createClient()
  const { selectedScenarioId } = useScenario()
  const [loading, setLoading] = useState(false)
  const [planData, setPlanData] = useState<any>(null)
  const [currentAge, setCurrentAge] = useState(50)
  const [estimatedAnnualIncome, setEstimatedAnnualIncome] = useState<number | null>(null)
  const [baseLifeExpectancy, setBaseLifeExpectancy] = useState(85)
  const [useCustomLifeExpectancy, setUseCustomLifeExpectancy] = useState(false)
  const [demographics, setDemographics] = useState<Demographics>({})
  const [investmentReturns, setInvestmentReturns] = useState(0.05) // Default 5%
  const [analysisResults, setAnalysisResults] = useState<SSAAnalysisResult[]>([])
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    loadPlanData()
  }, [planId, selectedScenarioId])

  useEffect(() => {
    if (planData && estimatedAnnualIncome !== null) {
      calculateAnalysis()
    }
  }, [planData, estimatedAnnualIncome, baseLifeExpectancy, useCustomLifeExpectancy, demographics])

  const loadPlanData = async () => {
    setLoading(true)
    try {
      const { data: plan } = await supabase
        .from('rp_retirement_plans')
        .select('birth_year, life_expectancy, filing_status, include_spouse')
        .eq('id', planId)
        .single()

      if (plan) {
        setPlanData(plan)
        const currentYear = new Date().getFullYear()
        const age = currentYear - plan.birth_year
        setCurrentAge(age)
        setBaseLifeExpectancy(plan.life_expectancy || 85)

        // Try to get estimated income from settings
        if (selectedScenarioId) {
          const { data: settings } = await supabase
            .from('rp_calculator_settings')
            .select('*')
            .eq('scenario_id', selectedScenarioId)
            .single()

          // Estimate income from SSA calculation (reverse engineer)
          // Use a reasonable default if not available
          if (settings) {
            // Try to estimate from SSA if available
            const estimatedSSA = calculateEstimatedSSA(0, true)
            // Rough estimate: if SSA is $20k, income might be around $50k
            // This is a simplified estimate
            setEstimatedAnnualIncome(estimatedSSA * 2.5)
          } else {
            setEstimatedAnnualIncome(50000) // Default estimate
          }
        } else {
          setEstimatedAnnualIncome(50000) // Default estimate
        }
      }
    } catch (error) {
      console.error('Error loading plan data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAnalysis = () => {
    if (!planData || estimatedAnnualIncome === null) return

    const currentYear = new Date().getFullYear()
    const birthYear = planData.birth_year
    const fullRetirementAge = 67 // Full retirement age for most people
    const inflationRate = 0.03 // 3% annual inflation
    const investmentReturnRate = investmentReturns // Use user-specified investment returns

    // Calculate adjusted life expectancy
    const lifeExpectancy = useCustomLifeExpectancy
      ? calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics)
      : baseLifeExpectancy

    // Calculate base SSA benefit at full retirement age
    const baseSSA = calculateEstimatedSSA(estimatedAnnualIncome, true)
    const baseMonthlySSA = baseSSA / 12

    const results: SSAAnalysisResult[] = []

    // Analyze ages 62-70
    for (let startAge = 62; startAge <= 70; startAge++) {
      // Calculate reduction/increase based on start age
      let monthlyBenefit = baseMonthlySSA
      let annualBenefit = baseSSA

      if (startAge < fullRetirementAge) {
        // Early retirement reduction: ~6.67% per year early (max 30% at age 62)
        const yearsEarly = fullRetirementAge - startAge
        const reduction = Math.min(0.30, yearsEarly * 0.0667)
        monthlyBenefit = baseMonthlySSA * (1 - reduction)
        annualBenefit = baseSSA * (1 - reduction)
      } else if (startAge > fullRetirementAge) {
        // Delayed retirement credit: ~8% per year delayed (max 24% at age 70)
        const yearsDelayed = startAge - fullRetirementAge
        const increase = Math.min(0.24, yearsDelayed * 0.08)
        monthlyBenefit = baseMonthlySSA * (1 + increase)
        annualBenefit = baseSSA * (1 + increase)
      }

      // Calculate lifetime total (with inflation)
      // Benefits are received from startAge to lifeExpectancy (inclusive)
      // So if startAge = 62 and lifeExpectancy = 85, that's 24 years (ages 62-85)
      const yearsOfBenefits = Math.max(0, lifeExpectancy - startAge + 1)
      let lifetimeTotal = 0

      for (let year = 0; year < yearsOfBenefits; year++) {
        const inflationMultiplier = Math.pow(1 + inflationRate, year)
        const annualBenefitInflated = annualBenefit * inflationMultiplier
        lifetimeTotal += annualBenefitInflated
      }
      
      // Calculate total value at life expectancy (with investment growth for early benefits)
      let totalValueAtLifeExpectancy = 0
      if (startAge < fullRetirementAge) {
        // Early benefits can be invested until FRA
        const yearsToFRA = fullRetirementAge - startAge
        for (let year = 0; year < yearsOfBenefits; year++) {
          const inflationMultiplier = Math.pow(1 + inflationRate, year)
          const annualBenefitInflated = annualBenefit * inflationMultiplier
          
          if (year < yearsToFRA) {
            // Can invest for remaining years until FRA
            const remainingYears = yearsToFRA - year
            const investmentGrowth = Math.pow(1 + investmentReturnRate, remainingYears)
            totalValueAtLifeExpectancy += annualBenefitInflated * investmentGrowth
          } else {
            totalValueAtLifeExpectancy += annualBenefitInflated
          }
        }
      } else {
        totalValueAtLifeExpectancy = lifetimeTotal
      }

      // Calculate break-even age (compared to starting at full retirement age)
      const fraMonthlyBenefit = baseMonthlySSA
      const fraAnnualBenefit = baseSSA
      let breakEvenAge = lifeExpectancy + 1 // Default to beyond life expectancy
      let cumulativeEarly = 0
      let cumulativeFRA = 0

      if (startAge < fullRetirementAge) {
        // Early start: when does FRA start catch up?
        for (let age = startAge; age <= lifeExpectancy; age++) {
          const yearsSinceStart = age - startAge
          const yearsSinceFRA = Math.max(0, age - fullRetirementAge)
          
          // Calculate cumulative with inflation
          cumulativeEarly = 0
          cumulativeFRA = 0
          
          for (let y = 0; y <= yearsSinceStart; y++) {
            cumulativeEarly += annualBenefit * Math.pow(1 + inflationRate, y)
          }
          
          for (let y = 0; y <= yearsSinceFRA; y++) {
            cumulativeFRA += fraAnnualBenefit * Math.pow(1 + inflationRate, y)
          }

          if (cumulativeFRA >= cumulativeEarly && breakEvenAge > lifeExpectancy) {
            breakEvenAge = age
            break
          }
        }
      } else if (startAge > fullRetirementAge) {
        // Delayed start: when does FRA start catch up?
        for (let age = fullRetirementAge; age <= lifeExpectancy; age++) {
          const yearsSinceFRA = age - fullRetirementAge
          const yearsSinceDelayed = Math.max(0, age - startAge)
          
          // Calculate cumulative with inflation
          cumulativeFRA = 0
          cumulativeEarly = 0
          
          for (let y = 0; y <= yearsSinceFRA; y++) {
            cumulativeFRA += fraAnnualBenefit * Math.pow(1 + inflationRate, y)
          }
          
          for (let y = 0; y <= yearsSinceDelayed; y++) {
            cumulativeEarly += annualBenefit * Math.pow(1 + inflationRate, y)
          }

          if (cumulativeEarly >= cumulativeFRA && breakEvenAge > lifeExpectancy) {
            breakEvenAge = age
            break
          }
        }
      } else {
        // Starting at FRA - no break-even needed
        breakEvenAge = fullRetirementAge
      }

      const yearsToBreakEven = breakEvenAge > startAge ? breakEvenAge - startAge : 0

      // Benefits Gain/Loss calculation
      let benefitsGainLoss = 0
      let benefitsGainLossCalculation: any = { investmentReturnRate }
      
      if (startAge < fullRetirementAge) {
        // Before FRA: Calculate if early start with investment returns beats FRA lifetime total
        const yearsEarly = fullRetirementAge - startAge
        
        // Calculate early benefits with investment returns until FRA, then continue to life expectancy
        let earlyBenefitsWithInvestment = 0
        const earlyBenefitsBreakdown: Array<{ year: number; benefit: number; yearsToInvest: number; investedValue: number }> = []
        
        // Early benefits from startAge to FRA (invested)
        for (let year = 0; year < yearsEarly; year++) {
          const benefitThisYear = annualBenefit * Math.pow(1 + inflationRate, year)
          const yearsToInvest = yearsEarly - year
          const investedValue = benefitThisYear * Math.pow(1 + investmentReturnRate, yearsToInvest)
          earlyBenefitsWithInvestment += investedValue
          earlyBenefitsBreakdown.push({
            year: startAge + year,
            benefit: benefitThisYear,
            yearsToInvest,
            investedValue
          })
        }
        
        // Continue early benefits from FRA to life expectancy (not invested, just received)
        for (let year = yearsEarly; year < yearsOfBenefits; year++) {
          const benefitThisYear = annualBenefit * Math.pow(1 + inflationRate, year)
          earlyBenefitsWithInvestment += benefitThisYear
        }
        
        // Calculate FRA lifetime total (from FRA to life expectancy, not from startAge)
        // FRA benefits start at age 67 and go to life expectancy
        const fraYearsOfBenefits = Math.max(0, lifeExpectancy - fullRetirementAge + 1)
        const fraBenefitsBreakdown: Array<{ year: number; benefit: number }> = []
        let fraLifetimeTotal = 0
        for (let year = 0; year < fraYearsOfBenefits; year++) {
          const benefitThisYear = fraAnnualBenefit * Math.pow(1 + inflationRate, year)
          fraLifetimeTotal += benefitThisYear
          if (year < yearsEarly) {
            fraBenefitsBreakdown.push({
              year: fullRetirementAge + year,
              benefit: benefitThisYear
            })
          }
        }
        
        // Benefits Gain/Loss = Early benefits with investment - FRA lifetime total
        benefitsGainLoss = earlyBenefitsWithInvestment - fraLifetimeTotal
        benefitsGainLossCalculation = {
          yearsEarly,
          earlyBenefitsWithInvestment,
          fraLifetimeTotal,
          investmentReturnRate,
          earlyBenefitsBreakdown,
          fraBenefitsBreakdown
        }
      } else if (startAge > fullRetirementAge) {
        // After FRA: Lost benefits are a loss
        const yearsDelayed = startAge - fullRetirementAge
        let lostBenefitsInvested = 0
        const lostBenefitsBreakdown: Array<{ year: number; benefit: number; yearsToInvest: number; investedValue: number }> = []
        for (let year = 0; year < yearsDelayed; year++) {
          const benefitThisYear = fraAnnualBenefit * Math.pow(1 + inflationRate, year)
          const yearsToInvest = yearsDelayed - year
          const investedValue = benefitThisYear * Math.pow(1 + investmentReturnRate, yearsToInvest)
          lostBenefitsInvested += investedValue
          lostBenefitsBreakdown.push({
            year: fullRetirementAge + year,
            benefit: benefitThisYear,
            yearsToInvest,
            investedValue
          })
        }
        benefitsGainLoss = -lostBenefitsInvested // Negative because it's a loss
        benefitsGainLossCalculation = {
          yearsDelayed,
          lostBenefitsInvested,
          investmentReturnRate,
          lostBenefitsBreakdown
        }
      }

      // Calculate net value: lifetime total + benefits gain/loss
      const netValue = lifetimeTotal + benefitsGainLoss

      // Generate recommendation based on net value
      let recommendation = ''
      if (startAge < fullRetirementAge) {
        if (netValue > lifetimeTotal * 0.95) {
          recommendation = `Starting early provides immediate income and may be beneficial if you need the money now or don't expect to live significantly past ${breakEvenAge.toFixed(0)}. The benefits gain/loss is relatively favorable.`
        } else if (lifeExpectancy < breakEvenAge) {
          recommendation = `Starting early may be beneficial if you don't expect to live past ${breakEvenAge.toFixed(0)}. However, consider the benefits gain/loss compared to starting at FRA.`
        } else {
          recommendation = `Starting early provides immediate income but results in lower net value after considering benefits gain/loss. Consider waiting if you expect to live past ${breakEvenAge.toFixed(0)}.`
        }
      } else if (startAge > fullRetirementAge) {
        if (netValue > lifetimeTotal * 0.98) {
          recommendation = `Delaying provides significantly higher net value. This is especially beneficial if you expect to live past ${breakEvenAge.toFixed(0)} and can afford to wait.`
        } else if (lifeExpectancy > breakEvenAge + 5) {
          recommendation = `Delaying provides higher lifetime benefits and net value if you expect to live past ${breakEvenAge.toFixed(0)}. The lost benefits are offset by higher future benefits.`
        } else {
          recommendation = `Delaying increases benefits but consider the lost benefits from waiting. May not be worth it if you don't expect to live significantly past ${breakEvenAge.toFixed(0)}.`
        }
      } else {
        recommendation = 'Starting at full retirement age provides standard benefits with no reduction or increase. This is a balanced approach.'
      }

      results.push({
        startAge,
        monthlyBenefit,
        annualBenefit,
        lifetimeTotal,
        breakEvenAge,
        yearsToBreakEven,
        totalValueAtLifeExpectancy,
        benefitsGainLoss,
        netValue,
        recommendation,
        benefitsGainLossCalculation,
      })
    }

    setAnalysisResults(results)

    // Create chart data showing cumulative benefits over time
    const chartData: any[] = []
    for (let age = 62; age <= lifeExpectancy; age++) {
      const point: any = { age }
      const values: { [key: string]: number } = {}
      
      results.forEach(result => {
        if (age >= result.startAge) {
          // Calculate net value at this age (lifetime total up to this age + benefits gain/loss up to this age)
          const yearsSinceStart = age - result.startAge
          let cumulativeBenefits = 0
          
          // Sum all benefits from start age to current age with inflation
          for (let year = 0; year <= yearsSinceStart; year++) {
            const inflationMultiplier = Math.pow(1 + inflationRate, year)
            const annualBenefitInflated = result.annualBenefit * inflationMultiplier
            cumulativeBenefits += annualBenefitInflated
          }
          
          // Calculate benefits gain/loss up to this specific age (not proportional)
          let benefitsGainLossAtAge = 0
          
          if (result.startAge < fullRetirementAge) {
            // Early start: Calculate actual gain/loss up to this age
            if (age < fullRetirementAge) {
              // Before FRA: Calculate invested early benefits vs what FRA would have given (but FRA hasn't started)
              // At this point, we only have early benefits with investment returns
              let earlyBenefitsInvestedUpToAge = 0
              for (let year = 0; year <= yearsSinceStart; year++) {
                const benefitThisYear = result.annualBenefit * Math.pow(1 + inflationRate, year)
                const yearsToInvest = (fullRetirementAge - result.startAge) - year
                if (yearsToInvest > 0) {
                  earlyBenefitsInvestedUpToAge += benefitThisYear * Math.pow(1 + investmentReturnRate, yearsToInvest)
                } else {
                  earlyBenefitsInvestedUpToAge += benefitThisYear
                }
              }
              // FRA hasn't started yet, so no comparison - gain/loss is 0 until FRA
              benefitsGainLossAtAge = 0
            } else {
              // At or after FRA: Calculate actual comparison
              // Early benefits with investment (from startAge to FRA, invested) + benefits from FRA to current age
              let earlyBenefitsWithInvestmentUpToAge = 0
              const yearsEarly = fullRetirementAge - result.startAge
              
              // Early benefits from startAge to FRA (invested)
              for (let year = 0; year < yearsEarly; year++) {
                const benefitThisYear = result.annualBenefit * Math.pow(1 + inflationRate, year)
                const yearsToInvest = yearsEarly - year
                earlyBenefitsWithInvestmentUpToAge += benefitThisYear * Math.pow(1 + investmentReturnRate, yearsToInvest)
              }
              
              // Continue early benefits from FRA to current age
              for (let year = yearsEarly; year <= yearsSinceStart; year++) {
                const benefitThisYear = result.annualBenefit * Math.pow(1 + inflationRate, year)
                earlyBenefitsWithInvestmentUpToAge += benefitThisYear
              }
              
              // FRA benefits from FRA to current age
              let fraBenefitsUpToAge = 0
              const yearsSinceFRA = age - fullRetirementAge
              const fraAnnualBenefit = baseSSA // FRA annual benefit
              for (let year = 0; year <= yearsSinceFRA; year++) {
                const benefitThisYear = fraAnnualBenefit * Math.pow(1 + inflationRate, year)
                fraBenefitsUpToAge += benefitThisYear
              }
              
              benefitsGainLossAtAge = earlyBenefitsWithInvestmentUpToAge - fraBenefitsUpToAge
            }
          } else if (result.startAge > fullRetirementAge) {
            // Delayed start: Lost benefits are a loss
            if (age < result.startAge) {
              // Before delayed start: Calculate lost benefits with investment
              let lostBenefitsInvestedUpToAge = 0
              const yearsDelayed = result.startAge - fullRetirementAge
              const yearsSinceFRA = age - fullRetirementAge
              const fraAnnualBenefit = baseSSA // FRA annual benefit
              
              for (let year = 0; year <= yearsSinceFRA; year++) {
                const benefitThisYear = fraAnnualBenefit * Math.pow(1 + inflationRate, year)
                const yearsToInvest = yearsDelayed - year
                if (yearsToInvest > 0) {
                  lostBenefitsInvestedUpToAge += benefitThisYear * Math.pow(1 + investmentReturnRate, yearsToInvest)
                }
              }
              benefitsGainLossAtAge = -lostBenefitsInvestedUpToAge
            } else {
              // At or after delayed start: Use full benefits gain/loss (it's all realized by now)
              benefitsGainLossAtAge = result.benefitsGainLoss
            }
          } else {
            // Starting at FRA: No benefits gain/loss
            benefitsGainLossAtAge = 0
          }
          
          // Show only cumulative benefits (lifetime total up to this age)
          point[`Age ${result.startAge}`] = cumulativeBenefits
          values[`Age ${result.startAge}`] = cumulativeBenefits
        } else {
          point[`Age ${result.startAge}`] = 0
          values[`Age ${result.startAge}`] = 0
        }
      })
      
      // Detect crossover points - when a line moves to the top position
      const activeLines = Object.keys(values).filter(key => values[key] > 0)
      if (activeLines.length > 1 && age > 62) {
        // Find the line with the highest value at current age
        let topLineKey: string | null = null
        let topValue = -1
        activeLines.forEach(lineKey => {
          if (values[lineKey] > topValue) {
            topValue = values[lineKey]
            topLineKey = lineKey
          }
        })
        
        // Compare with previous age to detect if a different line is now on top
        const prevPoint = chartData[chartData.length - 1]
        if (prevPoint && topLineKey) {
          // Find the top line from previous age
          let prevTopLineKey: string | null = null
          let prevTopValue = -1
          activeLines.forEach(lineKey => {
            const prevValue = prevPoint[lineKey] || 0
            if (prevValue > prevTopValue) {
              prevTopValue = prevValue
              prevTopLineKey = lineKey
            }
          })
          
          // If a different line is now on top, mark it as a crossover point
          if (prevTopLineKey && topLineKey !== prevTopLineKey) {
            point[`${topLineKey}_crossover`] = true
          }
        }
      }
      
      chartData.push(point)
    }
    setChartData(chartData)
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-600">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        Loading plan data...
      </div>
    )
  }

  if (!planData) {
    return (
      <div className="text-center py-8 text-gray-500">
        Please configure your plan profile to use Social Security analysis.
      </div>
    )
  }

  const bestOption = analysisResults.reduce((best, current) => {
    if (!best) return current
    // Prefer option with highest net value
    if (current.netValue > best.netValue) {
      return current
    }
    return best
  }, analysisResults[0])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Social Security Withdrawal Analysis
        </h2>
        <p className="text-sm text-gray-600">
          Analyze the impact of starting Social Security benefits at different ages (62-70). 
          Compare lifetime benefits, break-even points, and benefits gain/loss.
        </p>
      </div>

      {/* Input Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Annual Income (for SSA calculation)
            </label>
            <input
              type="number"
              value={estimatedAnnualIncome || ''}
              onChange={(e) => setEstimatedAnnualIncome(parseFloat(e.target.value) || null)}
              min="0"
              step="1000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used to estimate your Social Security benefit amount
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investment Returns (%)
            </label>
            <input
              type="number"
              value={(investmentReturns * 100).toFixed(2)}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0
                setInvestmentReturns(value / 100)
              }}
              min="0"
              max="20"
              step="0.1"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Annual return rate for invested benefits
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Life Expectancy (years)
            </label>
            <input
              type="number"
              value={baseLifeExpectancy}
              onChange={(e) => setBaseLifeExpectancy(parseInt(e.target.value) || 85)}
              min="65"
              max="100"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              {planData.life_expectancy ? `From plan profile: ${planData.life_expectancy}` : 'General population average: ~85 years'}
            </p>
          </div>
        </div>

        {/* Custom Life Expectancy Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomLifeExpectancy}
              onChange={(e) => setUseCustomLifeExpectancy(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Customize life expectancy based on demographics
            </span>
          </label>
        </div>

        {/* Demographics Section */}
        {useCustomLifeExpectancy && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Demographics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={demographics.gender || ''}
                  onChange={(e) => setDemographics({ ...demographics, gender: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Education</label>
                <select
                  value={demographics.education || ''}
                  onChange={(e) => setDemographics({ ...demographics, education: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="High School">High School</option>
                  <option value="Some College">Some College</option>
                  <option value="Bachelor">Bachelor's Degree</option>
                  <option value="Graduate">Graduate Degree</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Income Level</label>
                <select
                  value={demographics.income || ''}
                  onChange={(e) => setDemographics({ ...demographics, income: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Health Status</label>
                <select
                  value={demographics.health || ''}
                  onChange={(e) => setDemographics({ ...demographics, health: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="Poor">Poor</option>
                  <option value="Average">Average</option>
                  <option value="Good">Good</option>
                  <option value="Excellent">Excellent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Smoking</label>
                <select
                  value={demographics.smoking === undefined ? '' : demographics.smoking ? 'Yes' : 'No'}
                  onChange={(e) => setDemographics({ ...demographics, smoking: e.target.value === 'Yes' })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Exercise Level</label>
                <select
                  value={demographics.exercise || ''}
                  onChange={(e) => setDemographics({ ...demographics, exercise: e.target.value as any })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Select...</option>
                  <option value="None">None</option>
                  <option value="Light">Light</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Heavy">Heavy</option>
                </select>
              </div>
            </div>

            {useCustomLifeExpectancy && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Adjusted Life Expectancy:</strong>{' '}
                  {calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics).toFixed(1)} years
                  {calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics) !== baseLifeExpectancy && (
                    <span className="ml-2">
                      ({calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics) > baseLifeExpectancy ? '+' : ''}
                      {(calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics) - baseLifeExpectancy).toFixed(1)} years from base)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Table */}
      {analysisResults.length > 0 && (
        <>
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Results</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Start Age</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Monthly Benefit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Annual Benefit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Lifetime Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      <div className="flex items-center justify-end gap-1">
                        Benefits Gain/Loss
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="cursor-help">
                                <HelpCircle className="h-3.5 w-3.5 text-gray-500 hover:text-gray-700" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3">
                              <div className="text-xs space-y-2">
                                <p className="font-semibold text-sm mb-2">What is Benefits Gain/Loss?</p>
                                <p>
                                  Benefits Gain/Loss represents the difference between your strategy and starting at full retirement age (67), accounting for investment returns.
                                </p>
                                <p>
                                  <strong>For early start (before age 67):</strong> If lifetime total plus investment returns on early benefits exceeds FRA lifetime total, it's a gain (positive). Otherwise, it's a loss (negative).
                                </p>
                                <p>
                                  <strong>For delayed start (after age 67):</strong> The lost benefits you could have received and invested are a loss (negative value).
                                </p>
                                <p className="text-gray-300 mt-2">
                                  A positive value means you're gaining compared to FRA, while a negative value means you're losing compared to FRA.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Net Value (After Opp. Cost)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      <div className="flex items-center justify-end gap-1">
                        Break-Even Age
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="cursor-help">
                                <HelpCircle className="h-3.5 w-3.5 text-gray-500 hover:text-gray-700" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm bg-gray-900 text-gray-100 border border-gray-700 p-3">
                              <div className="text-xs space-y-2">
                                <p className="font-semibold text-sm mb-2">What is Break-Even Age?</p>
                                <p>
                                  Break-even age is the age at which the cumulative benefits from starting at a different age equal the cumulative benefits from starting at full retirement age (67).
                                </p>
                                <p>
                                  <strong>For early start (before age 67):</strong> This is the age when starting at full retirement age would have caught up to the total benefits you received by starting early. If you live past this age, starting at full retirement age would have been better.
                                </p>
                                <p>
                                  <strong>For delayed start (after age 67):</strong> This is the age when the higher benefits from delaying catch up to what you would have received by starting at full retirement age. If you live past this age, delaying was the better choice.
                                </p>
                                <p className="text-gray-300 mt-2">
                                  The break-even age helps you understand when one strategy becomes more beneficial than another based on your life expectancy.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Years to Break-Even</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysisResults.map((result, index) => {
                    const isBest = result.startAge === bestOption?.startAge
                    return (
                      <tr
                        key={result.startAge}
                        className={isBest ? 'bg-green-50' : ''}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {result.startAge}
                          {isBest && (
                            <span className="ml-2 text-green-600">
                              <CheckCircle2 className="h-4 w-4 inline" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          ${result.monthlyBenefit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          ${result.annualBenefit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          ${result.lifetimeTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${
                          result.benefitsGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button className="cursor-help underline decoration-dotted hover:decoration-solid">
                                  {result.benefitsGainLoss >= 0 ? '+' : ''}
                                  ${result.benefitsGainLoss.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md bg-gray-900 text-gray-100 border border-gray-700 p-4">
                                <div className="text-xs space-y-3">
                                  <p className="font-semibold text-sm mb-2">Benefits Gain/Loss Calculation</p>
                                  {result.benefitsGainLossCalculation?.yearsEarly !== undefined ? (
                                    <>
                                      <p>
                                        <strong>Early Start (Age {result.startAge}):</strong>
                                      </p>
                                      <div className="pl-3 space-y-2 text-gray-300">
                                        <p>• Years before FRA: {result.benefitsGainLossCalculation.yearsEarly}</p>
                                        <p>• Early benefits with investment returns: ${result.benefitsGainLossCalculation.earlyBenefitsWithInvestment?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        <p>• FRA lifetime total: ${result.benefitsGainLossCalculation.fraLifetimeTotal?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        <p className="mt-2 pt-2 border-t border-gray-600">
                                          <strong>Benefits Gain/Loss =</strong> Early Benefits with Investment - FRA Lifetime Total
                                        </p>
                                        <p className="text-gray-200">
                                          = ${result.benefitsGainLossCalculation.earlyBenefitsWithInvestment?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} - ${result.benefitsGainLossCalculation.fraLifetimeTotal?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-gray-200 font-semibold">
                                          = ${result.benefitsGainLoss.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-2">
                                          Note: Uses {((result.benefitsGainLossCalculation.investmentReturnRate || 0) * 100).toFixed(2)}% annual return and 3% inflation
                                        </p>
                                      </div>
                                    </>
                                  ) : result.benefitsGainLossCalculation?.yearsDelayed !== undefined ? (
                                    <>
                                      <p>
                                        <strong>Delayed Start (Age {result.startAge}):</strong>
                                      </p>
                                      <div className="pl-3 space-y-2 text-gray-300">
                                        <p>• Years delayed after FRA: {result.benefitsGainLossCalculation.yearsDelayed}</p>
                                        
                                        <div className="mt-2">
                                          <p className="font-semibold text-gray-200 mb-1">Lost FRA Benefits (could have been invested, Age 67 to {result.startAge - 1}):</p>
                                          <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto bg-gray-800 p-2 rounded">
                                            {result.benefitsGainLossCalculation.lostBenefitsBreakdown?.map((item, idx) => (
                                              <div key={idx} className="flex justify-between gap-2">
                                                <span>Age {item.year}: ${item.benefit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                                <span className="text-gray-400">× {(1 + (result.benefitsGainLossCalculation?.investmentReturnRate || 0)).toFixed(2)}<sup>{item.yearsToInvest}</sup></span>
                                                <span className="text-gray-200">= ${item.investedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                              </div>
                                            ))}
                                          </div>
                                          <p className="mt-1 text-gray-200">
                                            <strong>Total Lost Benefits Invested:</strong> ${result.benefitsGainLossCalculation.lostBenefitsInvested?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </p>
                                        </div>
                                        
                                        <p className="mt-2 pt-2 border-t border-gray-600">
                                          <strong>Benefits Gain/Loss =</strong> - Lost Benefits Invested
                                        </p>
                                        <p className="text-gray-200">
                                          = -${result.benefitsGainLossCalculation.lostBenefitsInvested?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-gray-200 font-semibold">
                                          = ${result.benefitsGainLoss.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                        <p className="text-gray-400 text-xs mt-2">
                                          Note: Uses {((result.benefitsGainLossCalculation?.investmentReturnRate || 0) * 100).toFixed(2)}% annual return and 3% inflation. Each lost benefit is invested for the remaining years until delayed start age. Negative value means you're giving up this amount by waiting.
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-gray-300">
                                      Starting at full retirement age (67) has no benefits gain/loss - this is the baseline.
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold text-right ${
                          result.netValue >= bestOption?.netValue! * 0.99
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}>
                          ${result.netValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {result.breakEvenAge <= (useCustomLifeExpectancy ? calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics) : baseLifeExpectancy) ? result.breakEvenAge.toFixed(0) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                          {result.yearsToBreakEven > 0 ? `${result.yearsToBreakEven.toFixed(1)} years` : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cumulative Benefits Over Time</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Tip:</strong> Move your mouse over any age on the chart to see which starting age provides the highest cumulative benefits at that point.
            </p>
            <div className="h-[600px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="age"
                    label={{ value: 'Age', position: 'insideBottom', offset: -10 }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    label={{ value: 'Cumulative Benefits ($)', angle: -90, position: 'insideLeft' }}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <RechartsTooltip
                    content={(props: any) => {
                      if (!props.active || !props.payload) return null
                      
                      const allValues = props.payload
                        .map((p: any) => p.value as number)
                        .filter((v: number) => v !== undefined && v > 0)
                      const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0
                      
                      return (
                        <div className="bg-white text-gray-900 border border-gray-300 rounded-md p-3 shadow-lg">
                          <p className="font-semibold mb-2 text-gray-900">{`Age: ${props.label}`}</p>
                          <div className="space-y-1">
                            {props.payload
                              .filter((p: any) => p.value !== undefined && p.value > 0)
                              .map((entry: any, index: number) => {
                                const isMax = entry.value === maxValue
                                return (
                                  <div 
                                    key={index} 
                                    className={`flex justify-between gap-4 px-2 py-1 rounded ${
                                      isMax 
                                        ? 'bg-green-50 border border-green-300 font-bold text-green-800' 
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    <span style={{ color: entry.color }} className={isMax ? 'font-bold' : ''}>
                                      {entry.name}:
                                    </span>
                                    <span className={isMax ? 'font-bold text-green-800' : 'text-gray-900'}>
                                      ${(entry.value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend />
                  {analysisResults.map((result) => {
                    const lineColor = result.startAge === 62 ? '#ef4444' :
                                     result.startAge === 67 ? '#22c55e' :
                                     result.startAge === 70 ? '#3b82f6' :
                                     '#6b7280'
                    
                    return (
                      <Line
                        key={result.startAge}
                        type="monotone"
                        dataKey={`Age ${result.startAge}`}
                        name={`Start at ${result.startAge}`}
                        stroke={lineColor}
                        strokeWidth={result.startAge === bestOption?.startAge ? 3 : 2}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props
                          // Show dot if this is a crossover point
                          if (payload && payload[`Age ${result.startAge}_crossover`]) {
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={lineColor}
                                stroke="#fff"
                                strokeWidth={2}
                              />
                            )
                          }
                          return null
                        }}
                        activeDot={{ r: 6 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Recommendations by Start Age
            </h3>
            <div className="space-y-3">
              {analysisResults.map((result) => (
                <div
                  key={result.startAge}
                  className={`p-4 rounded-lg border ${
                    result.startAge === bestOption?.startAge
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Age {result.startAge}
                        {result.startAge === bestOption?.startAge && (
                          <span className="ml-2 text-green-600 text-sm">(Recommended)</span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-700">{result.recommendation}</p>
                      <div className="mt-2 text-xs text-gray-600 space-y-1">
                        <p>• Monthly benefit: ${result.monthlyBenefit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p>• Lifetime total: ${result.lifetimeTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p>• Benefits gain/loss: {result.benefitsGainLoss >= 0 ? '+' : ''}${result.benefitsGainLoss.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        <p className="font-semibold">• Net value: ${result.netValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                        {result.breakEvenAge < 100 && (
                          <p>• Break-even vs. FRA: Age {result.breakEvenAge.toFixed(0)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Insights */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <strong>Full Retirement Age (FRA):</strong> Age 67 is the standard full retirement age for most people born after 1960.
              </p>
              <p>
                <strong>Early Retirement (62-66):</strong> Benefits are reduced by ~6.67% per year before FRA, up to 30% reduction at age 62.
              </p>
              <p>
                <strong>Delayed Retirement (68-70):</strong> Benefits increase by ~8% per year after FRA, up to 24% increase at age 70.
              </p>
              <p>
                <strong>Break-Even Analysis:</strong> Starting early provides more money initially, but delaying provides more if you live past the break-even age.
              </p>
              <p>
                <strong>Life Expectancy Impact:</strong> If you expect to live longer than average, delaying benefits typically results in higher lifetime totals.
              </p>
              <p>
                <strong>Current Age:</strong> {currentAge} years | <strong>Life Expectancy Used:</strong>{' '}
                {useCustomLifeExpectancy
                  ? `${calculateAdjustedLifeExpectancy(baseLifeExpectancy, demographics).toFixed(1)} years (customized)`
                  : `${baseLifeExpectancy} years (base)`}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

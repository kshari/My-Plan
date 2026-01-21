'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/property/ui/tooltip'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Property {
  id: number
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
}

interface RecommendedScenariosListProps {
  property: Property
}

interface Scenario {
  id: number
  name: string
  purchasePrice: number
  grossIncome: number
  operatingExpenses: number
  noi: number
  capRate: number
  hasLoan: boolean
  interestRate: number | null
  downPaymentPercent: number | null
  downPaymentAmount: number | null
  loanTerm: number | null
  loanPrincipal: number | null
  monthlyMortgage: number | null
  annualMortgage: number | null
  firstYearInterest: number
  firstYearPrincipal: number
  loanClosingCosts: number
  purchaseClosingCosts: number
  totalClosingCosts: number
  totalCashInvested: number
  grm: number
  dscr: number | null
  ltv: number | null
  firstYearCashFlow: number
  firstYearCoCR: number
}

export default function RecommendedScenariosList({ property }: RecommendedScenariosListProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // Input state for ranges
  const [minInterestRate, setMinInterestRate] = useState('4.0')
  const [maxInterestRate, setMaxInterestRate] = useState('7.0')
  const [purchasePriceMinChange, setPurchasePriceMinChange] = useState('-20')
  const [purchasePriceMaxChange, setPurchasePriceMaxChange] = useState('5')
  const [incomeMinChange, setIncomeMinChange] = useState('-20')
  const [incomeMaxChange, setIncomeMaxChange] = useState('20')
  const [expensesMinChange, setExpensesMinChange] = useState('-20')
  const [expensesMaxChange, setExpensesMaxChange] = useState('20')
  const [minDownPayment, setMinDownPayment] = useState('25')
  const [maxDownPayment, setMaxDownPayment] = useState('25')
  const [closingCostPercent, setClosingCostPercent] = useState('3')
  const [includeLoanTerm15, setIncludeLoanTerm15] = useState(false)
  const [includeLoanTerm20, setIncludeLoanTerm20] = useState(false)
  const [includeLoanTerm30, setIncludeLoanTerm30] = useState(true)
  const [positiveCashFlowOnly, setPositiveCashFlowOnly] = useState(false)
  const [includeLoan, setIncludeLoan] = useState(true)
  const [includeAllCash, setIncludeAllCash] = useState(true)
  const [sortColumn, setSortColumn] = useState<string | null>('firstYearCoCR')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [savingScenarioId, setSavingScenarioId] = useState<number | null>(null)
  const [savingThresholds, setSavingThresholds] = useState(false)
  const [savingThresholdVariable, setSavingThresholdVariable] = useState<string | null>(null)

  const scenarios = useMemo(() => {
    const askingPrice = property['Asking Price'] || 1000000
    const baseGrossIncome = property['Gross Income'] || 120000
    const baseOperatingExpenses = property['Operating Expenses'] || 40000

    // Parse input values (handle 0 correctly by checking for NaN instead of falsy)
    const parseValue = (value: string, defaultValue: number): number => {
      if (value === '' || value === null || value === undefined) {
        return defaultValue
      }
      const parsed = parseFloat(value)
      return isNaN(parsed) ? defaultValue : parsed
    }

    const minIntRate = parseValue(minInterestRate, 4.0)
    const maxIntRate = parseValue(maxInterestRate, 7.0)
    const priceMinChange = parseValue(purchasePriceMinChange, -15)
    const priceMaxChange = parseValue(purchasePriceMaxChange, 10)
    const incomeMinChangeVal = parseValue(incomeMinChange, -10)
    const incomeMaxChangeVal = parseValue(incomeMaxChange, 10)
    const expensesMinChangeVal = parseValue(expensesMinChange, -10)
    const expensesMaxChangeVal = parseValue(expensesMaxChange, 10)
    const minDownPaymentVal = parseValue(minDownPayment, 20)
    const maxDownPaymentVal = parseValue(maxDownPayment, 30)

    const generatedScenarios: Scenario[] = []
    let scenarioId = 1

    // Use only min and max values for each range, but avoid duplicates when min === max
    const purchasePriceMultipliers = priceMinChange === priceMaxChange
      ? [1 + (priceMinChange / 100)]
      : [1 + (priceMinChange / 100), 1 + (priceMaxChange / 100)]

    const interestRates = minIntRate === maxIntRate
      ? [minIntRate]
      : [minIntRate, maxIntRate]

    const grossIncomeMultipliers = incomeMinChangeVal === incomeMaxChangeVal
      ? [1 + (incomeMinChangeVal / 100)]
      : [1 + (incomeMinChangeVal / 100), 1 + (incomeMaxChangeVal / 100)]

    const operatingExpensesMultipliers = expensesMinChangeVal === expensesMaxChangeVal
      ? [1 + (expensesMinChangeVal / 100)]
      : [1 + (expensesMinChangeVal / 100), 1 + (expensesMaxChangeVal / 100)]

    const downPaymentPercents = minDownPaymentVal === maxDownPaymentVal
      ? [minDownPaymentVal]
      : [minDownPaymentVal, maxDownPaymentVal]

    // Build loan terms array based on toggles
    const loanTerms: number[] = []
    if (includeLoanTerm15) loanTerms.push(15)
    if (includeLoanTerm20) loanTerms.push(20)
    if (includeLoanTerm30) loanTerms.push(30)

    // Generate scenarios with loans - systematic combinations
    for (const priceMult of purchasePriceMultipliers) {
      for (const intRate of interestRates) {
        for (const incomeMult of grossIncomeMultipliers) {
          for (const expMult of operatingExpensesMultipliers) {
            for (const downPaymentPercent of downPaymentPercents) {
              for (const loanTerm of loanTerms) {
                const purchasePrice = askingPrice * priceMult
                const grossIncome = baseGrossIncome * incomeMult
                const operatingExpenses = baseOperatingExpenses * expMult
                const noi = grossIncome - operatingExpenses
                const downPaymentAmount = purchasePrice * (downPaymentPercent / 100)
                const loanPrincipal = purchasePrice - downPaymentAmount
                const interestRate = intRate

            // Calculate monthly mortgage
            const monthlyRate = interestRate / 100 / 12
            const numPayments = loanTerm * 12
            const monthlyMortgage = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
            const annualMortgage = monthlyMortgage * 12

            // Calculate first year interest and principal
            let balance = loanPrincipal
            let firstYearInterest = 0
            let firstYearPrincipal = 0
            for (let month = 1; month <= 12; month++) {
              const interestPayment = balance * monthlyRate
              const principalPayment = monthlyMortgage - interestPayment
              firstYearInterest += interestPayment
              firstYearPrincipal += principalPayment > balance ? balance : principalPayment
              balance = Math.max(0, balance - principalPayment)
            }

            // Closing costs (percentage of purchase price)
            const closingCostPercentVal = parseValue(closingCostPercent, 3)
            const purchaseClosingCosts = purchasePrice * (closingCostPercentVal / 100)
            const loanClosingCosts = loanPrincipal * (closingCostPercentVal / 100)
            const totalClosingCosts = purchaseClosingCosts + loanClosingCosts

            // Total cash invested
            const totalCashInvested = downPaymentAmount + loanClosingCosts + purchaseClosingCosts

            // Metrics
            const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
            const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0
            const dscr = annualMortgage > 0 ? noi / annualMortgage : null
            const ltv = purchasePrice > 0 ? ((purchasePrice - downPaymentAmount) / purchasePrice) * 100 : null

                // First year cash flow (closing costs are part of initial investment, not an expense)
                const firstYearNetIncome = noi - firstYearInterest
                const firstYearCashFlow = firstYearNetIncome - firstYearPrincipal
                const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0

                generatedScenarios.push({
                  id: scenarioId++,
                  name: `Scenario ${scenarioId - 1}`,
                  purchasePrice,
                  grossIncome,
                  operatingExpenses,
                  noi,
                  capRate,
                  hasLoan: true,
                  interestRate,
                  downPaymentPercent,
                  downPaymentAmount,
                  loanTerm,
                  loanPrincipal,
                  monthlyMortgage,
                  annualMortgage,
                  firstYearInterest,
                  firstYearPrincipal,
                  loanClosingCosts,
                  purchaseClosingCosts,
                  totalClosingCosts,
                  totalCashInvested,
                  grm,
                  dscr,
                  ltv,
                  firstYearCashFlow,
                  firstYearCoCR,
                })
              }
            }
          }
        }
      }
    }

    // Add scenarios without loans - systematic combinations
    for (const priceMult of purchasePriceMultipliers) {
      for (const incomeMult of grossIncomeMultipliers) {
        for (const expMult of operatingExpensesMultipliers) {
          const purchasePrice = askingPrice * priceMult
          const grossIncome = baseGrossIncome * incomeMult
          const operatingExpenses = baseOperatingExpenses * expMult
          const noi = grossIncome - operatingExpenses

          // Closing costs (percentage of purchase price) - part of initial investment, not an expense
          const closingCostPercentVal = parseValue(closingCostPercent, 3)
          const purchaseClosingCosts = purchasePrice * (closingCostPercentVal / 100)
          const loanClosingCosts = 0
          const totalClosingCosts = purchaseClosingCosts

          // Total cash invested (no loan)
          const totalCashInvested = purchasePrice + purchaseClosingCosts

          // Metrics
          const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
          const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0

          // First year cash flow (no loan) - closing costs are part of initial investment, not an expense
          const firstYearCashFlow = noi
          const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0

          generatedScenarios.push({
            id: scenarioId++,
            name: `Scenario ${scenarioId - 1} (No Loan)`,
            purchasePrice,
            grossIncome,
            operatingExpenses,
            noi,
            capRate,
            hasLoan: false,
            interestRate: null,
            downPaymentPercent: null,
            downPaymentAmount: null,
            loanTerm: null,
            loanPrincipal: null,
            monthlyMortgage: null,
            annualMortgage: null,
            firstYearInterest: 0,
            firstYearPrincipal: 0,
            loanClosingCosts,
            purchaseClosingCosts,
            totalClosingCosts,
            totalCashInvested,
            grm,
            dscr: null,
            ltv: null,
            firstYearCashFlow,
            firstYearCoCR,
          })
        }
      }
    }

    // Filter scenarios based on checkboxes
    let filteredScenarios = generatedScenarios
    
    // Filter by loan status
    if (!includeLoan && !includeAllCash) {
      // If both are unchecked, show nothing
      filteredScenarios = []
    } else if (!includeLoan) {
      // Only show all cash scenarios
      filteredScenarios = filteredScenarios.filter(s => !s.hasLoan)
    } else if (!includeAllCash) {
      // Only show loan scenarios
      filteredScenarios = filteredScenarios.filter(s => s.hasLoan)
    }
    // If both are checked, show all (no filter needed)
    
    // Filter by positive cash flow if checkbox is checked
    if (positiveCashFlowOnly) {
      filteredScenarios = filteredScenarios.filter(s => s.firstYearCashFlow >= 0)
    }

    return filteredScenarios
  }, [
    property, 
    minInterestRate, 
    maxInterestRate, 
    purchasePriceMinChange, 
    purchasePriceMaxChange, 
    incomeMinChange, 
    incomeMaxChange, 
    expensesMinChange, 
    expensesMaxChange, 
    minDownPayment, 
    maxDownPayment, 
    closingCostPercent,
    includeLoanTerm15,
    includeLoanTerm20,
    includeLoanTerm30,
    positiveCashFlowOnly, 
    includeLoan, 
    includeAllCash
  ])

  // Sort scenarios based on sortColumn and sortDirection
  const sortedScenarios = useMemo(() => {
    if (!sortColumn) return scenarios

    const sorted = [...scenarios].sort((a, b) => {
      let aValue: number
      let bValue: number

      switch (sortColumn) {
        case 'purchasePrice':
          aValue = a.purchasePrice
          bValue = b.purchasePrice
          break
        case 'grossIncome':
          aValue = a.grossIncome
          bValue = b.grossIncome
          break
        case 'operatingExpenses':
          aValue = a.operatingExpenses
          bValue = b.operatingExpenses
          break
        case 'noi':
          aValue = a.noi
          bValue = b.noi
          break
        case 'capRate':
          aValue = a.capRate
          bValue = b.capRate
          break
        case 'interestRate':
          aValue = a.interestRate ?? 0
          bValue = b.interestRate ?? 0
          break
        case 'downPayment':
          aValue = a.downPaymentAmount ?? 0
          bValue = b.downPaymentAmount ?? 0
          break
        case 'totalClosingCosts':
          aValue = a.totalClosingCosts
          bValue = b.totalClosingCosts
          break
        case 'totalCashInvested':
          aValue = a.totalCashInvested
          bValue = b.totalCashInvested
          break
        case 'grm':
          aValue = a.grm
          bValue = b.grm
          break
        case 'dscr':
          aValue = a.dscr ?? 0
          bValue = b.dscr ?? 0
          break
        case 'ltv':
          aValue = a.ltv ?? 0
          bValue = b.ltv ?? 0
          break
        case 'firstYearCashFlow':
          aValue = a.firstYearCashFlow
          bValue = b.firstYearCashFlow
          break
        case 'firstYearCoCR':
          aValue = a.firstYearCoCR
          bValue = b.firstYearCoCR
          break
        case 'loanTerm':
          aValue = a.loanTerm ?? 0
          bValue = b.loanTerm ?? 0
          break
        default:
          return 0
      }

      if (sortDirection === 'asc') {
        return aValue - bValue
      } else {
        return bValue - aValue
      }
    })

    return sorted
  }, [scenarios, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to descending
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  // Calculate absolute values based on property and ranges
  const askingPrice = property['Asking Price'] || 1000000
  const baseGrossIncome = property['Gross Income'] || 120000
  const baseOperatingExpenses = property['Operating Expenses'] || 40000
  
  const parseValue = (value: string, defaultValue: number): number => {
    if (value === '' || value === null || value === undefined) {
      return defaultValue
    }
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }

  const priceMinChange = parseValue(purchasePriceMinChange, -15)
  const priceMaxChange = parseValue(purchasePriceMaxChange, 10)
  const incomeMinChangeVal = parseValue(incomeMinChange, -10)
  const incomeMaxChangeVal = parseValue(incomeMaxChange, 10)
  const expensesMinChangeVal = parseValue(expensesMinChange, -10)
  const expensesMaxChangeVal = parseValue(expensesMaxChange, 10)
  const minDownPaymentVal = parseValue(minDownPayment, 20)
  const maxDownPaymentVal = parseValue(maxDownPayment, 30)
  const minIntRate = parseValue(minInterestRate, 4.0)
  const maxIntRate = parseValue(maxInterestRate, 7.0)

  // Calculate threshold values where cash flow becomes positive for each variable (keeping others at baseline)
  const calculatePositiveCashFlowThresholds = useMemo(() => {
    const results: {
      variable: string
      thresholdValue: number | null
      thresholdChange: number | null
    }[] = []

    // Get the first available loan term (or default to 30 if none selected)
    const loanTerms: number[] = []
    if (includeLoanTerm15) loanTerms.push(15)
    if (includeLoanTerm20) loanTerms.push(20)
    if (includeLoanTerm30) loanTerms.push(30)
    const defaultLoanTerm = loanTerms.length > 0 ? loanTerms[0] : 30

    // Helper function to calculate cash flow for a scenario
    const calculateCashFlow = (
      purchasePriceChange: number,
      incomeChange: number,
      expensesChange: number,
      interestRate: number,
      downPaymentPercent: number,
      loanTerm: number
    ): number => {
      const purchasePrice = askingPrice * (1 + purchasePriceChange / 100)
      const grossIncome = baseGrossIncome * (1 + incomeChange / 100)
      const operatingExpenses = baseOperatingExpenses * (1 + expensesChange / 100)
      const noi = grossIncome - operatingExpenses
      
      const downPaymentAmount = purchasePrice * (downPaymentPercent / 100)
      const loanPrincipal = purchasePrice - downPaymentAmount
      
      // Calculate monthly mortgage
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      const monthlyMortgage = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      
      // Calculate first year interest and principal
      let balance = loanPrincipal
      let firstYearInterest = 0
      let firstYearPrincipal = 0
      for (let month = 1; month <= 12; month++) {
        const interestPayment = balance * monthlyRate
        const principalPayment = monthlyMortgage - interestPayment
        firstYearInterest += interestPayment
        firstYearPrincipal += principalPayment > balance ? balance : principalPayment
        balance = Math.max(0, balance - principalPayment)
      }
      
      // Closing costs (percentage of purchase price) - part of initial investment, not an expense
      const closingCostPercentVal = parseValue(closingCostPercent, 3)
      const purchaseClosingCosts = purchasePrice * (closingCostPercentVal / 100)
      const loanClosingCosts = loanPrincipal * (closingCostPercentVal / 100)
      
      // First year cash flow (closing costs are part of initial investment, not an expense)
      const firstYearNetIncome = noi - firstYearInterest
      return firstYearNetIncome - firstYearPrincipal
    }

    // Test Purchase Price (with loan, using average interest rate and down payment)
    const avgInterestRate = (minIntRate + maxIntRate) / 2
    const avgDownPayment = (minDownPaymentVal + maxDownPaymentVal) / 2
    let priceThreshold = null
    // Search from high to low to find the highest price that gives positive cash flow
    for (let change = 50; change >= -50; change -= 0.1) {
      const cashFlow = calculateCashFlow(change, 0, 0, avgInterestRate, avgDownPayment, defaultLoanTerm)
      if (cashFlow >= 0) {
        priceThreshold = change
        break
      }
    }
    results.push({
      variable: 'Purchase Price',
      thresholdValue: priceThreshold !== null ? askingPrice * (1 + priceThreshold / 100) : null,
      thresholdChange: priceThreshold
    })

    // Test Income - find minimum income change needed
    let incomeThreshold = null
    for (let change = -50; change <= 50; change += 0.1) {
      const cashFlow = calculateCashFlow(0, change, 0, avgInterestRate, avgDownPayment, defaultLoanTerm)
      if (cashFlow >= 0) {
        incomeThreshold = change
        break
      }
    }
    results.push({
      variable: 'Gross Income',
      thresholdValue: incomeThreshold !== null ? baseGrossIncome * (1 + incomeThreshold / 100) : null,
      thresholdChange: incomeThreshold
    })

    // Test Expenses - find maximum expense change allowed
    let expensesThreshold = null
    for (let change = 50; change >= -50; change -= 0.1) {
      const cashFlow = calculateCashFlow(0, 0, change, avgInterestRate, avgDownPayment, defaultLoanTerm)
      if (cashFlow >= 0) {
        expensesThreshold = change
        break
      }
    }
    results.push({
      variable: 'Operating Expenses',
      thresholdValue: expensesThreshold !== null ? baseOperatingExpenses * (1 + expensesThreshold / 100) : null,
      thresholdChange: expensesThreshold
    })

    // Test Interest Rate - find maximum interest rate allowed
    let intRateThreshold = null
    for (let rate = 15; rate >= 0; rate -= 0.1) {
      const cashFlow = calculateCashFlow(0, 0, 0, rate, avgDownPayment, defaultLoanTerm)
      if (cashFlow >= 0) {
        intRateThreshold = rate
        break
      }
    }
    results.push({
      variable: 'Interest Rate',
      thresholdValue: intRateThreshold,
      thresholdChange: intRateThreshold
    })

    // Test Down Payment - find minimum down payment needed
    let dpThreshold = null
    for (let dp = 0; dp <= 50; dp += 0.1) {
      const cashFlow = calculateCashFlow(0, 0, 0, avgInterestRate, dp, defaultLoanTerm)
      if (cashFlow >= 0) {
        dpThreshold = dp
        break
      }
    }
    results.push({
      variable: 'Down Payment',
      thresholdValue: dpThreshold,
      thresholdChange: dpThreshold
    })

    return results
  }, [
    property, 
    minInterestRate, 
    maxInterestRate, 
    purchasePriceMinChange, 
    purchasePriceMaxChange, 
    incomeMinChange, 
    incomeMaxChange, 
    expensesMinChange, 
    expensesMaxChange, 
    minDownPayment, 
    maxDownPayment, 
    closingCostPercent,
    includeLoanTerm15,
    includeLoanTerm20,
    includeLoanTerm30,
    includeLoan,
    includeAllCash
  ])

  const minPurchasePrice = askingPrice * (1 + (priceMinChange / 100))
  const maxPurchasePrice = askingPrice * (1 + (priceMaxChange / 100))
  const minIncome = baseGrossIncome * (1 + (incomeMinChangeVal / 100))
  const maxIncome = baseGrossIncome * (1 + (incomeMaxChangeVal / 100))
  const minExpenses = baseOperatingExpenses * (1 + (expensesMinChangeVal / 100))
  const maxExpenses = baseOperatingExpenses * (1 + (expensesMaxChangeVal / 100))

  // Calculate min and max cash flow from sorted scenarios
  const minCashFlow = sortedScenarios.length > 0 ? Math.min(...sortedScenarios.map(s => s.firstYearCashFlow)) : 0
  const maxCashFlow = sortedScenarios.length > 0 ? Math.max(...sortedScenarios.map(s => s.firstYearCashFlow)) : 0

  // Helper function to parse values
  const parseValueHelper = (value: string, defaultValue: number): number => {
    if (value === '' || value === null || value === undefined) {
      return defaultValue
    }
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }

  // Function to save a scenario to the database
  const saveScenario = async (scenario: Scenario, scenarioName?: string) => {
    setSavingScenarioId(scenario.id)
    try {
      const askingPrice = property['Asking Price'] || 0
      const closingCostPercentVal = parseValueHelper(closingCostPercent, 3)
      
      // Calculate purchase closing costs
      const purchaseClosingCosts = scenario.purchasePrice * (closingCostPercentVal / 100)
      
      // Calculate loan closing costs if there's a loan
      const loanClosingCosts = scenario.hasLoan && scenario.loanPrincipal 
        ? scenario.loanPrincipal * (closingCostPercentVal / 100)
        : 0

      const scenarioData: any = {
        'Scenario Name': scenarioName || `Model Scenario ${scenario.id}`,
        'Purchase Price': scenario.purchasePrice,
        'Gross Income': scenario.grossIncome,
        'Operating Expenses': scenario.operatingExpenses,
        'Cap Rate': scenario.capRate,
        'Net Income': scenario.hasLoan ? scenario.noi - scenario.firstYearInterest : scenario.noi,
        'Income Increase': 0,
        'Expenses Increase': 0,
        'Property Value Increase': 0,
        'Property ID': property.id,
        'Has Loan': scenario.hasLoan,
        'Loan Term': scenario.hasLoan && scenario.loanTerm ? scenario.loanTerm : null,
        'Down Payment Percentage': scenario.hasLoan && scenario.downPaymentPercent ? scenario.downPaymentPercent : null,
        'Down Payment Amount': scenario.hasLoan && scenario.downPaymentAmount ? scenario.downPaymentAmount : null,
        'Interest Rate': scenario.hasLoan && scenario.interestRate ? scenario.interestRate : null,
        'Closing Costs': scenario.hasLoan ? loanClosingCosts : null,
        'Purchase Closing Costs': purchaseClosingCosts,
      }

      const { data, error } = await supabase
        .from('pi_financial_scenarios')
        .insert([scenarioData])
        .select()
        .single()

      if (error) throw error

      // If scenario has a loan, save loan details
      if (scenario.hasLoan && scenario.loanTerm && scenario.interestRate && scenario.monthlyMortgage) {
        const loanData: any = {
          'Loan Term': scenario.loanTerm,
          'Down Payment Percentage': scenario.downPaymentPercent,
          'Down Payment Amount': scenario.downPaymentAmount,
          'Purchase Price': scenario.purchasePrice,
          'Interest Rate': scenario.interestRate,
          'Monthly Mortgage': scenario.monthlyMortgage,
          'Monthly Principle': scenario.firstYearPrincipal / 12,
          'Monthly Interest': scenario.firstYearInterest / 12,
          'Closing Costs': loanClosingCosts,
          'Annual Mortgage': scenario.monthlyMortgage * 12,
          'Annual Principal': scenario.firstYearPrincipal,
          'Annual Interest': scenario.firstYearInterest,
          'scanario': data.id,
        }

        const { error: loanError } = await supabase
          .from('pi_loans')
          .insert([loanData])

        if (loanError) {
          console.error('Loan insert error:', loanError)
          throw new Error(`Failed to save loan information: ${loanError.message}`)
        }
      }

      alert(`Scenario "${scenarioData['Scenario Name']}" saved successfully!`)
      router.refresh()
    } catch (error: any) {
      alert(`Failed to save scenario: ${error.message}`)
    } finally {
      setSavingScenarioId(null)
    }
  }

  // Function to save a single threshold scenario
  const saveSingleThresholdScenario = async (threshold: { variable: string; thresholdValue: number | null; thresholdChange: number | null }) => {
    if (threshold.thresholdValue === null || threshold.thresholdChange === null) {
      alert('Cannot save: No valid threshold value found')
      return
    }

    setSavingThresholdVariable(threshold.variable)
    try {
      const askingPrice = property['Asking Price'] || 0
      const baseGrossIncome = property['Gross Income'] || 0
      const baseOperatingExpenses = property['Operating Expenses'] || 0
      const avgInterestRate = (parseValueHelper(minInterestRate, 4.0) + parseValueHelper(maxInterestRate, 7.0)) / 2
      const avgDownPayment = (parseValueHelper(minDownPayment, 20) + parseValueHelper(maxDownPayment, 30)) / 2
      const closingCostPercentVal = parseValueHelper(closingCostPercent, 3)
      
      // Get the first available loan term (or default to 30 if none selected)
      const loanTerms: number[] = []
      if (includeLoanTerm15) loanTerms.push(15)
      if (includeLoanTerm20) loanTerms.push(20)
      if (includeLoanTerm30) loanTerms.push(30)
      const defaultLoanTerm = loanTerms.length > 0 ? loanTerms[0] : 30

      let purchasePrice = askingPrice
      let grossIncome = baseGrossIncome
      let operatingExpenses = baseOperatingExpenses
      let interestRate = avgInterestRate
      let downPaymentPercent = avgDownPayment

      // Set the threshold value for the variable being tested
      switch (threshold.variable) {
        case 'Purchase Price':
          purchasePrice = threshold.thresholdValue
          break
        case 'Gross Income':
          grossIncome = threshold.thresholdValue
          break
        case 'Operating Expenses':
          operatingExpenses = threshold.thresholdValue
          break
        case 'Interest Rate':
          interestRate = threshold.thresholdValue
          break
        case 'Down Payment':
          downPaymentPercent = threshold.thresholdValue
          break
      }

      const noi = grossIncome - operatingExpenses
      const downPaymentAmount = purchasePrice * (downPaymentPercent / 100)
      const loanPrincipal = purchasePrice - downPaymentAmount
      const purchaseClosingCosts = purchasePrice * (closingCostPercentVal / 100)
      const loanClosingCosts = loanPrincipal * (closingCostPercentVal / 100)

      // Calculate monthly mortgage
      const monthlyRate = interestRate / 100 / 12
      const numPayments = defaultLoanTerm * 12
      const monthlyMortgage = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)

      // Calculate first year interest and principal
      let balance = loanPrincipal
      let firstYearInterest = 0
      let firstYearPrincipal = 0
      for (let month = 1; month <= 12; month++) {
        const interestPayment = balance * monthlyRate
        const principalPayment = monthlyMortgage - interestPayment
        firstYearInterest += interestPayment
        firstYearPrincipal += principalPayment > balance ? balance : principalPayment
        balance = Math.max(0, balance - principalPayment)
      }

      const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
      const netIncome = noi - firstYearInterest
      const firstYearCashFlow = netIncome - firstYearPrincipal

      // Round down payment percentage to integer since database column is smallint (integer only)
      const roundedDownPaymentPercent = Math.round(downPaymentPercent)

      const scenarioData: any = {
        'Scenario Name': `Threshold: ${threshold.variable}`,
        'Purchase Price': purchasePrice,
        'Gross Income': grossIncome,
        'Operating Expenses': operatingExpenses,
        'Cap Rate': capRate,
        'Net Income': netIncome,
        'Income Increase': 0,
        'Expenses Increase': 0,
        'Property Value Increase': 0,
        'Property ID': property.id,
        'Has Loan': true,
        'Loan Term': defaultLoanTerm,
        'Down Payment Percentage': roundedDownPaymentPercent,
        'Down Payment Amount': downPaymentAmount,
        'Interest Rate': interestRate,
        'Closing Costs': loanClosingCosts,
        'Purchase Closing Costs': purchaseClosingCosts,
      }

      // Check for duplicate scenario before saving
      const { data: existingScenarios } = await supabase
        .from('pi_financial_scenarios')
        .select('id, "Scenario Name", "Purchase Price", "Gross Income", "Operating Expenses", "Down Payment Percentage", "Interest Rate", "Loan Term"')
        .eq('Property ID', property.id)
        .eq('Scenario Name', scenarioData['Scenario Name'])

      if (existingScenarios && existingScenarios.length > 0) {
        // Check if any existing scenario matches all key fields
        const isDuplicate = existingScenarios.some((existing: any) => {
          return Math.abs(existing['Purchase Price'] - scenarioData['Purchase Price']) < 0.01 &&
                 Math.abs(existing['Gross Income'] - scenarioData['Gross Income']) < 0.01 &&
                 Math.abs(existing['Operating Expenses'] - scenarioData['Operating Expenses']) < 0.01 &&
                 Math.round(existing['Down Payment Percentage'] || 0) === roundedDownPaymentPercent &&
                 Math.abs((existing['Interest Rate'] || 0) - interestRate) < 0.01 &&
                 existing['Loan Term'] === defaultLoanTerm
        })

        if (isDuplicate) {
          alert('A scenario with the same name and details already exists. Please use a different name or modify the scenario details.')
          return
        }
      }

      const { data: savedScenario, error } = await supabase
        .from('pi_financial_scenarios')
        .insert([scenarioData])
        .select()
        .single()

      if (error) throw error

      // Save loan details
      const loanData: any = {
        'Loan Term': defaultLoanTerm,
        'Down Payment Percentage': roundedDownPaymentPercent,
        'Down Payment Amount': downPaymentAmount,
        'Purchase Price': purchasePrice,
        'Interest Rate': interestRate,
        'Monthly Mortgage': monthlyMortgage,
        'Monthly Principle': firstYearPrincipal / 12,
        'Monthly Interest': firstYearInterest / 12,
        'Closing Costs': loanClosingCosts,
        'Annual Mortgage': monthlyMortgage * 12,
        'Annual Principal': firstYearPrincipal,
        'Annual Interest': firstYearInterest,
        'scanario': savedScenario.id,
      }

      await supabase
        .from('pi_loans')
        .insert([loanData])

      alert(`Threshold scenario "${scenarioData['Scenario Name']}" saved successfully!`)
      router.refresh()
    } catch (error: any) {
      alert(`Failed to save threshold scenario: ${error.message}`)
    } finally {
      setSavingThresholdVariable(null)
    }
  }

  // Function to save all positive threshold scenarios
  const savePositiveThresholdScenarios = async () => {
    setSavingThresholds(true)
    try {
      const askingPrice = property['Asking Price'] || 0
      const baseGrossIncome = property['Gross Income'] || 0
      const baseOperatingExpenses = property['Operating Expenses'] || 0
      const avgInterestRate = (parseValueHelper(minInterestRate, 4.0) + parseValueHelper(maxInterestRate, 7.0)) / 2
      const avgDownPayment = (parseValueHelper(minDownPayment, 20) + parseValueHelper(maxDownPayment, 30)) / 2
      const closingCostPercentVal = parseValueHelper(closingCostPercent, 3)
      
      // Get the first available loan term (or default to 30 if none selected)
      const loanTerms: number[] = []
      if (includeLoanTerm15) loanTerms.push(15)
      if (includeLoanTerm20) loanTerms.push(20)
      if (includeLoanTerm30) loanTerms.push(30)
      const defaultLoanTerm = loanTerms.length > 0 ? loanTerms[0] : 30

      const scenariosToSave: any[] = []

      for (const threshold of calculatePositiveCashFlowThresholds) {
        if (threshold.thresholdValue === null || threshold.thresholdChange === null) continue

        let purchasePrice = askingPrice
        let grossIncome = baseGrossIncome
        let operatingExpenses = baseOperatingExpenses
        let interestRate = avgInterestRate
        let downPaymentPercent = avgDownPayment

        // Set the threshold value for the variable being tested
        switch (threshold.variable) {
          case 'Purchase Price':
            purchasePrice = threshold.thresholdValue
            break
          case 'Gross Income':
            grossIncome = threshold.thresholdValue
            break
          case 'Operating Expenses':
            operatingExpenses = threshold.thresholdValue
            break
          case 'Interest Rate':
            interestRate = threshold.thresholdValue
            break
          case 'Down Payment':
            downPaymentPercent = threshold.thresholdValue
            break
        }

        const noi = grossIncome - operatingExpenses
        const downPaymentAmount = purchasePrice * (downPaymentPercent / 100)
        const loanPrincipal = purchasePrice - downPaymentAmount
        const purchaseClosingCosts = purchasePrice * (closingCostPercentVal / 100)
        const loanClosingCosts = loanPrincipal * (closingCostPercentVal / 100)

        // Calculate monthly mortgage
        const monthlyRate = interestRate / 100 / 12
        const numPayments = defaultLoanTerm * 12
        const monthlyMortgage = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)

        // Calculate first year interest and principal
        let balance = loanPrincipal
        let firstYearInterest = 0
        let firstYearPrincipal = 0
        for (let month = 1; month <= 12; month++) {
          const interestPayment = balance * monthlyRate
          const principalPayment = monthlyMortgage - interestPayment
          firstYearInterest += interestPayment
          firstYearPrincipal += principalPayment > balance ? balance : principalPayment
          balance = Math.max(0, balance - principalPayment)
        }

        const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
        const netIncome = noi - firstYearInterest
        const firstYearCashFlow = netIncome - firstYearPrincipal

        scenariosToSave.push({
          'Scenario Name': `Threshold: ${threshold.variable}`,
          'Purchase Price': purchasePrice,
          'Gross Income': grossIncome,
          'Operating Expenses': operatingExpenses,
          'Cap Rate': capRate,
          'Net Income': netIncome,
          'Income Increase': 0,
          'Expenses Increase': 0,
          'Property Value Increase': 0,
          'Property ID': property.id,
          'Has Loan': true,
          'Loan Term': defaultLoanTerm,
          'Down Payment Percentage': downPaymentPercent,
          'Down Payment Amount': downPaymentAmount,
          'Interest Rate': interestRate,
          'Closing Costs': loanClosingCosts,
          'Purchase Closing Costs': purchaseClosingCosts,
        })
      }

      if (scenariosToSave.length === 0) {
        alert('No positive threshold scenarios to save')
        return
      }

      // Check for duplicates before saving
      const scenarioNames = scenariosToSave.map(s => s['Scenario Name'])
      const { data: existingScenarios } = await supabase
        .from('pi_financial_scenarios')
        .select('id, "Scenario Name", "Purchase Price", "Gross Income", "Operating Expenses", "Down Payment Percentage", "Interest Rate", "Loan Term"')
        .eq('Property ID', property.id)
        .in('Scenario Name', scenarioNames)

      // Filter out duplicates
      const scenariosToInsert = scenariosToSave.filter((scenario: any) => {
        if (!existingScenarios || existingScenarios.length === 0) return true
        
        return !existingScenarios.some((existing: any) => {
          return existing['Scenario Name'] === scenario['Scenario Name'] &&
                 Math.abs(existing['Purchase Price'] - scenario['Purchase Price']) < 0.01 &&
                 Math.abs(existing['Gross Income'] - scenario['Gross Income']) < 0.01 &&
                 Math.abs(existing['Operating Expenses'] - scenario['Operating Expenses']) < 0.01 &&
                 Math.round(existing['Down Payment Percentage'] || 0) === Math.round(scenario['Down Payment Percentage'] || 0) &&
                 Math.abs((existing['Interest Rate'] || 0) - (scenario['Interest Rate'] || 0)) < 0.01 &&
                 existing['Loan Term'] === scenario['Loan Term']
        })
      })

      if (scenariosToInsert.length === 0) {
        alert('All threshold scenarios already exist. No new scenarios to save.')
        return
      }

      if (scenariosToInsert.length < scenariosToSave.length) {
        const skippedCount = scenariosToSave.length - scenariosToInsert.length
        alert(`${skippedCount} duplicate scenario${skippedCount > 1 ? 's' : ''} skipped. Saving ${scenariosToInsert.length} new scenario${scenariosToInsert.length > 1 ? 's' : ''}.`)
      }

      const { data: savedScenarios, error } = await supabase
        .from('pi_financial_scenarios')
        .insert(scenariosToInsert)
        .select()

      if (error) throw error

      // Save loan details for each scenario
      // Map saved scenarios back to their corresponding threshold data
      const savedScenarioMap = new Map(savedScenarios.map((s: any) => [s['Scenario Name'], s]))
      
      for (let i = 0; i < scenariosToInsert.length; i++) {
        const scenario = scenariosToInsert[i]
        const savedScenario = savedScenarioMap.get(scenario['Scenario Name'])
        if (!savedScenario) continue
        
        const thresholdIndex = scenariosToSave.findIndex((s: any) => 
          s['Scenario Name'] === scenario['Scenario Name']
        )
        if (thresholdIndex === -1) continue
        
        const threshold = calculatePositiveCashFlowThresholds[thresholdIndex]
        
        if (threshold.thresholdValue === null) continue

        let purchasePrice = askingPrice
        let downPaymentPercent = avgDownPayment
        let interestRate = avgInterestRate

        switch (threshold.variable) {
          case 'Purchase Price':
            purchasePrice = threshold.thresholdValue
            break
          case 'Interest Rate':
            interestRate = threshold.thresholdValue
            break
          case 'Down Payment':
            downPaymentPercent = threshold.thresholdValue
            break
        }

        // Round down payment percentage to integer since database column is smallint (integer only)
        const roundedDownPaymentPercent = Math.round(downPaymentPercent)
        const downPaymentAmount = purchasePrice * (roundedDownPaymentPercent / 100)
        const loanPrincipal = purchasePrice - downPaymentAmount
        const loanClosingCosts = loanPrincipal * (closingCostPercentVal / 100)

        const monthlyRate = interestRate / 100 / 12
        const numPayments = defaultLoanTerm * 12
        const monthlyMortgage = loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)

        let balance = loanPrincipal
        let firstYearInterest = 0
        let firstYearPrincipal = 0
        for (let month = 1; month <= 12; month++) {
          const interestPayment = balance * monthlyRate
          const principalPayment = monthlyMortgage - interestPayment
          firstYearInterest += interestPayment
          firstYearPrincipal += principalPayment > balance ? balance : principalPayment
          balance = Math.max(0, balance - principalPayment)
        }

        const loanData: any = {
          'Loan Term': defaultLoanTerm,
          'Down Payment Percentage': roundedDownPaymentPercent,
          'Down Payment Amount': downPaymentAmount,
          'Purchase Price': purchasePrice,
          'Interest Rate': interestRate,
          'Monthly Mortgage': monthlyMortgage,
          'Monthly Principle': firstYearPrincipal / 12,
          'Monthly Interest': firstYearInterest / 12,
          'Closing Costs': loanClosingCosts,
          'Annual Mortgage': monthlyMortgage * 12,
          'Annual Principal': firstYearPrincipal,
          'Annual Interest': firstYearInterest,
          'scanario': savedScenario.id,
        }

        await supabase
          .from('pi_loans')
          .insert([loanData])
      }

      alert(`Successfully saved ${scenariosToInsert.length} positive threshold scenario${scenariosToInsert.length > 1 ? 's' : ''}!`)
      router.refresh()
    } catch (error: any) {
      alert(`Failed to save scenarios: ${error.message}`)
    } finally {
      setSavingThresholds(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Model Scenarios</h3>
        <p className="mt-1 text-sm text-gray-600">
          Generated scenarios with varying purchase prices, interest rates, gross income, and operating expenses
        </p>
      </div>
      <div>
        <div className="mb-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Variable Ranges</h3>
              <button
                type="button"
                onClick={() => {
                  // Reset to property baseline (0% changes)
                  setMinInterestRate('4.0')
                  setMaxInterestRate('7.0')
                  setPurchasePriceMinChange('0')
                  setPurchasePriceMaxChange('0')
                  setIncomeMinChange('0')
                  setIncomeMaxChange('0')
                  setExpensesMinChange('0')
                  setExpensesMaxChange('0')
                  setMinDownPayment('25')
                  setMaxDownPayment('25')
                  setClosingCostPercent('3')
                }}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Reset to Property Baseline Values
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label htmlFor="interestRateRange" className="block text-sm font-medium text-gray-700">
                  Interest Rate: {minIntRate}% - {maxIntRate}%
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="interestRateRange"
                    min={0}
                    max={15}
                    step={0.5}
                    value={minIntRate}
                    onChange={(e) => {
                      const newMin = parseFloat(e.target.value)
                      if (newMin <= maxIntRate) {
                        setMinInterestRate(newMin.toFixed(1))
                      }
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={0.5}
                    value={maxIntRate}
                    onChange={(e) => {
                      const newMax = parseFloat(e.target.value)
                      if (newMax >= minIntRate) {
                        setMaxInterestRate(newMax.toFixed(1))
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="purchasePriceRange" className="block text-sm font-medium text-gray-700">
                  Purchase Price Change: {priceMinChange}% - {priceMaxChange}%
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="purchasePriceRange"
                    min={-20}
                    max={5}
                    step={1}
                    value={priceMinChange}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value)
                      if (newMin <= priceMaxChange) {
                        setPurchasePriceMinChange(newMin.toString())
                      }
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={-20}
                    max={5}
                    step={1}
                    value={priceMaxChange}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value)
                      if (newMax >= priceMinChange) {
                        setPurchasePriceMaxChange(newMax.toString())
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="incomeRange" className="block text-sm font-medium text-gray-700">
                  Income Change: {incomeMinChangeVal}% - {incomeMaxChangeVal}%
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="incomeRange"
                    min={-20}
                    max={20}
                    step={1}
                    value={incomeMinChangeVal}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value)
                      if (newMin <= incomeMaxChangeVal) {
                        setIncomeMinChange(newMin.toString())
                      }
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={1}
                    value={incomeMaxChangeVal}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value)
                      if (newMax >= incomeMinChangeVal) {
                        setIncomeMaxChange(newMax.toString())
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="expensesRange" className="block text-sm font-medium text-gray-700">
                  Expenses Change: {expensesMinChangeVal}% - {expensesMaxChangeVal}%
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="expensesRange"
                    min={-20}
                    max={20}
                    step={1}
                    value={expensesMinChangeVal}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value)
                      if (newMin <= expensesMaxChangeVal) {
                        setExpensesMinChange(newMin.toString())
                      }
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={1}
                    value={expensesMaxChangeVal}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value)
                      if (newMax >= expensesMinChangeVal) {
                        setExpensesMaxChange(newMax.toString())
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="downPaymentRange" className="block text-sm font-medium text-gray-700">
                  Down Payment: {minDownPaymentVal}% - {maxDownPaymentVal}%
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="downPaymentRange"
                    min={0}
                    max={50}
                    step={5}
                    value={minDownPaymentVal}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value)
                      if (newMin <= maxDownPaymentVal) {
                        setMinDownPayment(newMin.toString())
                      }
                    }}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={5}
                    value={maxDownPaymentVal}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value)
                      if (newMax >= minDownPaymentVal) {
                        setMaxDownPayment(newMax.toString())
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label htmlFor="closingCostPercent" className="block text-sm font-medium text-gray-700">
                  Closing Costs: {closingCostPercent}% of Purchase Price
                </label>
                <input
                  type="range"
                  id="closingCostPercent"
                  min={0}
                  max={10}
                  step={0.5}
                  value={parseValue(closingCostPercent, 3)}
                  onChange={(e) => {
                    setClosingCostPercent(parseFloat(e.target.value).toFixed(1))
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Break-Even Threshold Analysis</h3>
                <p className="text-sm text-gray-600 mb-3">
                  This analysis shows the <strong>minimum or maximum value</strong> for each variable that would result in <strong>positive first-year cash flow</strong>, 
                  while keeping all other variables at their baseline values. Use this to understand how sensitive your investment is to changes in each factor.
                </p>
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                  <strong>Baseline Values:</strong> Purchase Price = ${askingPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                  Gross Income = ${baseGrossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                  Operating Expenses = ${baseOperatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}, 
                  Interest Rate = {((minIntRate + maxIntRate) / 2).toFixed(1)}%, 
                  Down Payment = {((minDownPaymentVal + maxDownPaymentVal) / 2).toFixed(0)}%, 
                  Loan Term = {(() => {
                    const terms: number[] = []
                    if (includeLoanTerm15) terms.push(15)
                    if (includeLoanTerm20) terms.push(20)
                    if (includeLoanTerm30) terms.push(30)
                    return terms.length > 0 ? terms[0] : 30
                  })()} years
                </div>
              </div>
              <button
                type="button"
                onClick={savePositiveThresholdScenarios}
                disabled={savingThresholds || calculatePositiveCashFlowThresholds.filter(t => t.thresholdValue !== null).length === 0}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed ml-4"
              >
                {savingThresholds ? 'Saving...' : 'Save All Threshold Scenarios'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calculatePositiveCashFlowThresholds.map((result) => {
                const getVariableDescription = () => {
                  switch (result.variable) {
                    case 'Purchase Price':
                      return 'Maximum purchase price that achieves positive cash flow'
                    case 'Gross Income':
                      return 'Minimum gross income needed for positive cash flow'
                    case 'Operating Expenses':
                      return 'Maximum operating expenses allowed for positive cash flow'
                    case 'Interest Rate':
                      return 'Maximum interest rate that achieves positive cash flow'
                    case 'Down Payment':
                      return 'Minimum down payment percentage needed for positive cash flow'
                    default:
                      return ''
                  }
                }

                const getChangeLabel = () => {
                  const isNegative = result.thresholdChange !== null && result.thresholdChange < 0
                  
                  switch (result.variable) {
                    case 'Purchase Price':
                      return isNegative ? '% Decrease from Baseline:' : '% Increase from Baseline:'
                    case 'Gross Income':
                      return isNegative ? '% Decrease from Baseline:' : '% Increase from Baseline:'
                    case 'Operating Expenses':
                      return isNegative ? '% Decrease from Baseline:' : '% Increase from Baseline:'
                    case 'Interest Rate':
                      return 'Interest Rate:'
                    case 'Down Payment':
                      return 'Down Payment:'
                    default:
                      return 'Change from Baseline:'
                  }
                }

                const getValueLabel = () => {
                  switch (result.variable) {
                    case 'Purchase Price':
                      return 'Threshold Purchase Price:'
                    case 'Gross Income':
                      return 'Threshold Gross Income:'
                    case 'Operating Expenses':
                      return 'Threshold Operating Expenses:'
                    case 'Interest Rate':
                      return 'Threshold Interest Rate:'
                    case 'Down Payment':
                      return 'Threshold Down Payment:'
                    default:
                      return 'Value:'
                  }
                }

                return (
                  <div key={result.variable} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900 mb-1">{result.variable}</div>
                        <div className="text-xs text-gray-500 mb-2">{getVariableDescription()}</div>
                      </div>
                      {result.thresholdValue !== null && result.thresholdChange !== null && (
                        <button
                          type="button"
                          onClick={() => saveSingleThresholdScenario(result)}
                          disabled={savingThresholdVariable === result.variable}
                          className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {savingThresholdVariable === result.variable ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                    {result.thresholdChange !== null ? (
                      <>
                        <div className={`text-sm font-medium mb-1 ${result.thresholdChange !== null && result.thresholdChange < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                          {getChangeLabel()}
                        </div>
                        <div className={`text-sm mb-2 ${result.thresholdChange !== null && result.thresholdChange < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {result.variable === 'Interest Rate' || result.variable === 'Down Payment' ? (
                            <>{result.thresholdChange.toFixed(1)}%</>
                          ) : (
                            <>{result.thresholdChange >= 0 ? '+' : ''}{result.thresholdChange.toFixed(1)}%</>
                          )}
                        </div>
                        {result.thresholdValue !== null && (
                          <>
                            <div className="text-sm font-medium text-gray-700 mb-1">
                              {getValueLabel()}
                            </div>
                            <div className={`text-sm ${result.thresholdValue < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {result.variable === 'Interest Rate' || result.variable === 'Down Payment' ? (
                                <>{result.thresholdValue.toFixed(1)}%</>
                              ) : (
                                <>${result.thresholdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-red-600 font-medium">No positive cash flow threshold found within the tested range</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center space-x-2">
                <input
                  id="positiveCashFlowOnly"
                  type="checkbox"
                  checked={positiveCashFlowOnly}
                  onChange={(e) => setPositiveCashFlowOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="positiveCashFlowOnly" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Show positive cash flow only
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="includeLoan"
                  type="checkbox"
                  checked={includeLoan}
                  onChange={(e) => setIncludeLoan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeLoan" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Include Loan
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="includeAllCash"
                  type="checkbox"
                  checked={includeAllCash}
                  onChange={(e) => setIncludeAllCash(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeAllCash" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Include All Cash
                </label>
              </div>
            </div>
            {includeLoan && (
              <div className="flex items-center gap-6 border-t border-gray-200 pt-4">
                <label className="text-sm font-medium text-gray-700">Loan Terms:</label>
                <div className="flex items-center space-x-2">
                  <input
                    id="includeLoanTerm15"
                    type="checkbox"
                    checked={includeLoanTerm15}
                    onChange={(e) => setIncludeLoanTerm15(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeLoanTerm15" className="text-sm font-medium text-gray-700 cursor-pointer">
                    15 years
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="includeLoanTerm20"
                    type="checkbox"
                    checked={includeLoanTerm20}
                    onChange={(e) => setIncludeLoanTerm20(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeLoanTerm20" className="text-sm font-medium text-gray-700 cursor-pointer">
                    20 years
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="includeLoanTerm30"
                    type="checkbox"
                    checked={includeLoanTerm30}
                    onChange={(e) => setIncludeLoanTerm30(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="includeLoanTerm30" className="text-sm font-medium text-gray-700 cursor-pointer">
                    30 years
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label className="text-sm font-medium text-gray-500">Purchase Price Range</label>
              <div className="mt-1 text-sm text-gray-900">
                ${minPurchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${maxPurchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Income Range</label>
              <div className="mt-1 text-sm text-gray-900">
                ${minIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${maxIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Expenses Range</label>
              <div className="mt-1 text-sm text-gray-900">
                ${minExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${maxExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Down Payment Range</label>
              <div className="mt-1 text-sm text-gray-900">
                {minDownPaymentVal}% - {maxDownPaymentVal}%
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex gap-6">
              <div>
                <label className="text-sm font-medium text-gray-500">Minimum Cash Flow</label>
                <div className={`mt-1 text-lg font-semibold ${minCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${minCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Maximum Cash Flow</label>
                <div className={`mt-1 text-lg font-semibold ${maxCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${maxCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('purchasePrice')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Purchase Price</span>
                    <SortIcon column="purchasePrice" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('grossIncome')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Gross Income</span>
                    <SortIcon column="grossIncome" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('operatingExpenses')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Operating Expenses</span>
                    <SortIcon column="operatingExpenses" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[80px] border-r border-gray-200"
                  onClick={() => handleSort('capRate')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Cap Rate</span>
                    <SortIcon column="capRate" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[90px] border-r border-gray-200"
                  onClick={() => handleSort('interestRate')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Interest Rate</span>
                    <SortIcon column="interestRate" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[80px] border-r border-gray-200"
                  onClick={() => handleSort('loanTerm')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Loan Term</span>
                    <SortIcon column="loanTerm" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('downPayment')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Down Payment</span>
                    <SortIcon column="downPayment" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('totalClosingCosts')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Total Closing Costs</span>
                    <SortIcon column="totalClosingCosts" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px] border-r border-gray-200"
                  onClick={() => handleSort('totalCashInvested')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">Total Cash Invested</span>
                    <SortIcon column="totalCashInvested" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[60px] border-r border-gray-200"
                  onClick={() => handleSort('grm')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">GRM</span>
                    <SortIcon column="grm" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[60px] border-r border-gray-200"
                  onClick={() => handleSort('dscr')}
                >
                  <div className="flex items-center justify-end flex-wrap gap-1">
                    <span className="whitespace-normal">DSCR</span>
                    <SortIcon column="dscr" />
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[110px] border-r border-gray-200"
                  onClick={() => handleSort('firstYearCashFlow')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end flex-wrap gap-1">
                          <span className="whitespace-normal">Year 1 Cash Flow</span>
                          <SortIcon column="firstYearCashFlow" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">
                          Cash Flow = Net Income - Principal<br/>
                          Net Income = NOI - Interest (if loan)<br/>
                          NOI = Gross Income - Operating Expenses
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th 
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700 cursor-pointer hover:bg-gray-100 select-none min-w-[100px]"
                  onClick={() => handleSort('firstYearCoCR')}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end flex-wrap gap-1">
                          <span className="whitespace-normal">Year 1 CoCR</span>
                          <SortIcon column="firstYearCoCR" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-sm">
                          Cash on Cash Return = (Cash Flow / Total Cash Invested) × 100%<br/>
                          Total Cash Invested = Down Payment + Closing Costs (with loan)<br/>
                          Total Cash Invested = Purchase Price + Closing Costs (no loan)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-700 min-w-[80px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedScenarios.map((scenario) => {
                const purchasePriceChange = askingPrice > 0 ? ((scenario.purchasePrice - askingPrice) / askingPrice) * 100 : 0
                const incomeChange = baseGrossIncome > 0 ? ((scenario.grossIncome - baseGrossIncome) / baseGrossIncome) * 100 : 0
                const expensesChange = baseOperatingExpenses > 0 ? ((scenario.operatingExpenses - baseOperatingExpenses) / baseOperatingExpenses) * 100 : 0
                
                return (
                <tr key={scenario.id} className="hover:bg-blue-50 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                    <div className="font-semibold">${scenario.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className={`text-xs mt-0.5 ${purchasePriceChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>{purchasePriceChange >= 0 ? '+' : ''}{purchasePriceChange.toFixed(1)}%</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                    <div className="font-semibold">${scenario.grossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className={`text-xs mt-0.5 ${incomeChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>{incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(1)}%</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900 border-r border-gray-200">
                    <div className="font-semibold">${scenario.operatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <div className={`text-xs mt-0.5 ${expensesChange < 0 ? 'text-red-600' : 'text-gray-500'}`}>{expensesChange >= 0 ? '+' : ''}{expensesChange.toFixed(1)}%</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900 border-r border-gray-200">
                    {scenario.capRate.toFixed(2)}%
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    {scenario.interestRate !== null ? `${scenario.interestRate.toFixed(2)}%` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    {scenario.loanTerm !== null ? `${scenario.loanTerm} yrs` : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    {scenario.downPaymentAmount !== null ? (
                      <>
                        <div className="font-semibold">${scenario.downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{scenario.downPaymentPercent}%</div>
                      </>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    ${scenario.totalClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900 border-r border-gray-200">
                    ${scenario.totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    {scenario.grm > 0 ? scenario.grm.toFixed(2) + 'x' : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700 border-r border-gray-200">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help font-semibold">
                            {scenario.dscr !== null ? scenario.dscr.toFixed(2) + 'x' : <span className="text-gray-400">-</span>}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            DSCR = NOI / Annual Mortgage<br/>
                            NOI = ${scenario.grossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${scenario.operatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                            {scenario.annualMortgage !== null ? (
                              <>Annual Mortgage = ${scenario.annualMortgage.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                              DSCR = ${scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${scenario.annualMortgage.toLocaleString(undefined, { maximumFractionDigits: 0 })} = {scenario.dscr?.toFixed(2)}x</>
                            ) : 'No loan'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-bold border-r border-gray-200 ${scenario.firstYearCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            ${scenario.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            {scenario.hasLoan ? (
                              <>
                                Cash Flow = Net Income - Principal<br/>
                                Net Income = NOI - Interest<br/>
                                NOI = ${scenario.grossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${scenario.operatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                                Interest = ${scenario.firstYearInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                                Net Income = ${scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${scenario.firstYearInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${(scenario.noi - scenario.firstYearInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                                Principal = ${scenario.firstYearPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                                Cash Flow = ${(scenario.noi - scenario.firstYearInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${scenario.firstYearPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </>
                            ) : (
                              <>
                                Cash Flow = NOI (no loan)<br/>
                                NOI = ${scenario.grossIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} - ${scenario.operatingExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                                Cash Flow = ${scenario.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </>
                            )}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-bold ${scenario.firstYearCoCR >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {scenario.firstYearCoCR.toFixed(2)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            CoCR = (Cash Flow / Total Cash Invested) × 100%<br/>
                            Cash Flow = ${scenario.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                            {scenario.hasLoan ? (
                              <>
                                Total Cash Invested = Down Payment + Loan Closing Costs + Purchase Closing Costs<br/>
                                Total Cash Invested = ${scenario.downPaymentAmount?.toLocaleString(undefined, { maximumFractionDigits: 0 })} + ${scenario.loanClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })} + ${scenario.purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                              </>
                            ) : (
                              <>
                                Total Cash Invested = Purchase Price + Purchase Closing Costs<br/>
                                Total Cash Invested = ${scenario.purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} + ${scenario.purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })} = ${scenario.totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                              </>
                            )}
                            CoCR = (${scenario.firstYearCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${scenario.totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}) × 100% = {scenario.firstYearCoCR.toFixed(2)}%
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        const scenarioName = prompt('Enter a name for this scenario:', `Model Scenario ${scenario.id}`)
                        if (scenarioName) {
                          saveScenario(scenario, scenarioName)
                        }
                      }}
                      disabled={savingScenarioId === scenario.id}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingScenarioId === scenario.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

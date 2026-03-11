'use client'

import React, { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  DEFAULT_INTEREST_RATE_MIN, DEFAULT_INTEREST_RATE_MAX,
  DEFAULT_DOWN_PAYMENT_PCT, DEFAULT_DOWN_PAYMENT_MIN, DEFAULT_DOWN_PAYMENT_MAX,
  DEFAULT_CLOSING_COST_PCT, LOAN_TERMS, DEFAULT_LOAN_TERM,
  DEFAULT_PRICE_CHANGE_MIN, DEFAULT_PRICE_CHANGE_MAX,
  DEFAULT_INCOME_CHANGE_MIN, DEFAULT_INCOME_CHANGE_MAX,
  DEFAULT_EXPENSE_CHANGE_MIN, DEFAULT_EXPENSE_CHANGE_MAX,
  SLIDER_RANGE_MIN, SLIDER_RANGE_MAX_PRICE, SLIDER_RANGE_MAX_INCOME_EXPENSE,
  MAX_INTEREST_RATE_SLIDER, MAX_DOWN_PAYMENT_SLIDER,
  DEFAULT_ASKING_PRICE, DEFAULT_GROSS_INCOME, DEFAULT_OPERATING_EXPENSES,
  DEFAULT_ANALYSIS_INTEREST_RATE, DEFAULT_EXPENSE_RATIO,
  SCENARIO_COMPARISON_TOLERANCE, THRESHOLD_ANALYSIS_STEP, SLIDER_STEP,
  THRESHOLD_ANALYSIS_RANGE, THRESHOLD_ANALYSIS_MAX_RATE,
  MONTHS_PER_YEAR,
} from '@/lib/constants/property-defaults'
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react'

interface Property {
  id: number
  'Asking Price': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  estimated_rent?: number | null
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

const fmt$ = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

function parseValue(value: string, defaultValue: number): number {
  if (value === '' || value === null || value === undefined) return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

function annualizePropertyIncome(property: Property): number {
  const monthlyGross = property['Gross Income'] || 0
  const monthlyRent = property.estimated_rent || 0
  const income = monthlyGross > 0 ? monthlyGross : monthlyRent
  return income > 0 ? income * MONTHS_PER_YEAR : DEFAULT_GROSS_INCOME
}

function annualizePropertyExpenses(property: Property): number {
  const monthly = property['Operating Expenses'] || 0
  return monthly > 0 ? monthly * MONTHS_PER_YEAR : DEFAULT_OPERATING_EXPENSES
}

function calculateLoanCashFlow(
  purchasePrice: number,
  annualNoi: number,
  interestRate: number,
  downPaymentPercent: number,
  loanTerm: number,
  closingCostPct: number,
) {
  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100)
  const loanPrincipal = purchasePrice - downPaymentAmount
  const monthlyRate = interestRate / 100 / 12
  const numPayments = loanTerm * 12
  const monthlyMortgage = loanPrincipal > 0 && monthlyRate > 0
    ? loanPrincipal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0
  const annualMortgage = monthlyMortgage * 12

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

  const purchaseClosingCosts = purchasePrice * (closingCostPct / 100)
  const loanClosingCosts = loanPrincipal * (closingCostPct / 100)
  const totalClosingCosts = purchaseClosingCosts + loanClosingCosts
  const totalCashInvested = downPaymentAmount + purchaseClosingCosts

  const annualDebtService = annualMortgage
  const firstYearCashFlow = annualNoi - annualDebtService
  const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0
  const capRate = purchasePrice > 0 ? (annualNoi / purchasePrice) * 100 : 0
  const dscr = annualMortgage > 0 ? annualNoi / annualMortgage : null
  const grm = annualNoi > 0 ? purchasePrice / annualNoi : 0

  return {
    downPaymentAmount, loanPrincipal, monthlyMortgage, annualMortgage,
    firstYearInterest, firstYearPrincipal, purchaseClosingCosts,
    loanClosingCosts, totalClosingCosts, totalCashInvested,
    firstYearCashFlow, firstYearCoCR, capRate, dscr, grm,
  }
}

export default function RecommendedScenariosList({ property }: RecommendedScenariosListProps) {
  const router = useRouter()
  const supabase = createClient()

  const [minInterestRate, setMinInterestRate] = useState(String(DEFAULT_INTEREST_RATE_MIN))
  const [maxInterestRate, setMaxInterestRate] = useState(String(DEFAULT_INTEREST_RATE_MAX))
  const [purchasePriceMinChange, setPurchasePriceMinChange] = useState(String(SLIDER_RANGE_MIN))
  const [purchasePriceMaxChange, setPurchasePriceMaxChange] = useState('5')
  const [incomeMinChange, setIncomeMinChange] = useState(String(SLIDER_RANGE_MIN))
  const [incomeMaxChange, setIncomeMaxChange] = useState(String(SLIDER_RANGE_MAX_INCOME_EXPENSE))
  const [expensesMinChange, setExpensesMinChange] = useState(String(SLIDER_RANGE_MIN))
  const [expensesMaxChange, setExpensesMaxChange] = useState(String(SLIDER_RANGE_MAX_INCOME_EXPENSE))
  const [minDownPayment, setMinDownPayment] = useState(String(DEFAULT_DOWN_PAYMENT_PCT))
  const [maxDownPayment, setMaxDownPayment] = useState(String(DEFAULT_DOWN_PAYMENT_PCT))
  const [closingCostPercent, setClosingCostPercent] = useState(String(DEFAULT_CLOSING_COST_PCT))
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
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [pendingScenarioName, setPendingScenarioName] = useState('')
  const pendingSaveRef = useRef<{ scenario: any } | null>(null)
  const [explorerOpen, setExplorerOpen] = useState(false)

  const askingPrice = property['Asking Price'] || DEFAULT_ASKING_PRICE
  const monthlyRent = property.estimated_rent || property['Gross Income'] || 0
  const monthlyExpenses = property['Operating Expenses'] || 0
  const baseGrossIncome = annualizePropertyIncome(property)
  const baseOperatingExpenses = annualizePropertyExpenses(property)

  const currentSummary = useMemo(() => {
    const monthlyGross = property['Gross Income'] || 0
    const monthlyExp = property['Operating Expenses'] || 0
    const estRent = property.estimated_rent || 0
    const hasActuals = monthlyGross > 0
    const annualNoi = hasActuals
      ? (monthlyGross - monthlyExp) * MONTHS_PER_YEAR
      : 0
    const estAnnualNoi = hasActuals
      ? annualNoi
      : estRent > 0 && monthlyExp > 0
        ? (estRent - monthlyExp) * MONTHS_PER_YEAR
        : estRent > 0
          ? estRent * MONTHS_PER_YEAR * (1 - DEFAULT_EXPENSE_RATIO)
          : monthlyExp > 0
            ? -monthlyExp * MONTHS_PER_YEAR
            : 0
    const noiForCalcs = hasActuals ? annualNoi : estAnnualNoi

    const downPct = DEFAULT_DOWN_PAYMENT_PCT / 100
    const downPayment = askingPrice > 0 ? askingPrice * downPct : 0
    const closingCosts = askingPrice * (DEFAULT_CLOSING_COST_PCT / 100)
    const cashInvested = downPayment + closingCosts
    const loanAmount = askingPrice * (1 - downPct)
    let annualDebt = 0
    if (loanAmount > 0) {
      const monthlyRate = DEFAULT_ANALYSIS_INTEREST_RATE / 100 / MONTHS_PER_YEAR
      const numPayments = DEFAULT_LOAN_TERM * MONTHS_PER_YEAR
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      annualDebt = monthlyPayment * MONTHS_PER_YEAR
    }
    const annualCashFlow = noiForCalcs - annualDebt
    const roi = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0
    const capRate = askingPrice > 0 && noiForCalcs > 0 ? (noiForCalcs / askingPrice) * 100 : 0

    return {
      noi: noiForCalcs, annualNoi, estAnnualNoi, capRate, roi,
      firstYearCashFlow: annualCashFlow, firstYearCoCR: roi,
      cashInvested, annualDebt, downPayment,
    }
  }, [property, askingPrice])

  const handleSaveClick = (scenario: any) => {
    pendingSaveRef.current = { scenario }
    setPendingScenarioName(`Model Scenario ${scenario.id}`)
    setNameDialogOpen(true)
  }
  const handleNameConfirm = () => {
    if (pendingSaveRef.current && pendingScenarioName.trim()) {
      saveScenario(pendingSaveRef.current.scenario, pendingScenarioName.trim())
    }
    setNameDialogOpen(false)
    pendingSaveRef.current = null
  }

  // ── Parsed slider values ──
  const minIntRate = parseValue(minInterestRate, DEFAULT_INTEREST_RATE_MIN)
  const maxIntRate = parseValue(maxInterestRate, DEFAULT_INTEREST_RATE_MAX)
  const priceMinChange = parseValue(purchasePriceMinChange, DEFAULT_PRICE_CHANGE_MIN)
  const priceMaxChange = parseValue(purchasePriceMaxChange, DEFAULT_PRICE_CHANGE_MAX)
  const incomeMinChangeVal = parseValue(incomeMinChange, DEFAULT_INCOME_CHANGE_MIN)
  const incomeMaxChangeVal = parseValue(incomeMaxChange, DEFAULT_INCOME_CHANGE_MAX)
  const expensesMinChangeVal = parseValue(expensesMinChange, DEFAULT_EXPENSE_CHANGE_MIN)
  const expensesMaxChangeVal = parseValue(expensesMaxChange, DEFAULT_EXPENSE_CHANGE_MAX)
  const minDownPaymentVal = parseValue(minDownPayment, DEFAULT_DOWN_PAYMENT_MIN)
  const maxDownPaymentVal = parseValue(maxDownPayment, DEFAULT_DOWN_PAYMENT_MAX)
  // ── Break-even threshold analysis (uses same defaults as Section A) ──
  const baselineRate = DEFAULT_ANALYSIS_INTEREST_RATE
  const baselineDownPct = DEFAULT_DOWN_PAYMENT_PCT
  const baselineLoanTerm = DEFAULT_LOAN_TERM
  const baselineClosingPct = DEFAULT_CLOSING_COST_PCT

  const thresholds = useMemo(() => {
    const calcCf = (priceChg: number, incomeChg: number, expChg: number, rate: number, dp: number) => {
      const price = askingPrice * (1 + priceChg / 100)
      const income = baseGrossIncome * (1 + incomeChg / 100)
      const expenses = baseOperatingExpenses * (1 + expChg / 100)
      const noi = income - expenses
      const r = calculateLoanCashFlow(price, noi, rate, dp, baselineLoanTerm, baselineClosingPct)
      return r.firstYearCashFlow
    }

    const results: { variable: string; label: string; description: string; thresholdValue: number | null; thresholdChange: number | null; currentValue: number; meetsThreshold: boolean }[] = []

    // Purchase Price
    let priceThreshold: number | null = null
    for (let change = THRESHOLD_ANALYSIS_RANGE; change >= -THRESHOLD_ANALYSIS_RANGE; change -= THRESHOLD_ANALYSIS_STEP) {
      if (calcCf(change, 0, 0, baselineRate, baselineDownPct) >= 0) { priceThreshold = change; break }
    }
    results.push({
      variable: 'Purchase Price', label: 'Purchase Price',
      description: 'Maximum purchase price for positive cash flow',
      thresholdValue: priceThreshold !== null ? askingPrice * (1 + priceThreshold / 100) : null,
      thresholdChange: priceThreshold,
      currentValue: askingPrice,
      meetsThreshold: priceThreshold !== null && priceThreshold >= 0,
    })

    // Monthly Rent
    let incomeThreshold: number | null = null
    for (let change = -THRESHOLD_ANALYSIS_RANGE; change <= THRESHOLD_ANALYSIS_RANGE; change += THRESHOLD_ANALYSIS_STEP) {
      if (calcCf(0, change, 0, baselineRate, baselineDownPct) >= 0) { incomeThreshold = change; break }
    }
    results.push({
      variable: 'Gross Income', label: 'Monthly Rent',
      description: 'Minimum monthly rent for positive cash flow',
      thresholdValue: incomeThreshold !== null ? baseGrossIncome * (1 + incomeThreshold / 100) : null,
      thresholdChange: incomeThreshold,
      currentValue: baseGrossIncome,
      meetsThreshold: incomeThreshold !== null && incomeThreshold <= 0,
    })

    // Monthly Expenses
    let expThreshold: number | null = null
    for (let change = THRESHOLD_ANALYSIS_RANGE; change >= -THRESHOLD_ANALYSIS_RANGE; change -= THRESHOLD_ANALYSIS_STEP) {
      if (calcCf(0, 0, change, baselineRate, baselineDownPct) >= 0) { expThreshold = change; break }
    }
    results.push({
      variable: 'Operating Expenses', label: 'Monthly Expenses',
      description: 'Maximum monthly expenses for positive cash flow',
      thresholdValue: expThreshold !== null ? baseOperatingExpenses * (1 + expThreshold / 100) : null,
      thresholdChange: expThreshold,
      currentValue: baseOperatingExpenses,
      meetsThreshold: expThreshold !== null && expThreshold >= 0,
    })

    // Interest Rate
    let rateThreshold: number | null = null
    for (let rate = THRESHOLD_ANALYSIS_MAX_RATE; rate >= 0; rate -= THRESHOLD_ANALYSIS_STEP) {
      if (calcCf(0, 0, 0, rate, baselineDownPct) >= 0) { rateThreshold = rate; break }
    }
    results.push({
      variable: 'Interest Rate', label: 'Interest Rate',
      description: 'Maximum interest rate for positive cash flow',
      thresholdValue: rateThreshold, thresholdChange: rateThreshold,
      currentValue: baselineRate,
      meetsThreshold: rateThreshold !== null && rateThreshold >= baselineRate,
    })

    // Down Payment
    let dpThreshold: number | null = null
    for (let dp = 0; dp <= MAX_DOWN_PAYMENT_SLIDER; dp += THRESHOLD_ANALYSIS_STEP) {
      if (calcCf(0, 0, 0, baselineRate, dp) >= 0) { dpThreshold = dp; break }
    }
    results.push({
      variable: 'Down Payment', label: 'Down Payment',
      description: 'Minimum down payment for positive cash flow',
      thresholdValue: dpThreshold, thresholdChange: dpThreshold,
      currentValue: baselineDownPct,
      meetsThreshold: dpThreshold !== null && dpThreshold <= baselineDownPct,
    })

    return results
  }, [askingPrice, baseGrossIncome, baseOperatingExpenses, baselineRate, baselineDownPct, baselineLoanTerm, baselineClosingPct])

  // ── Cartesian product scenarios ──
  const scenarios = useMemo(() => {
    const closingPct = parseValue(closingCostPercent, DEFAULT_CLOSING_COST_PCT)
    const generatedScenarios: Scenario[] = []
    let scenarioId = 1

    const purchasePriceMultipliers = priceMinChange === priceMaxChange
      ? [1 + (priceMinChange / 100)]
      : [1 + (priceMinChange / 100), 1 + (priceMaxChange / 100)]
    const interestRates = minIntRate === maxIntRate ? [minIntRate] : [minIntRate, maxIntRate]
    const grossIncomeMultipliers = incomeMinChangeVal === incomeMaxChangeVal
      ? [1 + (incomeMinChangeVal / 100)]
      : [1 + (incomeMinChangeVal / 100), 1 + (incomeMaxChangeVal / 100)]
    const operatingExpensesMultipliers = expensesMinChangeVal === expensesMaxChangeVal
      ? [1 + (expensesMinChangeVal / 100)]
      : [1 + (expensesMinChangeVal / 100), 1 + (expensesMaxChangeVal / 100)]
    const downPaymentPercents = minDownPaymentVal === maxDownPaymentVal
      ? [minDownPaymentVal]
      : [minDownPaymentVal, maxDownPaymentVal]

    const loanTerms: number[] = []
    if (includeLoanTerm15) loanTerms.push(LOAN_TERMS[0])
    if (includeLoanTerm20) loanTerms.push(LOAN_TERMS[1])
    if (includeLoanTerm30) loanTerms.push(LOAN_TERMS[2])

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
                const r = calculateLoanCashFlow(purchasePrice, noi, intRate, downPaymentPercent, loanTerm, closingPct)
                const ltv = purchasePrice > 0 ? ((purchasePrice - r.downPaymentAmount) / purchasePrice) * 100 : null

                generatedScenarios.push({
                  id: scenarioId++,
                  name: `Scenario ${scenarioId - 1}`,
                  purchasePrice, grossIncome, operatingExpenses, noi,
                  capRate: r.capRate, hasLoan: true, interestRate: intRate,
                  downPaymentPercent, downPaymentAmount: r.downPaymentAmount,
                  loanTerm, loanPrincipal: r.loanPrincipal,
                  monthlyMortgage: r.monthlyMortgage, annualMortgage: r.annualMortgage,
                  firstYearInterest: r.firstYearInterest, firstYearPrincipal: r.firstYearPrincipal,
                  loanClosingCosts: r.loanClosingCosts, purchaseClosingCosts: r.purchaseClosingCosts,
                  totalClosingCosts: r.totalClosingCosts, totalCashInvested: r.totalCashInvested,
                  grm: r.grm, dscr: r.dscr, ltv,
                  firstYearCashFlow: r.firstYearCashFlow, firstYearCoCR: r.firstYearCoCR,
                })
              }
            }
          }
        }
      }
    }

    for (const priceMult of purchasePriceMultipliers) {
      for (const incomeMult of grossIncomeMultipliers) {
        for (const expMult of operatingExpensesMultipliers) {
          const purchasePrice = askingPrice * priceMult
          const grossIncome = baseGrossIncome * incomeMult
          const operatingExpenses = baseOperatingExpenses * expMult
          const noi = grossIncome - operatingExpenses
          const purchaseClosingCosts = purchasePrice * (closingPct / 100)
          const totalCashInvested = purchasePrice + purchaseClosingCosts
          const capRate = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
          const grm = grossIncome > 0 ? purchasePrice / grossIncome : 0
          const firstYearCashFlow = noi
          const firstYearCoCR = totalCashInvested > 0 ? (firstYearCashFlow / totalCashInvested) * 100 : 0

          generatedScenarios.push({
            id: scenarioId++, name: `Scenario ${scenarioId - 1} (No Loan)`,
            purchasePrice, grossIncome, operatingExpenses, noi, capRate,
            hasLoan: false, interestRate: null, downPaymentPercent: null,
            downPaymentAmount: null, loanTerm: null, loanPrincipal: null,
            monthlyMortgage: null, annualMortgage: null,
            firstYearInterest: 0, firstYearPrincipal: 0,
            loanClosingCosts: 0, purchaseClosingCosts, totalClosingCosts: purchaseClosingCosts,
            totalCashInvested, grm, dscr: null, ltv: null,
            firstYearCashFlow, firstYearCoCR,
          })
        }
      }
    }

    let filtered = generatedScenarios
    if (!includeLoan && !includeAllCash) filtered = []
    else if (!includeLoan) filtered = filtered.filter(s => !s.hasLoan)
    else if (!includeAllCash) filtered = filtered.filter(s => s.hasLoan)
    if (positiveCashFlowOnly) filtered = filtered.filter(s => s.firstYearCashFlow >= 0)
    return filtered
  }, [askingPrice, baseGrossIncome, baseOperatingExpenses, priceMinChange, priceMaxChange, minIntRate, maxIntRate, incomeMinChangeVal, incomeMaxChangeVal, expensesMinChangeVal, expensesMaxChangeVal, minDownPaymentVal, maxDownPaymentVal, closingCostPercent, includeLoanTerm15, includeLoanTerm20, includeLoanTerm30, positiveCashFlowOnly, includeLoan, includeAllCash])

  const sortedScenarios = useMemo(() => {
    if (!sortColumn) return scenarios
    return [...scenarios].sort((a, b) => {
      let aV = 0, bV = 0
      switch (sortColumn) {
        case 'purchasePrice': aV = a.purchasePrice; bV = b.purchasePrice; break
        case 'grossIncome': aV = a.grossIncome; bV = b.grossIncome; break
        case 'operatingExpenses': aV = a.operatingExpenses; bV = b.operatingExpenses; break
        case 'capRate': aV = a.capRate; bV = b.capRate; break
        case 'interestRate': aV = a.interestRate ?? 0; bV = b.interestRate ?? 0; break
        case 'downPayment': aV = a.downPaymentAmount ?? 0; bV = b.downPaymentAmount ?? 0; break
        case 'totalCashInvested': aV = a.totalCashInvested; bV = b.totalCashInvested; break
        case 'dscr': aV = a.dscr ?? 0; bV = b.dscr ?? 0; break
        case 'firstYearCashFlow': aV = a.firstYearCashFlow; bV = b.firstYearCashFlow; break
        case 'firstYearCoCR': aV = a.firstYearCoCR; bV = b.firstYearCoCR; break
        case 'loanTerm': aV = a.loanTerm ?? 0; bV = b.loanTerm ?? 0; break
        default: return 0
      }
      return sortDirection === 'asc' ? aV - bV : bV - aV
    })
  }, [scenarios, sortColumn, sortDirection])

  const handleSort = (column: string) => {
    if (sortColumn === column) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(column); setSortDirection('desc') }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
  }

  // ── Save functions ──
  const saveScenario = async (scenario: Scenario, scenarioName?: string) => {
    setSavingScenarioId(scenario.id)
    try {
      const closingPct = parseValue(closingCostPercent, DEFAULT_CLOSING_COST_PCT)
      const purchaseClosingCosts = scenario.purchasePrice * (closingPct / 100)
      const loanClosingCosts = scenario.hasLoan && scenario.loanPrincipal
        ? scenario.loanPrincipal * (closingPct / 100) : 0

      const scenarioData: any = {
        'Scenario Name': scenarioName || `Model Scenario ${scenario.id}`,
        'Purchase Price': scenario.purchasePrice,
        'Gross Income': scenario.grossIncome,
        'Operating Expenses': scenario.operatingExpenses,
        'Cap Rate': scenario.capRate,
        'Net Income': scenario.hasLoan ? scenario.noi - scenario.firstYearInterest : scenario.noi,
        'Income Increase': 0, 'Expenses Increase': 0, 'Property Value Increase': 0,
        'Property ID': property.id,
        'Has Loan': scenario.hasLoan,
        'Loan Term': scenario.hasLoan && scenario.loanTerm ? scenario.loanTerm : null,
        'Down Payment Percentage': scenario.hasLoan && scenario.downPaymentPercent ? scenario.downPaymentPercent : null,
        'Down Payment Amount': scenario.hasLoan && scenario.downPaymentAmount ? scenario.downPaymentAmount : null,
        'Interest Rate': scenario.hasLoan && scenario.interestRate ? scenario.interestRate : null,
        'Closing Costs': scenario.hasLoan ? loanClosingCosts : null,
        'Purchase Closing Costs': purchaseClosingCosts,
      }

      const { data, error } = await supabase.from('pi_financial_scenarios').insert([scenarioData]).select().single()
      if (error) throw error

      if (scenario.hasLoan && scenario.loanTerm && scenario.interestRate && scenario.monthlyMortgage) {
        await supabase.from('pi_loans').insert([{
          'Loan Term': scenario.loanTerm,
          'Down Payment Percentage': scenario.downPaymentPercent,
          'Down Payment Amount': scenario.downPaymentAmount,
          'Purchase Price': scenario.purchasePrice,
          'Interest Rate': scenario.interestRate,
          'Monthly Mortgage': scenario.monthlyMortgage,
          'Monthly Principal': scenario.firstYearPrincipal / 12,
          'Monthly Interest': scenario.firstYearInterest / 12,
          'Closing Costs': loanClosingCosts,
          'Annual Mortgage': scenario.monthlyMortgage * 12,
          'Annual Principal': scenario.firstYearPrincipal,
          'Annual Interest': scenario.firstYearInterest,
          'scenario_id': data.id,
        }])
      }
      toast.success(`Scenario "${scenarioData['Scenario Name']}" saved!`)
      router.refresh()
    } catch (error: any) {
      toast.error(`Failed to save scenario: ${error.message}`)
    } finally {
      setSavingScenarioId(null)
    }
  }

  const saveSingleThresholdScenario = async (threshold: { variable: string; thresholdValue: number | null; thresholdChange: number | null }) => {
    if (threshold.thresholdValue === null) { toast.error('No valid threshold found'); return }
    setSavingThresholdVariable(threshold.variable)
    try {
      let purchasePrice = askingPrice
      let grossIncome = baseGrossIncome
      let operatingExpenses = baseOperatingExpenses
      let interestRate = baselineRate
      let downPaymentPercent = baselineDownPct

      switch (threshold.variable) {
        case 'Purchase Price': purchasePrice = threshold.thresholdValue; break
        case 'Gross Income': grossIncome = threshold.thresholdValue; break
        case 'Operating Expenses': operatingExpenses = threshold.thresholdValue; break
        case 'Interest Rate': interestRate = threshold.thresholdValue; break
        case 'Down Payment': downPaymentPercent = threshold.thresholdValue; break
      }

      const noi = grossIncome - operatingExpenses
      const r = calculateLoanCashFlow(purchasePrice, noi, interestRate, downPaymentPercent, baselineLoanTerm, baselineClosingPct)
      const roundedDp = Math.round(downPaymentPercent)

      const scenarioData: any = {
        'Scenario Name': `Threshold: ${threshold.variable}`,
        'Purchase Price': purchasePrice, 'Gross Income': grossIncome, 'Operating Expenses': operatingExpenses,
        'Cap Rate': r.capRate, 'Net Income': noi - r.firstYearInterest,
        'Income Increase': 0, 'Expenses Increase': 0, 'Property Value Increase': 0,
        'Property ID': property.id, 'Has Loan': true,
        'Loan Term': baselineLoanTerm, 'Down Payment Percentage': roundedDp,
        'Down Payment Amount': r.downPaymentAmount, 'Interest Rate': interestRate,
        'Closing Costs': r.loanClosingCosts, 'Purchase Closing Costs': r.purchaseClosingCosts,
      }

      const { data: existing } = await supabase
        .from('pi_financial_scenarios')
        .select('id, "Scenario Name", "Purchase Price", "Gross Income", "Operating Expenses", "Down Payment Percentage", "Interest Rate", "Loan Term"')
        .eq('Property ID', property.id).eq('Scenario Name', scenarioData['Scenario Name'])
      if (existing?.some((e: any) =>
        Math.abs(e['Purchase Price'] - purchasePrice) < SCENARIO_COMPARISON_TOLERANCE &&
        Math.abs(e['Gross Income'] - grossIncome) < SCENARIO_COMPARISON_TOLERANCE &&
        Math.abs(e['Operating Expenses'] - operatingExpenses) < SCENARIO_COMPARISON_TOLERANCE
      )) { toast.error('Duplicate scenario exists'); return }

      const { data: saved, error } = await supabase.from('pi_financial_scenarios').insert([scenarioData]).select().single()
      if (error) throw error

      await supabase.from('pi_loans').insert([{
        'Loan Term': baselineLoanTerm, 'Down Payment Percentage': roundedDp,
        'Down Payment Amount': r.downPaymentAmount, 'Purchase Price': purchasePrice,
        'Interest Rate': interestRate, 'Monthly Mortgage': r.monthlyMortgage,
        'Monthly Principal': r.firstYearPrincipal / 12, 'Monthly Interest': r.firstYearInterest / 12,
        'Closing Costs': r.loanClosingCosts, 'Annual Mortgage': r.annualMortgage,
        'Annual Principal': r.firstYearPrincipal, 'Annual Interest': r.firstYearInterest,
        'scenario_id': saved.id,
      }])

      toast.success(`Threshold scenario saved!`)
      router.refresh()
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`)
    } finally {
      setSavingThresholdVariable(null)
    }
  }

  const savePositiveThresholdScenarios = async () => {
    setSavingThresholds(true)
    try {
      const toSave: any[] = []
      for (const t of thresholds) {
        if (t.thresholdValue === null) continue
        let pp = askingPrice, gi = baseGrossIncome, oe = baseOperatingExpenses, ir = baselineRate, dp = baselineDownPct
        switch (t.variable) {
          case 'Purchase Price': pp = t.thresholdValue; break
          case 'Gross Income': gi = t.thresholdValue; break
          case 'Operating Expenses': oe = t.thresholdValue; break
          case 'Interest Rate': ir = t.thresholdValue; break
          case 'Down Payment': dp = t.thresholdValue; break
        }
        const noi = gi - oe
        const r = calculateLoanCashFlow(pp, noi, ir, dp, baselineLoanTerm, baselineClosingPct)
        toSave.push({
          scenario: { 'Scenario Name': `Threshold: ${t.variable}`, 'Purchase Price': pp, 'Gross Income': gi, 'Operating Expenses': oe,
            'Cap Rate': r.capRate, 'Net Income': noi - r.firstYearInterest, 'Income Increase': 0, 'Expenses Increase': 0,
            'Property Value Increase': 0, 'Property ID': property.id, 'Has Loan': true, 'Loan Term': baselineLoanTerm,
            'Down Payment Percentage': Math.round(dp), 'Down Payment Amount': r.downPaymentAmount, 'Interest Rate': ir,
            'Closing Costs': r.loanClosingCosts, 'Purchase Closing Costs': r.purchaseClosingCosts },
          loan: { pp, dp, ir, r, lt: baselineLoanTerm },
        })
      }
      if (toSave.length === 0) { toast.error('No thresholds to save'); return }

      const names = toSave.map(s => s.scenario['Scenario Name'])
      const { data: existing } = await supabase.from('pi_financial_scenarios')
        .select('id, "Scenario Name", "Purchase Price", "Gross Income", "Operating Expenses"')
        .eq('Property ID', property.id).in('Scenario Name', names)
      const toInsert = toSave.filter(s => !(existing?.some((e: any) =>
        e['Scenario Name'] === s.scenario['Scenario Name'] &&
        Math.abs(e['Purchase Price'] - s.scenario['Purchase Price']) < SCENARIO_COMPARISON_TOLERANCE &&
        Math.abs(e['Gross Income'] - s.scenario['Gross Income']) < SCENARIO_COMPARISON_TOLERANCE
      )))
      if (toInsert.length === 0) { toast.info('All thresholds already saved'); return }

      const { data: saved, error } = await supabase.from('pi_financial_scenarios').insert(toInsert.map(s => s.scenario)).select()
      if (error) throw error

      for (const s of saved) {
        const match = toInsert.find(t => t.scenario['Scenario Name'] === s['Scenario Name'])
        if (!match) continue
        const { pp, dp, ir, r, lt } = match.loan
        await supabase.from('pi_loans').insert([{
          'Loan Term': lt, 'Down Payment Percentage': Math.round(dp),
          'Down Payment Amount': r.downPaymentAmount, 'Purchase Price': pp,
          'Interest Rate': ir, 'Monthly Mortgage': r.monthlyMortgage,
          'Monthly Principal': r.firstYearPrincipal / 12, 'Monthly Interest': r.firstYearInterest / 12,
          'Closing Costs': r.loanClosingCosts, 'Annual Mortgage': r.annualMortgage,
          'Annual Principal': r.firstYearPrincipal, 'Annual Interest': r.firstYearInterest,
          'scenario_id': s.id,
        }])
      }
      toast.success(`Saved ${saved.length} threshold scenario${saved.length > 1 ? 's' : ''}!`)
      router.refresh()
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`)
    } finally {
      setSavingThresholds(false)
    }
  }

  // ── Render ──
  const isPositive = currentSummary.firstYearCashFlow >= 0
  const minPurchasePrice = askingPrice * (1 + priceMinChange / 100)
  const maxPurchasePrice = askingPrice * (1 + priceMaxChange / 100)

  return (
    <div className="space-y-6">
      {/* ── Section A: Current Property Summary ── */}
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3 mb-4">
          {isPositive ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
          )}
          <div>
            <h3 className="text-lg font-semibold">Current Property Analysis</h3>
            <p className={cn('text-sm font-medium', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
              This property currently has {isPositive ? 'positive' : 'negative'} cash flow
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-sm font-semibold tabular-nums">{fmt$(askingPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rent /mo</p>
            <p className="text-sm font-semibold tabular-nums">{fmt$(monthlyRent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expenses /mo</p>
            <p className="text-sm font-semibold tabular-nums">{fmt$(monthlyExpenses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Annual NOI</p>
            <p className={cn('text-sm font-semibold tabular-nums', currentSummary.noi < 0 && 'text-destructive')}>{fmt$(currentSummary.noi)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Year 1 Cash Flow</p>
            <p className={cn('text-sm font-semibold tabular-nums', currentSummary.firstYearCashFlow < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
              {fmt$(currentSummary.firstYearCashFlow)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cap Rate</p>
            <p className="text-sm font-semibold tabular-nums">{currentSummary.capRate > 0 ? `${currentSummary.capRate.toFixed(2)}%` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ROI (CoCR)</p>
            <p className={cn('text-sm font-semibold tabular-nums', currentSummary.firstYearCoCR < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
              {currentSummary.firstYearCoCR.toFixed(1)}%
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Based on {DEFAULT_DOWN_PAYMENT_PCT}% down, {DEFAULT_LOAN_TERM} yr loan at {DEFAULT_ANALYSIS_INTEREST_RATE}%, {DEFAULT_CLOSING_COST_PCT}% closing costs
        </p>
      </div>

      {/* ── Section B: Break-Even Thresholds ── */}
      <div className="rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-lg font-semibold">What Makes This Property Cash Flow Positive?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Each card shows the break-even value for one variable (all others held at baseline).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={savePositiveThresholdScenarios}
            disabled={savingThresholds || thresholds.filter(t => t.thresholdValue !== null).length === 0}
          >
            {savingThresholds ? 'Saving...' : 'Save All Thresholds'}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md mb-4">
          <strong>Baseline:</strong>{' '}
          Price = {fmt$(askingPrice)},{' '}
          Rent = {fmt$(monthlyRent)}/mo ({fmt$(baseGrossIncome)}/yr),{' '}
          Expenses = {fmt$(monthlyExpenses)}/mo ({fmt$(baseOperatingExpenses)}/yr),{' '}
          Rate = {baselineRate}%,{' '}
          Down Payment = {baselineDownPct}%,{' '}
          Term = {baselineLoanTerm} yr
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {thresholds.map((t) => (
            <div key={t.variable} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  {t.meetsThreshold ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : t.thresholdValue !== null ? (
                    t.variable === 'Purchase Price' || t.variable === 'Operating Expenses' || t.variable === 'Interest Rate'
                      ? <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                      : <TrendingUp className="h-4 w-4 text-destructive shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                </div>
                {t.thresholdValue !== null && (
                  <Button
                    size="sm" variant="outline" className="shrink-0 h-7 text-xs"
                    onClick={() => saveSingleThresholdScenario(t)}
                    disabled={savingThresholdVariable === t.variable}
                  >
                    {savingThresholdVariable === t.variable ? '...' : 'Save'}
                  </Button>
                )}
              </div>

              {t.thresholdValue !== null ? (
                <div className="space-y-1 mt-3">
                  {t.variable === 'Interest Rate' ? (
                    <p className="text-lg font-bold tabular-nums">{t.thresholdValue.toFixed(2)}%</p>
                  ) : t.variable === 'Down Payment' ? (
                    <>
                      <p className="text-lg font-bold tabular-nums">{t.thresholdValue.toFixed(2)}%</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        = {fmt$(askingPrice * (t.thresholdValue / 100))}
                      </p>
                    </>
                  ) : t.variable === 'Purchase Price' ? (
                    <p className="text-lg font-bold tabular-nums">{fmt$(t.thresholdValue)}</p>
                  ) : (
                    <>
                      <p className="text-lg font-bold tabular-nums">{fmt$(t.thresholdValue)}/yr</p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        = {fmt$(t.thresholdValue / MONTHS_PER_YEAR)}/mo
                      </p>
                    </>
                  )}
                  {t.thresholdChange !== null && t.variable !== 'Interest Rate' && t.variable !== 'Down Payment' && (
                    <p className={cn('text-xs tabular-nums', t.thresholdChange < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {t.thresholdChange >= 0 ? '+' : ''}{t.thresholdChange.toFixed(1)}% from baseline
                    </p>
                  )}
                  {t.meetsThreshold ? (
                    <Badge variant="secondary" className="text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 text-[10px] mt-1">
                      Already meets threshold
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-destructive bg-destructive/10 text-[10px] mt-1">
                      Needs adjustment
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-destructive font-medium mt-3">No positive threshold found in range</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Section C: Scenario Explorer (collapsed by default) ── */}
      <div className="rounded-xl border">
        <button
          type="button"
          onClick={() => setExplorerOpen(!explorerOpen)}
          className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div>
            <h3 className="text-lg font-semibold">Explore All Scenario Combinations</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Adjust variable ranges and generate a table of all combinations ({scenarios.length} scenarios)
            </p>
          </div>
          {explorerOpen ? <ChevronDown className="h-5 w-5 shrink-0" /> : <ChevronRight className="h-5 w-5 shrink-0" />}
        </button>

        {explorerOpen && (
          <div className="border-t p-4 space-y-6">
            {/* Variable range sliders */}
            <div className="flex justify-between items-center">
              <h4 className="text-base font-semibold">Variable Ranges</h4>
              <Button variant="outline" size="sm" onClick={() => {
                setMinInterestRate(String(DEFAULT_INTEREST_RATE_MIN)); setMaxInterestRate(String(DEFAULT_INTEREST_RATE_MAX))
                setPurchasePriceMinChange('0'); setPurchasePriceMaxChange('0')
                setIncomeMinChange('0'); setIncomeMaxChange('0')
                setExpensesMinChange('0'); setExpensesMaxChange('0')
                setMinDownPayment(String(DEFAULT_DOWN_PAYMENT_PCT)); setMaxDownPayment(String(DEFAULT_DOWN_PAYMENT_PCT))
                setClosingCostPercent(String(DEFAULT_CLOSING_COST_PCT))
              }}>Reset</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SliderPair label={`Interest Rate: ${minIntRate}% - ${maxIntRate}%`} min={0} max={MAX_INTEREST_RATE_SLIDER} step={SLIDER_STEP}
                minVal={minIntRate} maxVal={maxIntRate}
                onMinChange={v => { if (v <= maxIntRate) setMinInterestRate(v.toFixed(2)) }}
                onMaxChange={v => { if (v >= minIntRate) setMaxInterestRate(v.toFixed(2)) }} />
              <SliderPair label={`Purchase Price Change: ${priceMinChange}% - ${priceMaxChange}%`} min={SLIDER_RANGE_MIN} max={SLIDER_RANGE_MAX_PRICE} step={SLIDER_STEP}
                minVal={priceMinChange} maxVal={priceMaxChange}
                onMinChange={v => { if (v <= priceMaxChange) setPurchasePriceMinChange(v.toFixed(2)) }}
                onMaxChange={v => { if (v >= priceMinChange) setPurchasePriceMaxChange(v.toFixed(2)) }} />
              <SliderPair label={`Rent Change: ${incomeMinChangeVal}% - ${incomeMaxChangeVal}%`} min={SLIDER_RANGE_MIN} max={SLIDER_RANGE_MAX_INCOME_EXPENSE} step={SLIDER_STEP}
                minVal={incomeMinChangeVal} maxVal={incomeMaxChangeVal}
                onMinChange={v => { if (v <= incomeMaxChangeVal) setIncomeMinChange(v.toFixed(2)) }}
                onMaxChange={v => { if (v >= incomeMinChangeVal) setIncomeMaxChange(v.toFixed(2)) }} />
              <SliderPair label={`Expenses Change: ${expensesMinChangeVal}% - ${expensesMaxChangeVal}%`} min={SLIDER_RANGE_MIN} max={SLIDER_RANGE_MAX_INCOME_EXPENSE} step={SLIDER_STEP}
                minVal={expensesMinChangeVal} maxVal={expensesMaxChangeVal}
                onMinChange={v => { if (v <= expensesMaxChangeVal) setExpensesMinChange(v.toFixed(2)) }}
                onMaxChange={v => { if (v >= expensesMinChangeVal) setExpensesMaxChange(v.toFixed(2)) }} />
              <SliderPair label={`Down Payment: ${minDownPaymentVal}% - ${maxDownPaymentVal}%`} min={0} max={MAX_DOWN_PAYMENT_SLIDER} step={SLIDER_STEP}
                minVal={minDownPaymentVal} maxVal={maxDownPaymentVal}
                onMinChange={v => { if (v <= maxDownPaymentVal) setMinDownPayment(v.toFixed(2)) }}
                onMaxChange={v => { if (v >= minDownPaymentVal) setMaxDownPayment(v.toFixed(2)) }} />
              <div className="space-y-2">
                <label className="block text-sm font-medium">Closing Costs: {closingCostPercent}%</label>
                <input type="range" min={0} max={10} step={0.5} value={parseValue(closingCostPercent, DEFAULT_CLOSING_COST_PCT)}
                  onChange={e => setClosingCostPercent(parseFloat(e.target.value).toFixed(2))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={positiveCashFlowOnly} onChange={e => setPositiveCashFlowOnly(e.target.checked)} className="rounded border-input" />
                Positive cash flow only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={includeLoan} onChange={e => setIncludeLoan(e.target.checked)} className="rounded border-input" />
                Include Loan
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={includeAllCash} onChange={e => setIncludeAllCash(e.target.checked)} className="rounded border-input" />
                Include All Cash
              </label>
              {includeLoan && (
                <>
                  <span className="text-xs text-muted-foreground">Terms:</span>
                  {LOAN_TERMS.map((term, i) => (
                    <label key={term} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={i === 0 ? includeLoanTerm15 : i === 1 ? includeLoanTerm20 : includeLoanTerm30}
                        onChange={e => i === 0 ? setIncludeLoanTerm15(e.target.checked) : i === 1 ? setIncludeLoanTerm20(e.target.checked) : setIncludeLoanTerm30(e.target.checked)}
                        className="rounded border-input" />
                      {term} yr
                    </label>
                  ))}
                </>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Price Range</p>
                <p className="tabular-nums">{fmt$(minPurchasePrice)} - {fmt$(askingPrice * (1 + priceMaxChange / 100))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rent Range /yr</p>
                <p className="tabular-nums">{fmt$(baseGrossIncome * (1 + incomeMinChangeVal / 100))} - {fmt$(baseGrossIncome * (1 + incomeMaxChangeVal / 100))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expenses Range /yr</p>
                <p className="tabular-nums">{fmt$(baseOperatingExpenses * (1 + expensesMinChangeVal / 100))} - {fmt$(baseOperatingExpenses * (1 + expensesMaxChangeVal / 100))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Down Payment</p>
                <p className="tabular-nums">{minDownPaymentVal}% - {maxDownPaymentVal}%</p>
              </div>
            </div>

            {/* Scenario Table */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {[
                      { key: 'purchasePrice', label: 'Price' },
                      { key: 'grossIncome', label: 'Rent /yr' },
                      { key: 'operatingExpenses', label: 'Expenses /yr' },
                      { key: 'capRate', label: 'Cap Rate' },
                      { key: 'interestRate', label: 'Rate' },
                      { key: 'loanTerm', label: 'Term' },
                      { key: 'downPayment', label: 'Down Pmt' },
                      { key: 'totalCashInvested', label: 'Cash In' },
                      { key: 'dscr', label: 'DSCR' },
                      { key: 'firstYearCashFlow', label: 'Yr 1 Cash Flow' },
                      { key: 'firstYearCoCR', label: 'Yr 1 CoCR' },
                    ].map(col => (
                      <TableHead key={col.key} className="py-3 text-right">
                        <button type="button" onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 justify-end w-full text-xs font-semibold uppercase tracking-wider hover:text-foreground select-none">
                          {col.label}<SortIcon column={col.key} />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="py-3 text-center text-xs font-semibold uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedScenarios.map(s => {
                    const priceChg = askingPrice > 0 ? ((s.purchasePrice - askingPrice) / askingPrice) * 100 : 0
                    const incChg = baseGrossIncome > 0 ? ((s.grossIncome - baseGrossIncome) / baseGrossIncome) * 100 : 0
                    const expChg = baseOperatingExpenses > 0 ? ((s.operatingExpenses - baseOperatingExpenses) / baseOperatingExpenses) * 100 : 0
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="py-2 text-right tabular-nums">
                          <div className="font-semibold text-sm">{fmt$(s.purchasePrice)}</div>
                          <div className={cn('text-xs', priceChg < 0 ? 'text-destructive' : 'text-muted-foreground')}>{priceChg >= 0 ? '+' : ''}{priceChg.toFixed(1)}%</div>
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          <div className="font-semibold text-sm">{fmt$(s.grossIncome)}</div>
                          <div className={cn('text-xs', incChg < 0 ? 'text-destructive' : 'text-muted-foreground')}>{incChg >= 0 ? '+' : ''}{incChg.toFixed(1)}%</div>
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums">
                          <div className="font-semibold text-sm">{fmt$(s.operatingExpenses)}</div>
                          <div className={cn('text-xs', expChg < 0 ? 'text-destructive' : 'text-muted-foreground')}>{expChg >= 0 ? '+' : ''}{expChg.toFixed(1)}%</div>
                        </TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm">{s.capRate.toFixed(2)}%</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm">{s.interestRate != null ? `${s.interestRate.toFixed(2)}%` : '—'}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm">{s.loanTerm != null ? `${s.loanTerm} yr` : '—'}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm">{s.downPaymentAmount != null ? fmt$(s.downPaymentAmount) : '—'}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm font-semibold">{fmt$(s.totalCashInvested)}</TableCell>
                        <TableCell className="py-2 text-right tabular-nums text-sm">
                          {s.dscr != null ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help border-b border-dotted border-muted-foreground/50">{s.dscr.toFixed(2)}x</span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs whitespace-pre-line">
                                DSCR = NOI / Annual Mortgage{'\n'}= {fmt$(s.noi)} / {fmt$(s.annualMortgage || 0)} = {s.dscr.toFixed(2)}x
                              </TooltipContent>
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                        <TableCell className={cn('py-2 text-right tabular-nums text-sm font-bold', s.firstYearCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground/50">{fmt$(s.firstYearCashFlow)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-xs whitespace-pre-line">
                              {s.hasLoan
                                ? `NOI ${fmt$(s.noi)} − Debt Service ${fmt$(s.annualMortgage || 0)} = ${fmt$(s.firstYearCashFlow)}`
                                : `Cash Flow = NOI = ${fmt$(s.noi)}`}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className={cn('py-2 text-right tabular-nums text-sm font-bold', s.firstYearCoCR >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help border-b border-dotted border-muted-foreground/50">{s.firstYearCoCR.toFixed(2)}%</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-xs whitespace-pre-line">
                              CoCR = Cash Flow / Cash Invested{'\n'}= {fmt$(s.firstYearCashFlow)} / {fmt$(s.totalCashInvested)} = {s.firstYearCoCR.toFixed(2)}%
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => handleSaveClick(s)} disabled={savingScenarioId === s.id}>
                            {savingScenarioId === s.id ? '...' : 'Save'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {sortedScenarios.length === 0 && (
                    <TableRow><TableCell colSpan={12} className="py-8 text-center text-sm text-muted-foreground">No scenarios match current filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save Scenario</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label htmlFor="scenarioNameInput" className="text-sm font-medium text-muted-foreground">Enter a name</label>
            <Input id="scenarioNameInput" value={pendingScenarioName} onChange={e => setPendingScenarioName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNameConfirm() }} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleNameConfirm} disabled={!pendingScenarioName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SliderPair({ label, min, max, step, minVal, maxVal, onMinChange, onMaxChange }: {
  label: string; min: number; max: number; step: number
  minVal: number; maxVal: number
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <input type="range" min={min} max={max} step={step} value={minVal}
        onChange={e => onMinChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600" />
      <input type="range" min={min} max={max} step={step} value={maxVal}
        onChange={e => onMaxChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600" />
    </div>
  )
}

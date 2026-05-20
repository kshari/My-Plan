'use client'

import { useMemo, useState, useRef } from 'react'
import { IRR_INITIAL_GUESS, IRR_TOLERANCE, IRR_MAX_ITERATIONS, BALANCE_THRESHOLD, DEFAULT_SALE_COST_PCT } from '@/lib/constants/property-defaults'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const DEFAULT_GROWTH_RATE = 3

/** Format a dollar amount compactly: $34,860 → $34.9K, $1,200,000 → $1.2M */
function fmtCompact(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}

/** Format a dollar amount with full precision: $11,283.84 */
function fmtExact(v: number): string {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface PLTableProps {
  scenario: any
  years?: number
  /** 'screen' (default) uses compact $K/$M; 'print' uses full-precision dollars for static output. */
  variant?: 'screen' | 'print'
}

// Function to calculate IRR using Newton-Raphson method
function calculateIRR(cashFlows: number[]): number {
  if (cashFlows.length < 2) return 0
  
  // Check if we have at least one negative and one positive cash flow
  const hasNegative = cashFlows.some(cf => cf < 0)
  const hasPositive = cashFlows.some(cf => cf > 0)
  if (!hasNegative || !hasPositive) return 0
  
  // Initial guess between -99% and 99% to avoid division by zero
  let irr = IRR_INITIAL_GUESS
  const maxIterations = IRR_MAX_ITERATIONS
  const tolerance = IRR_TOLERANCE

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0
    let npvDerivative = 0

    for (let j = 0; j < cashFlows.length; j++) {
      const discountFactor = Math.pow(1 + irr, j)
      if (isFinite(discountFactor) && discountFactor !== 0) {
        npv += cashFlows[j] / discountFactor
        if (j > 0) {
          npvDerivative -= (j * cashFlows[j]) / (discountFactor * (1 + irr))
        }
      }
    }

    if (Math.abs(npv) < tolerance) {
      break
    }

    if (Math.abs(npvDerivative) < tolerance || !isFinite(npvDerivative)) {
      break
    }

    const newIrr = irr - npv / npvDerivative
    
    // Constrain IRR to reasonable bounds (-99% to 99%)
    if (!isFinite(newIrr) || newIrr < -0.99 || newIrr > 0.99) {
      break
    }
    
    irr = newIrr
  }

  // Return as percentage, clamp to reasonable range
  const result = irr * 100
  if (!isFinite(result) || result < -99 || result > 99) {
    return 0
  }
  
  return result
}

export default function PLTable({ scenario, years, variant = 'screen' }: PLTableProps) {
  // In print mode we want full-precision numbers since tooltips aren't available.
  const fmt = variant === 'print' ? (v: number): string => {
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  } : fmtCompact
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollHint, setShowScrollHint] = useState(true)
  const purchasePrice = parseFloat(scenario['Purchase Price']?.toString() || '0') || 0
  // Current Market Value (appraised value today) drives the Year-0 basis for
  // property-value projections. When the scenario doesn't carry one, fall back
  // to the Purchase Price so legacy scenarios keep their existing IRR.
  const rawCurrentMarketValue = scenario['Current Market Value']
  const parsedCurrentMarketValue = rawCurrentMarketValue === null || rawCurrentMarketValue === undefined || rawCurrentMarketValue === ''
    ? 0
    : (parseFloat(String(rawCurrentMarketValue)) || 0)
  const projectionBasis = parsedCurrentMarketValue > 0 ? parsedCurrentMarketValue : purchasePrice
  const usingMarketValueBasis = parsedCurrentMarketValue > 0 && parsedCurrentMarketValue !== purchasePrice
  const baseGrossIncome = parseFloat(scenario['Gross Income']?.toString() || '0') || 0
  const baseOperatingExpenses = parseFloat(scenario['Operating Expenses']?.toString() || '0') || 0
  const scenarioVacancyRate = parseFloat(scenario['Vacancy Rate']?.toString() || '0') || 0
  const scenarioPropMgmtRate = parseFloat(scenario['Property Management Rate']?.toString() || '0') || 0
  // Sale cost rate — realtor commission + closing fees applied to sale proceeds for IRR calc
  const rawSaleCostRate = scenario['Sale Cost Rate']
  const scenarioSaleCostRate = rawSaleCostRate === null || rawSaleCostRate === undefined || rawSaleCostRate === ''
    ? DEFAULT_SALE_COST_PCT
    : (parseFloat(String(rawSaleCostRate)) || 0)

  // Seed growth rates from scenario if saved, otherwise fall back to default 3%
  const scenarioIncomeIncrease = parseFloat(scenario['Income Increase']?.toString() || '')
  const scenarioExpensesIncrease = parseFloat(scenario['Expenses Increase']?.toString() || '')
  const scenarioPropertyIncrease = parseFloat(scenario['Property Value Increase']?.toString() || '')

  const [rentGrowth, setRentGrowth] = useState<string>(
    !isNaN(scenarioIncomeIncrease) && scenarioIncomeIncrease > 0
      ? scenarioIncomeIncrease.toString()
      : DEFAULT_GROWTH_RATE.toString()
  )
  const [expenseGrowth, setExpenseGrowth] = useState<string>(
    !isNaN(scenarioExpensesIncrease) && scenarioExpensesIncrease > 0
      ? scenarioExpensesIncrease.toString()
      : DEFAULT_GROWTH_RATE.toString()
  )
  const [propertyGrowth, setPropertyGrowth] = useState<string>(
    !isNaN(scenarioPropertyIncrease) && scenarioPropertyIncrease > 0
      ? scenarioPropertyIncrease.toString()
      : DEFAULT_GROWTH_RATE.toString()
  )

  const incomeIncreasePercent = parseFloat(rentGrowth) || 0
  const expensesIncreasePercent = parseFloat(expenseGrowth) || 0
  const propertyValueIncreasePercent = parseFloat(propertyGrowth) || 0

  // Whether these differ from what the scenario has saved (to show a note)
  const scenarioHasSavedRates =
    !isNaN(scenarioIncomeIncrease) && scenarioIncomeIncrease > 0 &&
    !isNaN(scenarioExpensesIncrease) && scenarioExpensesIncrease > 0
  const hasLoan = scenario['Has Loan'] || false
  const loanTerm = parseInt(scenario['Loan Term']?.toString() || '0') || 0
  const interestRate = parseFloat(scenario['Interest Rate']?.toString() || '0') || 0
  const downPaymentAmount = parseFloat(scenario['Down Payment Amount']?.toString() || '0') || 0
  const loanClosingCosts = parseFloat(scenario['Closing Costs']?.toString() || '0') || 0
  const purchaseClosingCosts = parseFloat(scenario['Purchase Closing Costs']?.toString() || '0') || 0
  const loanPrincipal = purchasePrice - downPaymentAmount
  // Compute monthly mortgage from loan fields; 'Monthly Mortgage' is not persisted in DB
  const _mr = interestRate > 0 ? interestRate / 100 / 12 : 0
  const _np = loanTerm * 12
  const computedMonthlyMortgage = loanPrincipal > 0 && _mr > 0 && _np > 0
    ? loanPrincipal * (_mr * Math.pow(1 + _mr, _np)) / (Math.pow(1 + _mr, _np) - 1)
    : 0
  const monthlyMortgage = parseFloat(scenario['Monthly Mortgage']?.toString() || '0') || computedMonthlyMortgage
  // Total Cash Invested: No loan = Purchase Price + Purchase Closing Costs, With loan = Down Payment + Loan Closing Costs + Purchase Closing Costs
  const totalCashInvested = hasLoan 
    ? downPaymentAmount + loanClosingCosts + purchaseClosingCosts
    : purchasePrice + purchaseClosingCosts

  // Determine number of years to show
  const displayYears = years || (hasLoan && loanTerm > 0 ? loanTerm : 10)

  const plData = useMemo(() => {
    const data = []
    let remainingLoanBalance = hasLoan ? loanPrincipal : 0

    // Calculate amortization schedule for accurate year-by-year principal and interest
    let amortizationSchedule: { year: number; interest: number; principal: number; balance: number }[] = []
    if (hasLoan && loanTerm > 0 && loanPrincipal > 0 && interestRate > 0 && monthlyMortgage > 0) {
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTerm * 12
      let balance = loanPrincipal

      for (let year = 1; year <= loanTerm; year++) {
        let yearInterest = 0
        let yearPrincipal = 0

        for (let month = 1; month <= 12; month++) {
          const paymentNum = (year - 1) * 12 + month
          if (paymentNum <= numPayments && balance > BALANCE_THRESHOLD) {
            const interestPayment = balance * monthlyRate
            const principalPayment = monthlyMortgage - interestPayment
            yearInterest += interestPayment
            yearPrincipal += principalPayment > balance ? balance : principalPayment
            balance = Math.max(0, balance - principalPayment)
          }
        }

        amortizationSchedule.push({
          year,
          interest: yearInterest,
          principal: yearPrincipal,
          balance: balance,
        })
      }
    }

    for (let year = 1; year <= displayYears; year++) {
      // Calculate annual increases: Year 1 = base, Year 2+ = compounded
      const incomeMultiplier = year === 1 ? 1 : Math.pow(1 + incomeIncreasePercent / 100, year - 1)
      const expensesMultiplier = year === 1 ? 1 : Math.pow(1 + expensesIncreasePercent / 100, year - 1)
      // Property appreciates each year from purchase — Year 1 = 1 full year of appreciation
      const propertyValueMultiplier = Math.pow(1 + propertyValueIncreasePercent / 100, year)
      
      const grossIncome = baseGrossIncome * incomeMultiplier
      const operatingExpenses = baseOperatingExpenses * expensesMultiplier
      // Project property value forward from the current market value (or
      // purchase price if no market value is set). This makes the year-by-year
      // IRR forward-looking from today's appraised value.
      const currentPropertyValue = projectionBasis * propertyValueMultiplier
      
      // Apply vacancy: effective income = gross * (1 - vacancy%)
      const vacancyLoss = grossIncome * (scenarioVacancyRate / 100)
      const effectiveIncome = grossIncome - vacancyLoss
      // Property management: % of effective income added to expenses
      const propMgmtExpense = effectiveIncome * (scenarioPropMgmtRate / 100)
      const totalExpenses = operatingExpenses + propMgmtExpense
      
      const noi = effectiveIncome - totalExpenses
      
      let interest = 0
      let principal = 0
      
      if (hasLoan && amortizationSchedule.length > 0) {
        const yearData = amortizationSchedule[year - 1]
        if (yearData) {
          interest = yearData.interest
          principal = yearData.principal
          remainingLoanBalance = yearData.balance
        }
      } else if (hasLoan) {
        // Fallback: use stored annual values
        interest = parseFloat(scenario['Annual Interest']?.toString() || '0') || 0
        principal = parseFloat(scenario['Annual Principal']?.toString() || '0') || 0
        if (year <= loanTerm) {
          remainingLoanBalance = Math.max(0, remainingLoanBalance - principal)
        } else {
          interest = 0
          principal = 0
        }
      }
      
      const netIncome = noi - interest
      // Cash flow = Net Income - Principal (closing costs are part of initial investment, not an expense)
      const cashFlow = netIncome - principal
      const cashOnCashReturn = totalCashInvested > 0 ? (cashFlow / totalCashInvested) * 100 : 0
      
      // Equity = Current Property Value - Remaining Loan Balance (or just Current Property Value if no loan)
      const equity = hasLoan ? currentPropertyValue - remainingLoanBalance : currentPropertyValue

      data.push({
        year,
        grossIncome,
        vacancyLoss,
        effectiveIncome,
        operatingExpenses,
        propMgmtExpense,
        totalExpenses,
        noi,
        interest,
        principal,
        netIncome,
        cashFlow,
        cashOnCashReturn,
        remainingLoanBalance: hasLoan ? remainingLoanBalance : 0,
        propertyValue: currentPropertyValue,
        equity,
        irr: 0, // Will be calculated below
      })
    }

    // Calculate IRR for each year
    // For year-by-year IRR, each year assumes the property is sold at the end of that year.
    // Sale proceeds = property value × (1 − sale cost rate) − remaining loan balance.
    // Cash flows: [-initial investment, year1_cf, year2_cf, ..., yearN_cf + saleProceeds]
    for (let i = 0; i < data.length; i++) {
      const yearCashFlows: number[] = [-totalCashInvested] // Year 0: Initial investment (negative)

      for (let j = 0; j <= i; j++) {
        if (j === i) {
          const saleCost = data[j].propertyValue * (scenarioSaleCostRate / 100)
          const netSaleProceeds = data[j].equity - saleCost
          yearCashFlows.push(data[j].cashFlow + netSaleProceeds)
        } else {
          yearCashFlows.push(data[j].cashFlow)
        }
      }

      data[i].irr = calculateIRR(yearCashFlows)
    }

    return data
  }, [scenario, displayYears, purchasePrice, projectionBasis, baseGrossIncome, baseOperatingExpenses, incomeIncreasePercent, expensesIncreasePercent, propertyValueIncreasePercent, hasLoan, loanTerm, loanPrincipal, interestRate, monthlyMortgage, totalCashInvested, scenarioVacancyRate, scenarioPropMgmtRate, scenarioSaleCostRate])

  const totalClosingCosts = loanClosingCosts + purchaseClosingCosts

  return (
    <div className={`rounded-xl border bg-card p-6 ${variant === 'print' ? 'print-pl-landscape' : ''}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Annual Projections (Year by Year)</h3>
        {usingMarketValueBasis && (
          <p className="text-xs text-muted-foreground">
            Value &amp; IRR projected from <span className="font-medium text-foreground">Current Market Value {fmtCompact(projectionBasis)}</span>
            <span className="text-muted-foreground/70"> · Purchase Price {fmtCompact(purchasePrice)}</span>
          </p>
        )}
      </div>

      {/* Growth rate controls — editable on screen only; hidden in print since
          the same rates are already captured in the Scenario Details table. */}
      {variant !== 'print' && (
      <div className="mb-5 rounded-lg border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-1 mb-3">
          <span className="text-sm font-medium">Growth &amp; Appreciation Rates</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground/50 hover:text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              These rates compound year-over-year. They pre-fill from your saved scenario if one exists, otherwise default to {DEFAULT_GROWTH_RATE}%. Changing them here only affects what you see in this table.
            </TooltipContent>
          </Tooltip>
          {scenarioHasSavedRates && (
            <span className="ml-auto text-xs text-muted-foreground italic">Pre-filled from saved scenario</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Rent Growth / yr',
              value: rentGrowth,
              setter: setRentGrowth,
              tip: 'How much rental income grows each year (e.g. 3% = rent increases 3% annually).',
            },
            {
              label: 'Cost Growth / yr',
              value: expenseGrowth,
              setter: setExpenseGrowth,
              tip: 'How much operating costs (taxes, insurance, maintenance) rise each year.',
            },
            {
              label: 'Appreciation / yr',
              value: propertyGrowth,
              setter: setPropertyGrowth,
              tip: 'How much the property value increases per year — affects your equity column.',
            },
          ].map(({ label, value, setter, tip }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/40 hover:text-muted-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">{tip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={-20}
                  max={30}
                  step={0.5}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      <div className="mb-4 rounded-lg bg-muted/30 p-4">
        <div className="mb-2 font-semibold">Your Upfront Cash</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {hasLoan ? (
            <>
              <div>
                <div className="text-muted-foreground">Down Payment</div>
                <div className="font-medium">${downPaymentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Loan Closing Fees</div>
                <div className="font-medium">${loanClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Buying Fees (Closing)</div>
                <div className="font-medium">${purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Cash at Closing</div>
                <div className="font-medium">${totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-muted-foreground">Purchase Price</div>
                <div className="font-medium">${purchasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Buying Fees (Closing)</div>
                <div className="font-medium">${purchaseClosingCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Cash at Closing</div>
                <div className="font-medium">${totalCashInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Table with sticky year column + compact numbers */}
      <div
        ref={scrollRef}
        onScroll={() => setShowScrollHint(false)}
        className="relative overflow-x-auto"
      >
        {/* Scroll hint gradient – fades once user starts scrolling */}
        {showScrollHint && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card to-transparent z-10 rounded-r-xl" />
        )}
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              {/* Sticky year header */}
              <th className="sticky left-0 z-20 bg-muted/50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Yr</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Gross<br/>Rent</th>
              {scenarioVacancyRate > 0 && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Vacancy<br/>Loss</th>}
              {scenarioVacancyRate > 0 && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Effective<br/>Income</th>}
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Oper.<br/>Expenses</th>
              {scenarioPropMgmtRate > 0 && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Prop.<br/>Mgmt</th>}
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Net Op.<br/>Income</th>
              {hasLoan && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Mortgage<br/>Interest</th>}
              {hasLoan && <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Principal<br/>Repaid</th>}
              {hasLoan && variant !== 'print' && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">After<br/>Interest</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Net Operating Income − Mortgage Interest. This is income after interest but before principal repayment.
                    </TooltipContent>
                  </Tooltip>
                </th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted">Cash<br/>Flow</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {hasLoan
                      ? 'Net Operating Income − Interest − Principal Repaid. Your actual annual cash in hand after all obligations.'
                      : 'Net Operating Income. Your actual annual cash flow (no loan).'}
                  </TooltipContent>
                </Tooltip>
              </th>
              {variant !== 'print' && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">CoC<br/>Return %</th>
              )}
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted">Equity</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Current property value minus remaining loan balance. Includes your down payment, principal repaid to date, and appreciation gains.
                  </TooltipContent>
                </Tooltip>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help underline decoration-dotted">IRR %</span>
                  </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Internal Rate of Return — assumes the property is sold at the end of this year at its appreciated value.
                      Sale proceeds = value × (1 − {scenarioSaleCostRate}% sale costs) − remaining loan. Edit Sale Cost % in the Assumptions card.
                      {usingMarketValueBasis && (
                        <><br /><br />Projected from <strong>Current Market Value</strong> ({fmtCompact(projectionBasis)}), not Purchase Price ({fmtCompact(purchasePrice)}).</>
                      )}
                    </TooltipContent>
                </Tooltip>
              </th>
              {hasLoan && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">Loan<br/>Left</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Remaining principal balance on the loan. Reaches $0 at end of loan term.
                    </TooltipContent>
                  </Tooltip>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {plData.map((row) => (
              <tr key={row.year} className="hover:bg-muted/50">
                {/* Sticky year cell */}
                <td className="sticky left-0 z-10 bg-card whitespace-nowrap px-4 py-3 text-sm font-semibold">{row.year}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.grossIncome)}</td>
                {scenarioVacancyRate > 0 && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-destructive/70">−{fmt(row.vacancyLoss)}</td>
                )}
                {scenarioVacancyRate > 0 && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">{fmt(row.effectiveIncome)}</td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.operatingExpenses)}</td>
                {scenarioPropMgmtRate > 0 && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{fmt(row.propMgmtExpense)}</td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default underline decoration-dotted decoration-muted-foreground/40">{fmt(row.noi)}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      NOI: {fmtExact(row.noi)}
                    </TooltipContent>
                  </Tooltip>
                </td>
                {hasLoan && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.interest)}</td>
                )}
                {hasLoan && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">{fmt(row.principal)}</td>
                )}
                {/* After Interest: NOI − Interest (only shown when there's a loan; hidden in print) */}
                {hasLoan && variant !== 'print' && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default underline decoration-dotted decoration-muted-foreground/40">{fmt(row.netIncome)}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        After Interest: {fmtExact(row.netIncome)}<br />
                        (NOI {fmtExact(row.noi)} − Interest {fmtExact(row.interest)})
                      </TooltipContent>
                    </Tooltip>
                  </td>
                )}
                {/* Cash Flow: NOI − Interest − Principal (the actual cash in hand) */}
                <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold ${row.cashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default underline decoration-dotted decoration-current/40">{fmt(row.cashFlow)}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Cash Flow: {fmtExact(row.cashFlow)}/yr · {fmtExact(row.cashFlow / 12)}/mo
                      {hasLoan && <><br />(NOI {fmtExact(row.noi)} − Interest {fmtExact(row.interest)} − Principal {fmtExact(row.principal)})</>}
                    </TooltipContent>
                  </Tooltip>
                </td>
                {variant !== 'print' && (
                  <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium ${row.cashOnCashReturn >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                    {row.cashOnCashReturn.toFixed(1)}%
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default underline decoration-dotted decoration-muted-foreground/40">{fmt(row.equity)}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Equity: {fmtExact(row.equity)}<br />
                      {hasLoan
                        ? `(Appreciated Value − Remaining Loan ${fmtExact(row.remainingLoanBalance)})`
                        : '(Full property value — no loan)'}
                    </TooltipContent>
                  </Tooltip>
                </td>
                <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium ${row.irr >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                  {row.irr.toFixed(1)}%
                </td>
                {hasLoan && (
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {/* Guard against NaN/floating-point residue; show $0 once fully paid */}
                    {fmt(Math.max(0, Number.isFinite(row.remainingLoanBalance) ? row.remainingLoanBalance : 0))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground text-right">
        {variant === 'print'
          ? 'Full-precision dollars shown.'
          : 'Numbers in $K / $M — hover column headers or values for exact amounts'}
      </p>
      {variant === 'print' && scenarioPropMgmtRate > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          <strong>Note:</strong> Property Management ({scenarioPropMgmtRate}%) is applied to <em>effective income</em>
          {` (gross rent × (1 − ${scenarioVacancyRate || 0}% vacancy))`}, not to gross rent — the industry-standard convention.
        </p>
      )}
      {hasLoan && (
        <div className={`mt-3 rounded-lg bg-muted/20 border border-border/40 px-4 py-3 text-xs text-muted-foreground grid grid-cols-1 gap-2 ${variant === 'print' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {variant !== 'print' && (
            <div><span className="font-semibold text-foreground">After Interest</span> = NOI − Mortgage Interest</div>
          )}
          <div><span className="font-semibold text-foreground">Cash Flow</span> = NOI − Interest − Principal Repaid</div>
          <div><span className="font-semibold text-foreground">Equity</span> = Appreciated Value − Remaining Loan. <span className="font-semibold text-foreground">IRR</span> = Return assuming sale at year-end</div>
        </div>
      )}
    </div>
  )
}

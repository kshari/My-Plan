'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AmortizationTable from '@/components/property/amortization-table'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface ScenarioFormProps {
  propertyId: number
  scenarioId?: number
  initialData?: any
  propertyAskingPrice?: number | null
  propertyGrossIncome?: number | null
  propertyOperatingExpenses?: number | null
  /** Persist to team_shared_scenarios (requires teamId) instead of pi_financial_scenarios */
  storage?: 'personal' | 'team'
  teamId?: string
}

export default function ScenarioForm({
  propertyId,
  scenarioId,
  initialData,
  propertyAskingPrice,
  propertyGrossIncome,
  propertyOperatingExpenses,
  storage = 'personal',
  teamId,
}: ScenarioFormProps) {
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

  // ── Expense breakdown (canonical shape) ──────────────────────────────────
  // JSONB keys: property_taxes, insurance, cdd, hoa, maintenance, other — all in $/month.
  // Legacy rows written by earlier versions of this form stored annual dollars and
  // misplaced the top-level rates (management_fee, vacancy_rate) inside the JSONB.
  // We detect that shape here and migrate on read so users see sensible defaults.
  const _rawBreakdown = initialData?.expense_breakdown as Record<string, number | null> | null | undefined
  const _looksLegacy = !!_rawBreakdown && ('management_fee' in _rawBreakdown || 'vacancy_rate' in _rawBreakdown)
  const _toMonthly = (v: number | null | undefined) =>
    v == null || !isFinite(Number(v)) ? '' : (_looksLegacy ? (Number(v) / 12).toFixed(2) : String(v))

  const [useExpenseBreakdown, setUseExpenseBreakdown] = useState(!!_rawBreakdown)
  const [propertyTaxes, setPropertyTaxes] = useState(_toMonthly(_rawBreakdown?.property_taxes))
  const [insurance, setInsurance] = useState(_toMonthly(_rawBreakdown?.insurance))
  const [cdd, setCdd] = useState(_toMonthly(_rawBreakdown?.cdd))
  const [hoa, setHoa] = useState(_toMonthly(_rawBreakdown?.hoa))
  const [maintenance, setMaintenance] = useState(_toMonthly(_rawBreakdown?.maintenance))
  const [otherExpenses, setOtherExpenses] = useState(_toMonthly(_rawBreakdown?.other))

  // Top-level scenario rates (these are columns on pi_financial_scenarios,
  // not part of the expense breakdown). If we detected a legacy breakdown
  // that had them nested, promote those values up here.
  const [vacancyRatePct, setVacancyRatePct] = useState(
    initialData?.['Vacancy Rate']?.toString()
      || (_looksLegacy ? _rawBreakdown?.vacancy_rate?.toString() ?? '' : '')
      || ''
  )
  const [propertyManagementPct, setPropertyManagementPct] = useState(
    initialData?.['Property Management Rate']?.toString()
      || (_looksLegacy ? _rawBreakdown?.management_fee?.toString() ?? '' : '')
      || ''
  )

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

  // Auto-calculate annual Operating Expenses from the itemized breakdown.
  // Breakdown values are $/month, so annual total = sum × 12. Vacancy loss and
  // property-management fees are NOT operating expenses — they're computed
  // separately by compute-metrics.ts as a revenue deduction and a % of
  // effective income respectively, so they don't belong in this sum.
  useEffect(() => {
    if (useExpenseBreakdown) {
      const monthlyTotal =
        (parseFloat(propertyTaxes) || 0) +
        (parseFloat(insurance) || 0) +
        (parseFloat(cdd) || 0) +
        (parseFloat(hoa) || 0) +
        (parseFloat(maintenance) || 0) +
        (parseFloat(otherExpenses) || 0)
      setOperatingExpenses((monthlyTotal * 12).toFixed(2))
    }
  }, [useExpenseBreakdown, propertyTaxes, insurance, cdd, hoa, maintenance, otherExpenses])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const isTeam = storage === 'team'
    if (isTeam && !teamId) {
      setError('Team context is missing')
      setLoading(false)
      return
    }

    const teamBase = isTeam ? `/apps/property/teams/${teamId}/properties/${propertyId}` : `/apps/property/properties/${propertyId}`

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

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
        'Has Loan': hasLoan,
        'Loan Term': hasLoan && loanTerm ? parseInt(loanTerm) : null,
        'Down Payment Percentage': hasLoan && downPaymentPercent ? parseFloat(downPaymentPercent) : null,
        'Down Payment Amount': hasLoan && downPaymentAmount ? parseFloat(downPaymentAmount) : null,
        'Interest Rate': hasLoan && interestRate ? parseFloat(interestRate) : null,
        'Closing Costs': hasLoan && loanClosingCosts ? parseFloat(loanClosingCosts) : null,
        'Purchase Closing Costs': purchaseClosingCosts ? parseFloat(purchaseClosingCosts) : null,
        'Vacancy Rate': vacancyRatePct === '' ? null : parseFloat(vacancyRatePct),
        'Property Management Rate': propertyManagementPct === '' ? null : parseFloat(propertyManagementPct),
        // Canonical breakdown shape: keys property_taxes/insurance/cdd/hoa/maintenance/other, values in $/month.
        // Top-level rates (Vacancy Rate, Property Management Rate) live on scenario columns above — NOT in here.
        'expense_breakdown': useExpenseBreakdown ? {
          property_taxes: propertyTaxes ? parseFloat(propertyTaxes) : 0,
          insurance: insurance ? parseFloat(insurance) : 0,
          cdd: cdd ? parseFloat(cdd) : 0,
          hoa: hoa ? parseFloat(hoa) : 0,
          maintenance: maintenance ? parseFloat(maintenance) : 0,
          other: otherExpenses ? parseFloat(otherExpenses) : 0,
        } : null,
      }

      if (isTeam) {
        scenarioData.shared_property_id = propertyId
        scenarioData.last_updated_by = user.id
        if (!scenarioId) {
          scenarioData.shared_by = user.id
        }
      } else {
        scenarioData['Property ID'] = propertyId
      }

      const scenTable = isTeam ? 'team_shared_scenarios' : 'pi_financial_scenarios'

      if (scenarioId) {
        const { error } = await supabase
          .from(scenTable)
          .update(scenarioData)
          .eq('id', scenarioId)

        if (error) throw error
        router.refresh()
        // Land on the deal workspace with this scenario active, instead of the
        // standalone scenario-detail page (which duplicates the same metrics).
        router.push(isTeam ? `${teamBase}/scenarios/recommended` : `/apps/property/properties/${propertyId}?scenario=${scenarioId}`)
      } else {
        const { data, error } = await supabase
          .from(scenTable)
          .insert([scenarioData])
          .select()
          .single()

        if (error) throw error
        router.push(isTeam ? `${teamBase}/scenarios/recommended` : `/apps/property/properties/${propertyId}?scenario=${data.id}`)
      }
    } catch (error: any) {
      setError(error.message || 'Failed to save scenario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-border">
        <nav className="-mb-px flex space-x-8">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
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
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
            } ${(!hasLoan || !scenarioId) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Amortization Schedule
          </button>
        </nav>
      </div>

      {activeTab === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <ErrorMessage message={error} />}

          <div>
            <label htmlFor="scenarioName" className="block text-sm font-medium text-foreground">
              Scenario Name
            </label>
            <input
              id="scenarioName"
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., Base Case, Optimistic, Conservative"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="purchasePrice" className="block text-sm font-medium text-foreground">
                Purchase Price ($)
                {propertyAskingPrice && (
                  <span className="text-sm text-muted-foreground ml-2">(Asking: ${propertyAskingPrice.toLocaleString()})</span>
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
                  className="block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grossIncome" className="block text-sm font-medium text-foreground">
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
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="operatingExpenses" className="block text-sm font-medium text-foreground">
                Operating Expenses ($/yr)
              </label>
              <input
                id="operatingExpenses"
                type="number"
                min="0"
                step="0.01"
                value={operatingExpenses}
                onChange={(e) => setOperatingExpenses(e.target.value)}
                placeholder="0.00"
                readOnly={useExpenseBreakdown}
                className={`mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring ${useExpenseBreakdown ? 'bg-muted' : ''}`}
              />
              {useExpenseBreakdown && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-calculated from the itemized breakdown below (sum of monthly × 12).
                </p>
              )}
            </div>

            <div>
              <label htmlFor="vacancyRatePct" className="block text-sm font-medium text-foreground">
                Vacancy Rate (%)
              </label>
              <input
                id="vacancyRatePct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={vacancyRatePct}
                onChange={(e) => setVacancyRatePct(e.target.value)}
                placeholder="5"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Revenue deduction. Effective Income = Gross × (1 − vacancy %).
              </p>
            </div>

            <div>
              <label htmlFor="propertyManagementPct" className="block text-sm font-medium text-foreground">
                Property Management (%)
              </label>
              <input
                id="propertyManagementPct"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={propertyManagementPct}
                onChange={(e) => setPropertyManagementPct(e.target.value)}
                placeholder="0"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                % of Effective Income (collected rent). Added on top of Operating Expenses.
              </p>
            </div>

            <div>
              <label htmlFor="netOperatingIncome" className="block text-sm font-medium text-foreground">
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
                className={`mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring ${!scenarioId ? 'bg-muted' : ''}`}
              />
            </div>

            <div>
              <label htmlFor="netIncome" className="block text-sm font-medium text-foreground">
                Net Income ($)
              </label>
              <input
                id="netIncome"
                type="number"
                step="0.01"
                value={netIncome}
                onChange={(e) => setNetIncome(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="capRate" className="block text-sm font-medium text-foreground">
                Cap Rate (%)
              </label>
              <input
                id="capRate"
                type="number"
                step="0.01"
                value={capRate}
                onChange={(e) => setCapRate(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <Accordion
            type="multiple"
            defaultValue={[
              ...(initialData?.['Has Loan'] ? ['loan'] : []),
              ...(initialData?.expense_breakdown ? ['expense-breakdown'] : []),
            ]}
            className="mt-2"
          >
            <AccordionItem value="expense-breakdown">
              <AccordionTrigger className="text-base font-semibold">
                Expense Breakdown
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      id="useExpenseBreakdown"
                      type="checkbox"
                      checked={useExpenseBreakdown}
                      onChange={(e) => setUseExpenseBreakdown(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <label htmlFor="useExpenseBreakdown" className="text-sm font-medium cursor-pointer">
                      Use itemized expense breakdown
                    </label>
                  </div>
                  {useExpenseBreakdown && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Enter each cost in <strong>$/month</strong>. Operating Expenses (above) auto-updates to the annual sum.
                        Vacancy Rate and Property Management % live at the top of the form — they aren't part of this breakdown.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {([
                          { id: 'propertyTaxes', label: 'Property Taxes',      value: propertyTaxes, setter: setPropertyTaxes },
                          { id: 'insurance',     label: 'Insurance',           value: insurance,     setter: setInsurance },
                          { id: 'hoa',           label: 'HOA',                 value: hoa,           setter: setHoa },
                          { id: 'cdd',           label: 'CDD',                 value: cdd,           setter: setCdd },
                          { id: 'maintenance',   label: 'Maintenance / Repairs', value: maintenance, setter: setMaintenance },
                          { id: 'otherExpenses', label: 'Other',               value: otherExpenses, setter: setOtherExpenses },
                        ] as const).map(f => (
                          <div key={f.id}>
                            <label htmlFor={f.id} className="block text-sm font-medium text-foreground">
                              {f.label} ($/mo)
                            </label>
                            <input
                              id={f.id}
                              type="number"
                              min="0"
                              step="0.01"
                              value={f.value}
                              onChange={(e) => f.setter(e.target.value)}
                              placeholder="0.00"
                              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="closing-costs">
              <AccordionTrigger className="text-base font-semibold">
                Purchase Closing Costs
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="purchaseClosingCosts" className="block text-sm font-medium text-foreground">
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
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="annual-increases">
              <AccordionTrigger className="text-base font-semibold">
                Annual Increases
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="incomeIncrease" className="block text-sm font-medium text-foreground">
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
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="expensesIncrease" className="block text-sm font-medium text-foreground">
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
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="propertyValueIncrease" className="block text-sm font-medium text-foreground">
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
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="loan">
              <AccordionTrigger className="text-base font-semibold">
                Loan Information
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      id="hasLoan"
                      type="checkbox"
                      checked={hasLoan}
                      onChange={(e) => setHasLoan(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <label htmlFor="hasLoan" className="text-sm font-medium cursor-pointer">
                      Include Loan Information
                    </label>
                  </div>

                  {hasLoan && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-border">
                      <div>
                        <label htmlFor="loanTerm" className="block text-sm font-medium text-foreground">
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
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label htmlFor="downPaymentPercent" className="block text-sm font-medium text-foreground">
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
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label htmlFor="downPaymentAmount" className="block text-sm font-medium text-foreground">
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
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>

                      <div>
                        <label htmlFor="interestRate" className="block text-sm font-medium text-foreground">
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
                            className="block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="loanClosingCosts" className="block text-sm font-medium text-foreground">
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
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="taxable-income">
              <AccordionTrigger className="text-base font-semibold">
                Taxable Income
              </AccordionTrigger>
              <AccordionContent>
                <div>
                  <label htmlFor="taxableIncome" className="block text-sm font-medium text-foreground">
                    Taxable Income After Depreciation ($)
                  </label>
                  <input
                    id="taxableIncome"
                    type="number"
                    step="0.01"
                    value={taxableIncome}
                    onChange={(e) => setTaxableIncome(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end gap-3 pt-4">
            {scenarioId && (
              <button
                type="button"
                onClick={() => router.push(`/apps/property/properties/${propertyId}?scenario=${scenarioId}`)}
                className="rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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

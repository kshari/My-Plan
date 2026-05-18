'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, ChevronRight, ChevronLeft, Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_ANALYSIS_INTEREST_RATE, DEFAULT_DOWN_PAYMENT_PCT,
  DEFAULT_LOAN_TERM, DEFAULT_PURCHASE_CLOSING_COST_PCT, DEFAULT_LOAN_CLOSING_COST_PCT,
  DEFAULT_SALE_COST_PCT,
} from '@/lib/constants/property-defaults'
import { computeScenarioMetrics, fmtDollar } from '@/lib/property/compute-metrics'

interface Property {
  id: number
  address?: string | null
  'Asking Price': number | null
}

interface NewScenarioDialogProps {
  property: Property
  baseScenario?: Record<string, unknown>
  activeScenario?: Record<string, unknown>
  onClose: () => void
  onCreated: (scenario: Record<string, unknown>) => void
}

type StartingPoint = 'blank' | 'clone' | string // string = suggestion id

const SUGGESTIONS = [
  {
    id: 'allcash',
    label: 'All Cash',
    desc: 'No mortgage — sets loan to off',
    apply: (price: number, income: number, opex: number) => ({
      hasLoan: false, dp: price, dpPct: 100, rate: 0, term: 0,
    }),
  },
  {
    id: '20down30',
    label: '20% Down · 30yr',
    desc: 'Conservative financed baseline',
    apply: (price: number) => ({
      hasLoan: true, dpPct: 20, dp: price * 0.2, rate: DEFAULT_ANALYSIS_INTEREST_RATE, term: 30,
    }),
  },
  {
    id: '10down30',
    label: '10% Down · 30yr',
    desc: 'Lower down, higher leverage',
    apply: (price: number) => ({
      hasLoan: true, dpPct: 10, dp: price * 0.1, rate: DEFAULT_ANALYSIS_INTEREST_RATE, term: 30,
    }),
  },
  {
    id: '5down30',
    label: '5% Down FHA · 30yr',
    desc: 'Minimum down payment scenario',
    apply: (price: number) => ({
      hasLoan: true, dpPct: 5, dp: price * 0.05, rate: DEFAULT_ANALYSIS_INTEREST_RATE + 0.5, term: 30,
    }),
  },
  {
    id: 'stress',
    label: '−10% Rent Stress',
    desc: 'What if rent drops by 10%?',
    apply: (price: number, income: number, opex: number, hasLoan: boolean, dpPct: number, dp: number, rate: number, term: number) => ({
      hasLoan, dpPct, dp, rate, term, income: income * 0.9,
    }),
  },
  {
    id: '25down15',
    label: '25% Down · 15yr',
    desc: 'Aggressive payoff, faster equity',
    apply: (price: number) => ({
      hasLoan: true, dpPct: 25, dp: price * 0.25, rate: DEFAULT_ANALYSIS_INTEREST_RATE - 0.5, term: 15,
    }),
  },
]

export default function NewScenarioDialog({
  property, baseScenario, activeScenario, onClose, onCreated,
}: NewScenarioDialogProps) {
  const supabase = createClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [startingPoint, setStartingPoint] = useState<StartingPoint>('blank')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 2 — key numbers (seed from Base scenario; scenarios store annual values)
  const basePrice = +(baseScenario?.['Purchase Price'] ?? property['Asking Price'] ?? 0)
  const baseIncome = +(baseScenario?.['Gross Income'] ?? 0)
  const baseOpex = +(baseScenario?.['Operating Expenses'] ?? 0)

  const cloneIncome = activeScenario ? +(activeScenario['Gross Income'] ?? 0) || 0 : baseIncome
  const cloneOpex = activeScenario ? +(activeScenario['Operating Expenses'] ?? 0) || 0 : baseOpex
  const clonePrice = activeScenario ? +(activeScenario['Purchase Price'] ?? 0) || basePrice : basePrice

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [income, setIncome] = useState('')
  const [opex, setOpex] = useState('')

  // Step 3 — financing
  const [hasLoan, setHasLoan] = useState(true)
  const [dpPct, setDpPct] = useState(String(DEFAULT_DOWN_PAYMENT_PCT))
  const [rate, setRate] = useState(String(DEFAULT_ANALYSIS_INTEREST_RATE))
  const [term, setTerm] = useState(String(DEFAULT_LOAN_TERM))

  // Step 3 — closing costs (defaults seeded from base scenario; fall back to % of price/loan)
  const defaultPurchaseCC = baseScenario?.['Purchase Closing Costs'] != null
    ? String(+(baseScenario['Purchase Closing Costs'] ?? 0))
    : basePrice > 0 ? String(Math.round(basePrice * DEFAULT_PURCHASE_CLOSING_COST_PCT / 100)) : ''
  const defaultLoanCC = baseScenario?.['Closing Costs'] != null
    ? String(+(baseScenario['Closing Costs'] ?? 0))
    : basePrice > 0 ? String(Math.round(basePrice * (1 - DEFAULT_DOWN_PAYMENT_PCT / 100) * DEFAULT_LOAN_CLOSING_COST_PCT / 100)) : ''
  const [purchaseCC, setPurchaseCC] = useState(defaultPurchaseCC)
  const [loanCC, setLoanCC] = useState(defaultLoanCC)

  // Step 3 — growth rates (default to Base scenario values or 3%)
  const [incomeGrowth, setIncomeGrowth] = useState(String(+(baseScenario?.['Income Increase'] ?? 3)))
  const [expenseGrowth, setExpenseGrowth] = useState(String(+(baseScenario?.['Expenses Increase'] ?? 3)))
  const [propValueGrowth, setPropValueGrowth] = useState(String(+(baseScenario?.['Property Value Increase'] ?? 3)))
  const [vacancyRate, setVacancyRate] = useState(String(+(baseScenario?.['Vacancy Rate'] ?? 5)))
  const [propMgmtRate, setPropMgmtRate] = useState(String(+(baseScenario?.['Property Management Rate'] ?? 0)))
  const [saleCostRate, setSaleCostRate] = useState(
    String(+(baseScenario?.['Sale Cost Rate'] ?? DEFAULT_SALE_COST_PCT))
  )

  // Apply defaults when starting point changes
  useEffect(() => {
    if (startingPoint === 'blank') {
      setPrice(basePrice > 0 ? String(basePrice) : '')
      setIncome(baseIncome > 0 ? String(baseIncome) : '')
      setOpex(baseOpex > 0 ? String(baseOpex) : '')
      setHasLoan(true)
      setDpPct(String(DEFAULT_DOWN_PAYMENT_PCT))
      setRate(String(DEFAULT_ANALYSIS_INTEREST_RATE))
      setTerm(String(DEFAULT_LOAN_TERM))
      setPurchaseCC(defaultPurchaseCC)
      setLoanCC(defaultLoanCC)
    } else if (startingPoint === 'clone' && activeScenario) {
      setPrice(String(clonePrice))
      setIncome(String(cloneIncome))
      setOpex(String(cloneOpex))
      setHasLoan(!!activeScenario['Has Loan'])
      setDpPct(String(activeScenario['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT))
      setRate(String(activeScenario['Interest Rate'] ?? DEFAULT_ANALYSIS_INTEREST_RATE))
      setTerm(String(activeScenario['Loan Term'] ?? DEFAULT_LOAN_TERM))
      setPurchaseCC(String(+(activeScenario['Purchase Closing Costs'] ?? 0) || ''))
      setLoanCC(String(+(activeScenario['Closing Costs'] ?? 0) || ''))
    } else {
      // suggestion
      const sug = SUGGESTIONS.find(s => s.id === startingPoint)
      if (sug) {
        const srcPrice = clonePrice || basePrice
        const srcIncome = cloneIncome || baseIncome
        const srcOpex = cloneOpex || baseOpex
        const srcHasLoan = activeScenario ? !!activeScenario['Has Loan'] : true
        const srcDpPct = +(activeScenario?.['Down Payment Percentage'] ?? DEFAULT_DOWN_PAYMENT_PCT) || DEFAULT_DOWN_PAYMENT_PCT
        const srcDp = srcPrice * srcDpPct / 100
        const srcRate = +(activeScenario?.['Interest Rate'] ?? DEFAULT_ANALYSIS_INTEREST_RATE) || DEFAULT_ANALYSIS_INTEREST_RATE
        const srcTerm = +(activeScenario?.['Loan Term'] ?? DEFAULT_LOAN_TERM) || DEFAULT_LOAN_TERM
        const r = sug.apply(srcPrice, srcIncome, srcOpex, srcHasLoan, srcDpPct, srcDp, srcRate, srcTerm) as any
        setPrice(String(srcPrice))
        setIncome(r.income != null ? String(r.income) : String(srcIncome))
        setOpex(String(srcOpex))
        setHasLoan(r.hasLoan !== false)
        setDpPct(String(r.dpPct ?? DEFAULT_DOWN_PAYMENT_PCT))
        setRate(String(r.rate ?? DEFAULT_ANALYSIS_INTEREST_RATE))
        setTerm(String(r.term ?? DEFAULT_LOAN_TERM))
        setPurchaseCC(defaultPurchaseCC)
        setLoanCC(defaultLoanCC)
      }
    }
  }, [startingPoint])

  // Live preview metrics
  const preview = computeScenarioMetrics({
    'Purchase Price': parseFloat(price) || 0,
    'Gross Income': parseFloat(income) || 0,
    'Operating Expenses': parseFloat(opex) || 0,
    'Vacancy Rate': parseFloat(vacancyRate) || 0,
    'Property Management Rate': parseFloat(propMgmtRate) || 0,
    'Has Loan': hasLoan,
    'Down Payment Amount': hasLoan ? (parseFloat(price) || 0) * (parseFloat(dpPct) || 0) / 100 : (parseFloat(price) || 0),
    'Down Payment Percentage': parseFloat(dpPct) || 0,
    'Interest Rate': hasLoan ? (parseFloat(rate) || 0) : 0,
    'Loan Term': hasLoan ? (parseInt(term) || 0) : 0,
    'Purchase Closing Costs': parseFloat(purchaseCC) || 0,
    'Closing Costs': hasLoan ? (parseFloat(loanCC) || 0) : 0,
  })

  const handleCreate = async () => {
    setError(null)
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const dp = hasLoan ? (parseFloat(price) || 0) * (parseFloat(dpPct) || 0) / 100 : (parseFloat(price) || 0)
      const { data, error } = await supabase
        .from('pi_financial_scenarios')
        .insert([{
          'Property ID': property.id,
          'Scenario Name': name.trim() || (SUGGESTIONS.find(s => s.id === startingPoint)?.label ?? 'New Scenario'),
          'Purchase Price': parseFloat(price) || null,
          'Gross Income': parseFloat(income) || null,
          'Operating Expenses': parseFloat(opex) || null,
          'Has Loan': hasLoan,
          'Down Payment Percentage': hasLoan ? parseFloat(dpPct) || null : null,
          'Down Payment Amount': dp || null,
          'Interest Rate': hasLoan ? parseFloat(rate) || null : null,
          'Loan Term': hasLoan ? parseInt(term) || null : null,
          'Income Increase': parseFloat(incomeGrowth) ?? 3,
          'Expenses Increase': parseFloat(expenseGrowth) ?? 3,
          'Property Value Increase': parseFloat(propValueGrowth) ?? 3,
          'Vacancy Rate': parseFloat(vacancyRate) ?? 5,
          'Property Management Rate': parseFloat(propMgmtRate) ?? 0,
          'Purchase Closing Costs': parseFloat(purchaseCC) || null,
          'Closing Costs': hasLoan ? (parseFloat(loanCC) || null) : null,
          'Sale Cost Rate': parseFloat(saleCostRate) || DEFAULT_SALE_COST_PCT,
          // Inherit Current Market Value from the source scenario (clone) or
          // the Base scenario. Falls back to null so the IRR uses Purchase
          // Price unless the user later sets one explicitly.
          'Current Market Value':
            startingPoint === 'clone' && activeScenario
              ? (activeScenario['Current Market Value'] ?? null)
              : (baseScenario?.['Current Market Value'] ?? null),
        }])
        .select()
        .single()
      if (error) throw error
      onCreated(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold">New Scenario</h2>
            <p className="text-xs text-muted-foreground">
              Step {step} of 3 — {step === 1 ? 'Starting point' : step === 2 ? 'Key numbers' : 'Financing'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1 px-5 pt-3">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={cn('h-1 flex-1 rounded-full transition-colors',
                n <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ── Step 1 ─────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Scenario name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Conservative, Optimistic, All Cash…"
                  className={inputCls}
                />
              </div>

              <p className="text-sm font-medium mt-1">Start from:</p>

              <div className="grid gap-2">
                <StartOption
                  id="blank" label="Blank" desc="Start from property listing data" selected={startingPoint === 'blank'}
                  onClick={() => setStartingPoint('blank')}
                />
                {activeScenario && (
                  <StartOption
                    id="clone" label={`Clone "${activeScenario['Scenario Name'] || 'active scenario'}"`}
                    desc="Copy all assumptions from the current scenario"
                    selected={startingPoint === 'clone'}
                    onClick={() => setStartingPoint('clone')}
                  />
                )}
              </div>

              <p className="text-sm font-medium pt-1">Or pick a suggestion:</p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map(s => (
                  <StartOption
                    key={s.id} id={s.id} label={s.label} desc={s.desc}
                    selected={startingPoint === s.id}
                    onClick={() => setStartingPoint(s.id)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2 ─────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Purchase Price ($)</label>
                  <input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Annual Gross Income (rent) ($)</label>
                  <input type="number" min="0" value={income} onChange={e => setIncome(e.target.value)} placeholder="0" className={inputCls} />
                  {baseIncome > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Base scenario: {fmtDollar(baseIncome)}/yr ({fmtDollar(baseIncome / 12)}/mo)
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Annual Operating Expenses ($)</label>
                  <input type="number" min="0" value={opex} onChange={e => setOpex(e.target.value)} placeholder="0" className={inputCls} />
                </div>
              </div>

              {/* Live NOI preview */}
              {(parseFloat(income) > 0 || parseFloat(opex) > 0) && (
                <div className="rounded-lg bg-muted/30 border p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">NOI / yr (before mortgage)</span>
                  <span className={cn('font-semibold tabular-nums', preview.noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                    {fmtDollar(preview.noi)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3 ─────────────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLoan}
                  onChange={e => setHasLoan(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                Financed with mortgage
              </label>

              {hasLoan && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Down Payment (%)</label>
                    <input type="number" min="0" max="100" step="0.5" value={dpPct} onChange={e => setDpPct(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Interest Rate (%)</label>
                    <input type="number" min="0" max="25" step="0.125" value={rate} onChange={e => setRate(e.target.value)} className={inputCls} />
                    <p className="mt-1 text-[11px] text-muted-foreground/70">Fixed rate for full loan term — ARM resets not modeled.</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Term (years)</label>
                    <select value={term} onChange={e => setTerm(e.target.value)} className={inputCls}>
                      <option value="15">15</option>
                      <option value="20">20</option>
                      <option value="30">30</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Closing costs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Purchase Closing Costs ($)
                    <span className="ml-1 opacity-60">(title, taxes, inspection — ~{DEFAULT_PURCHASE_CLOSING_COST_PCT}%)</span>
                  </label>
                  <input type="number" min="0" value={purchaseCC} onChange={e => setPurchaseCC(e.target.value)} placeholder="0" className={inputCls} />
                </div>
                {hasLoan && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Loan Closing Costs ($)
                      <span className="ml-1 opacity-60">(origination, appraisal — ~{DEFAULT_LOAN_CLOSING_COST_PCT}%)</span>
                    </label>
                    <input type="number" min="0" value={loanCC} onChange={e => setLoanCC(e.target.value)} placeholder="0" className={inputCls} />
                  </div>
                )}
              </div>

              {/* Growth rates */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Rent Growth %/yr</label>
                  <input type="number" min="0" max="20" step="0.5" value={incomeGrowth} onChange={e => setIncomeGrowth(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Expense Growth %/yr</label>
                  <input type="number" min="0" max="20" step="0.5" value={expenseGrowth} onChange={e => setExpenseGrowth(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Appreciation %/yr</label>
                  <input type="number" min="0" max="20" step="0.5" value={propValueGrowth} onChange={e => setPropValueGrowth(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Vacancy Rate %</label>
                  <input type="number" min="0" max="50" step="0.5" value={vacancyRate} onChange={e => setVacancyRate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Property Management % of rent (0 = self-managed)</label>
                  <input type="number" min="0" max="30" step="0.5" value={propMgmtRate} onChange={e => setPropMgmtRate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Sale Costs % (realtor + closing)</label>
                  <input type="number" min="0" max="15" step="0.5" value={saleCostRate} onChange={e => setSaleCostRate(e.target.value)} className={inputCls} />
                  <p className="mt-1 text-[10px] text-muted-foreground/70">Applied to sale proceeds in IRR. Typical: 6–8%.</p>
                </div>
              </div>

              {/* Live metrics preview */}
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground text-xs">Cap Rate</span>
                  <span className={cn('text-xs font-semibold tabular-nums text-right',
                    preview.capRate >= 8 ? 'text-emerald-600 dark:text-emerald-400' : preview.capRate >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                  )}>{preview.capRate.toFixed(2)}%</span>

                  {hasLoan && <>
                    <span className="text-muted-foreground text-xs">Monthly Payment</span>
                    <span className="text-xs tabular-nums text-right">{fmtDollar(preview.monthlyMortgage)}</span>
                  </>}

                  <span className="text-muted-foreground text-xs">Cash / month</span>
                  <span className={cn('text-xs font-semibold tabular-nums text-right',
                    preview.monthlyCF >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  )}>{fmtDollar(preview.monthlyCF)}</span>

                  <span className="text-muted-foreground text-xs">Cash-on-Cash</span>
                  <span className={cn('text-xs font-semibold tabular-nums text-right',
                    preview.cocr >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  )}>{preview.cocr.toFixed(1)}%</span>

                  <span className="text-muted-foreground text-xs">Cash Invested</span>
                  <span className="text-xs tabular-nums text-right">{fmtDollar(preview.totalCashInvested)}</span>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />Back
            </button>
          ) : <span />}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating…' : <><Check className="h-4 w-4" />Create Scenario</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StartOption({
  id, label, desc, selected, onClick, compact,
}: {
  id: string; label: string; desc: string; selected: boolean; onClick: () => void; compact?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border p-3 transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
        compact && 'p-2.5'
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors', selected ? 'border-primary bg-primary' : 'border-muted-foreground/50')} />
        <p className={cn('text-sm font-medium', compact && 'text-xs')}>{label}</p>
      </div>
      <p className={cn('text-xs text-muted-foreground mt-0.5', compact ? 'ml-5.5' : 'ml-5.5')}>{desc}</p>
    </button>
  )
}

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Building2, ArrowRight, Plus, Trash2, ChevronDown, ChevronUp, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import FinancialMetrics from '@/components/property/financial-metrics'
import PLTable from '@/components/property/pl-table'
import { PROPERTY_TYPES } from '@/lib/constants/property-defaults'

const LOCAL_KEY = 'pi_try_data'

interface TryScenario {
  id: number
  'Scenario Name': string
  'Purchase Price': number
  'Gross Income': number
  'Operating Expenses': number
  'Has Loan': boolean
  'Loan Term': number | null
  'Down Payment Percentage': number | null
  'Down Payment Amount': number | null
  'Interest Rate': number | null
  'Closing Costs': number | null
  'Purchase Closing Costs': number | null
  'Monthly Mortgage': number | null
  'Income Increase': number
  'Expenses Increase': number
  'Property Value Increase': number
  'Cap Rate': number | null
  'Net Income': number | null
  expense_breakdown?: {
    property_taxes: number
    insurance: number
    maintenance: number
    management_fee: number
    vacancy_rate: number
    other: number
  } | null
}

interface TryProperty {
  address: string
  type: string
  askingPrice: number
  grossIncome: number
  operatingExpenses: number
  units: number
}

interface TryData {
  property: TryProperty
  scenarios: TryScenario[]
  nextId: number
}

const EMPTY_DATA: TryData = {
  property: { address: '', type: '', askingPrice: 0, grossIncome: 0, operatingExpenses: 0, units: 1 },
  scenarios: [],
  nextId: 1,
}

function createScenario(id: number, property: TryProperty): TryScenario {
  return {
    id,
    'Scenario Name': `Scenario ${id}`,
    'Purchase Price': property.askingPrice,
    'Gross Income': property.grossIncome,
    'Operating Expenses': property.operatingExpenses,
    'Has Loan': false,
    'Loan Term': null,
    'Down Payment Percentage': null,
    'Down Payment Amount': null,
    'Interest Rate': null,
    'Closing Costs': null,
    'Purchase Closing Costs': null,
    'Monthly Mortgage': null,
    'Income Increase': 0,
    'Expenses Increase': 0,
    'Property Value Increase': 0,
    'Cap Rate': null,
    'Net Income': null,
  }
}

export default function TryPropertyPage() {
  const [data, setData] = useState<TryData>(EMPTY_DATA)
  const [loaded, setLoaded] = useState(false)
  const [expandedScenario, setExpandedScenario] = useState<number | null>(null)
  const [showPL, setShowPL] = useState<number | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY)
      if (saved) setData(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  const save = useCallback((d: TryData) => {
    setData(d)
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)) } catch {}
  }, [])

  const updateProperty = useCallback((updates: Partial<TryProperty>) => {
    save({ ...data, property: { ...data.property, ...updates } })
  }, [data, save])

  const addScenario = useCallback(() => {
    if (data.scenarios.length >= 3) {
      toast.error('Try mode supports up to 3 scenarios. Create an account for unlimited.')
      return
    }
    const newScenario = createScenario(data.nextId, data.property)
    save({ ...data, scenarios: [...data.scenarios, newScenario], nextId: data.nextId + 1 })
    setExpandedScenario(data.nextId)
  }, [data, save])

  const updateScenario = useCallback((id: number, updates: Partial<TryScenario>) => {
    save({
      ...data,
      scenarios: data.scenarios.map(s => s.id === id ? { ...s, ...updates } : s),
    })
  }, [data, save])

  const deleteScenario = useCallback((id: number) => {
    save({ ...data, scenarios: data.scenarios.filter(s => s.id !== id) })
    if (expandedScenario === id) setExpandedScenario(null)
    toast.success('Scenario deleted')
  }, [data, save, expandedScenario])

  const resetAll = useCallback(() => {
    save(EMPTY_DATA)
    toast.success('All data cleared')
  }, [save])

  if (!loaded) return null

  const hasProperty = data.property.address.length > 0

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-800/50 px-4 py-2.5 text-center text-sm">
        <span className="text-muted-foreground">Your data lives in this browser only. </span>
        <Link href="/login?signup=1" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          Create a free account
        </Link>
        <span className="text-muted-foreground"> to save it permanently.</span>
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="bg-border w-px self-stretch mx-1 hidden sm:block" aria-hidden />
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight">Property Investment</span>
            <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">Try Mode</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {!hasProperty ? (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-900/30">
              <Building2 className="h-7 w-7 text-blue-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Try Property Investment</h1>
            <p className="mx-auto max-w-md text-muted-foreground">
              Enter a property below to analyze financial scenarios, compare returns, and explore P&L projections.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{data.property.address}</h1>
              <p className="text-sm text-muted-foreground">
                {data.property.type && `${data.property.type} · `}
                {data.property.askingPrice > 0 && `$${data.property.askingPrice.toLocaleString()}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetAll}>
                Reset All
              </Button>
              {data.scenarios.length < 3 && (
                <Button size="sm" onClick={addScenario}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Scenario
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Property form */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Property Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Address *</label>
              <input
                type="text"
                value={data.property.address}
                onChange={(e) => updateProperty({ address: e.target.value })}
                placeholder="123 Main St, City, State"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Type</label>
              <select
                value={data.property.type}
                onChange={(e) => updateProperty({ type: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select type</option>
                {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Units</label>
              <input
                type="number"
                min="1"
                value={data.property.units || ''}
                onChange={(e) => updateProperty({ units: parseInt(e.target.value) || 1 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Asking Price ($)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={data.property.askingPrice || ''}
                onChange={(e) => updateProperty({ askingPrice: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Gross Income ($/yr)</label>
              <input
                type="number"
                min="0"
                value={data.property.grossIncome || ''}
                onChange={(e) => updateProperty({ grossIncome: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Operating Expenses ($/yr)</label>
              <input
                type="number"
                min="0"
                value={data.property.operatingExpenses || ''}
                onChange={(e) => updateProperty({ operatingExpenses: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {hasProperty && data.scenarios.length === 0 && (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-3">Add a scenario to analyze this property&apos;s financials.</p>
            <Button onClick={addScenario}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Scenario
            </Button>
          </div>
        )}

        {/* Scenarios */}
        {data.scenarios.map(scenario => {
          const isExpanded = expandedScenario === scenario.id
          const noi = (scenario['Gross Income'] || 0) - (scenario['Operating Expenses'] || 0)
          const capRate = scenario['Purchase Price'] > 0 ? ((noi / scenario['Purchase Price']) * 100).toFixed(2) : '0.00'

          return (
            <div key={scenario.id} className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedScenario(isExpanded ? null : scenario.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold">{scenario['Scenario Name']}</h3>
                  <span className="text-xs text-muted-foreground">
                    Cap Rate: {capRate}% · NOI: ${noi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteScenario(scenario.id) }}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t p-4 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Scenario Name</label>
                      <input
                        type="text"
                        value={scenario['Scenario Name']}
                        onChange={(e) => updateScenario(scenario.id, { 'Scenario Name': e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Purchase Price ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={scenario['Purchase Price'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Purchase Price': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Gross Income ($/yr)</label>
                      <input
                        type="number"
                        min="0"
                        value={scenario['Gross Income'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Gross Income': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Operating Expenses ($/yr)</label>
                      <input
                        type="number"
                        min="0"
                        value={scenario['Operating Expenses'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Operating Expenses': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Purchase Closing Costs ($)</label>
                      <input
                        type="number"
                        min="0"
                        value={scenario['Purchase Closing Costs'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Purchase Closing Costs': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Income Increase (%/yr)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={scenario['Income Increase'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Income Increase': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Expenses Increase (%/yr)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={scenario['Expenses Increase'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Expenses Increase': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Property Value Increase (%/yr)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={scenario['Property Value Increase'] || ''}
                        onChange={(e) => updateScenario(scenario.id, { 'Property Value Increase': parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {/* Loan toggle */}
                  <div className="border-t border-border pt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scenario['Has Loan']}
                        onChange={(e) => updateScenario(scenario.id, { 'Has Loan': e.target.checked })}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                      />
                      <span className="text-sm font-medium">Include Loan</span>
                    </label>
                    {scenario['Has Loan'] && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6 border-l-2 border-border">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Loan Term (years)</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={scenario['Loan Term'] || ''}
                            onChange={(e) => {
                              const term = parseInt(e.target.value) || null
                              updateScenario(scenario.id, { 'Loan Term': term })
                            }}
                            placeholder="30"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Down Payment (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={scenario['Down Payment Percentage'] || ''}
                            onChange={(e) => {
                              const pct = parseFloat(e.target.value) || 0
                              const amt = scenario['Purchase Price'] * (pct / 100)
                              updateScenario(scenario.id, {
                                'Down Payment Percentage': pct,
                                'Down Payment Amount': amt,
                              })
                            }}
                            placeholder="20"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Interest Rate (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="25"
                            step="0.01"
                            value={scenario['Interest Rate'] || ''}
                            onChange={(e) => updateScenario(scenario.id, { 'Interest Rate': parseFloat(e.target.value) || null })}
                            placeholder="7.0"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-1">Loan Closing Costs ($)</label>
                          <input
                            type="number"
                            min="0"
                            value={scenario['Closing Costs'] || ''}
                            onChange={(e) => updateScenario(scenario.id, { 'Closing Costs': parseFloat(e.target.value) || null })}
                            placeholder="0"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <FinancialMetrics scenario={scenario} showTitle={false} />

                  {/* P&L toggle */}
                  <div className="border-t border-border pt-4">
                    <button
                      onClick={() => setShowPL(showPL === scenario.id ? null : scenario.id)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {showPL === scenario.id ? 'Hide' : 'Show'} Year-by-Year P&L
                    </button>
                    {showPL === scenario.id && (
                      <div className="mt-4">
                        <PLTable scenario={scenario} years={10} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* CTA */}
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Ready to save your properties and unlock unlimited scenarios?</p>
          <Link href="/login?signup=1">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Free Account <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

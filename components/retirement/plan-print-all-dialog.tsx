'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Printer, X, Zap, BarChart2, Settings, Check } from 'lucide-react'

// These match the app's actual tabs in retirement-plan-tabs.tsx
const PAGE_GROUPS = [
  {
    id: 'quick',
    label: 'Quick Projections',
    icon: Zap,
    color: 'text-blue-600',
    pages: [
      {
        id: 'quick-analysis',
        label: 'Quick Projections',
        desc: 'Confidence score, income estimate, yearly projections chart & table',
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced Analysis',
    icon: BarChart2,
    color: 'text-purple-600',
    pages: [
      {
        id: 'details',
        label: 'Projections Table',
        desc: 'Year-by-year projections table with income, expenses, net worth, and all account columns',
      },
      {
        id: 'strategy-modeling',
        label: 'Withdrawal Strategy Modeling',
        desc: 'Strategy modeler and comparison table for all withdrawal strategies',
      },
      {
        id: 'scenario-modeling',
        label: 'Scenario Modeling — Net Worth',
        desc: 'How different growth rates affect ending net worth across retirement ages',
      },
      {
        id: 'scenario-modeling-income',
        label: 'Monthly Income Scenario Modeling',
        desc: 'How different growth rates affect estimated monthly retirement income',
      },
      {
        id: 'monte-carlo',
        label: 'Market Risk & Monte Carlo Analysis',
        desc: 'Market risk analysis and Monte Carlo simulation results',
      },
      {
        id: 'roth-conversion',
        label: 'Tax Efficiency & Roth Conversion Savings Details',
        desc: 'Roth conversion strategy, optimal amounts, and year-by-year conversion table',
      },
      {
        id: 'ssa-analysis',
        label: 'Social Security Withdrawal Analysis',
        desc: 'Break-even analysis for SSA start age and lifetime benefit comparison',
      },
    ],
  },
  {
    id: 'setup',
    label: 'Plan Setup',
    icon: Settings,
    color: 'text-gray-600',
    pages: [
      {
        id: 'plan-details',
        label: 'Plan Setup',
        desc: 'Accounts, expenses, calculator assumptions, and plan configuration',
      },
      {
        id: 'other-income',
        label: 'Other Income',
        desc: 'Pensions, rental income, and other recurring income sources',
      },
    ],
  },
]

const ALL_PAGE_IDS = PAGE_GROUPS.flatMap(g => g.pages.map(p => p.id))

const PRESETS: Record<string, string[]> = {
  quick: ['quick-analysis'],
  advanced: [
    'quick-analysis',
    'details',
    'strategy-modeling',
    'scenario-modeling',
    'scenario-modeling-income',
    'monte-carlo',
    'roth-conversion',
    'ssa-analysis',
  ],
  all: ALL_PAGE_IDS,
}

interface PlanPrintAllDialogProps {
  planId: number
  scenarioId?: number | null
  planName?: string
}

export function PlanPrintAllDialog({ planId, scenarioId, planName }: PlanPrintAllDialogProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(PRESETS.all))
  const [activePreset, setActivePreset] = useState<string | null>('all')

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setActivePreset(null)
  }

  const applyPreset = (preset: string) => {
    setSelected(new Set(PRESETS[preset]))
    setActivePreset(preset)
  }

  const printPages = () => {
    if (selected.size === 0) return
    const pages = Array.from(selected).join(',')
    const url = `/apps/retirement/plans/${planId}/print-all?pages=${encodeURIComponent(pages)}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`
    window.open(url, '_blank')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="rounded-md bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <Printer className="h-4 w-4" />
          <span>Print all Pages in the Plan</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-gray-700" />
              <Dialog.Title className="text-lg font-semibold">Print all Pages in the Plan</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1.5 hover:bg-gray-100 text-gray-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {planName && (
              <p className="text-sm text-gray-500 mb-3">
                Plan: <span className="font-medium text-gray-700">{planName}</span>
              </p>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-5">
              <p className="text-xs text-blue-800 leading-relaxed">
                <strong>How it works:</strong> Opens a new tab that renders each selected page exactly
                as it appears in the app — including all charts and tables. Data loads in the background
                (usually 5–15 seconds). Click <strong>Print / Save as PDF</strong> when all pages look ready.
              </p>
            </div>

            {/* Preset buttons */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Select</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'quick', label: 'Quick Only', icon: Zap },
                  { key: 'advanced', label: 'Core Pages', icon: BarChart2 },
                  { key: 'all', label: 'All Pages', icon: Check },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activePreset === key
                        ? 'bg-gray-800 border-gray-800 text-white'
                        : 'hover:bg-gray-50 hover:border-gray-400 text-gray-600'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
                <button
                  onClick={() => { setSelected(new Set()); setActivePreset(null) }}
                  className="rounded-full border px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Page groups */}
            <div className="space-y-5">
              {PAGE_GROUPS.map(group => {
                const Icon = group.icon
                const groupSelected = group.pages.filter(p => selected.has(p.id)).length
                const allGroupSelected = groupSelected === group.pages.length

                return (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${group.color}`} />
                        <h3 className="text-sm font-semibold text-gray-700">{group.label}</h3>
                      </div>
                      <button
                        onClick={() => {
                          const ids = group.pages.map(p => p.id)
                          setSelected(prev => {
                            const next = new Set(prev)
                            if (allGroupSelected) {
                              ids.forEach(id => next.delete(id))
                            } else {
                              ids.forEach(id => next.add(id))
                            }
                            return next
                          })
                          setActivePreset(null)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {allGroupSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="space-y-2.5 pl-1">
                      {group.pages.map(page => (
                        <label key={page.id} className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative mt-0.5 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={selected.has(page.id)}
                              onChange={() => toggle(page.id)}
                              className="h-4 w-4 rounded border-gray-300 text-gray-800 cursor-pointer"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 leading-tight">
                              {page.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{page.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex-shrink-0 flex items-center justify-between bg-gray-50 rounded-b-xl">
            <p className="text-xs text-gray-500">
              {selected.size} page{selected.size !== 1 ? 's' : ''} selected
              {selected.size > 0 && ' · Opens in new tab'}
            </p>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={printPages}
                disabled={selected.size === 0}
                className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Open Print Preview
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

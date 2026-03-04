'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { FileDown, X, Zap, BarChart2, Settings, Check } from 'lucide-react'

const SECTION_GROUPS = [
  {
    id: 'quick',
    label: 'Quick Projections',
    icon: Zap,
    color: 'text-blue-600',
    sections: [
      {
        id: 'plan-summary',
        label: 'Plan Summary',
        desc: 'Confidence score, monthly income, years money lasts, net worth',
      },
      {
        id: 'assumptions',
        label: 'Plan Assumptions',
        desc: 'Growth rates, SSA income, healthcare premiums, inflation',
      },
      {
        id: 'yearly-projections',
        label: 'Yearly Projections',
        desc: 'Year-by-year income, expenses, and net worth (retirement years)',
      },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced Analysis',
    icon: BarChart2,
    color: 'text-purple-600',
    sections: [
      {
        id: 'advanced-projections',
        label: 'Advanced Projections',
        desc: 'Full projection table with all withdrawal and balance columns',
      },
      {
        id: 'scenario-modeling',
        label: 'Scenario Modeling',
        desc: 'All saved scenarios with their key assumptions',
      },
      {
        id: 'risk-analysis',
        label: 'Risk Analysis',
        desc: 'Longevity, cashflow coverage, and portfolio stress summary',
      },
      {
        id: 'tax-efficiency',
        label: 'Tax Efficiency',
        desc: 'Lifetime taxes, after-tax income, and Roth vs. traditional breakdown',
      },
    ],
  },
  {
    id: 'setup',
    label: 'Plan Setup',
    icon: Settings,
    color: 'text-gray-600',
    sections: [
      {
        id: 'plan-details',
        label: 'Plan Details',
        desc: 'Ages, filing status, life expectancy',
      },
      {
        id: 'accounts',
        label: 'Accounts',
        desc: 'Account balances and annual contributions',
      },
      {
        id: 'expenses',
        label: 'Expenses',
        desc: 'Living expenses and healthcare costs by age bracket',
      },
    ],
  },
]

const ALL_SECTION_IDS = SECTION_GROUPS.flatMap(g => g.sections.map(s => s.id))

const PRESETS: Record<string, string[]> = {
  quick: ['plan-summary', 'assumptions', 'yearly-projections'],
  advanced: [
    'plan-summary',
    'assumptions',
    'advanced-projections',
    'scenario-modeling',
    'risk-analysis',
    'tax-efficiency',
  ],
  all: ALL_SECTION_IDS,
}

interface PlanPdfDialogProps {
  planId: number
  scenarioId?: number | null
  planName?: string
}

export function PlanPdfDialog({ planId, scenarioId, planName }: PlanPdfDialogProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(PRESETS.quick))
  const [activePreset, setActivePreset] = useState<string | null>('quick')

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

  const generate = () => {
    if (selected.size === 0) return
    const sections = Array.from(selected).join(',')
    const url = `/apps/retirement/plans/${planId}/print?sections=${encodeURIComponent(sections)}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`
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
          <FileDown className="h-4 w-4" />
          <span>Download Plan PDF</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-600" />
              <Dialog.Title className="text-lg font-semibold">Download Plan PDF</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1.5 hover:bg-gray-100 text-gray-500 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body — scrollable */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {planName && (
              <p className="text-sm text-gray-500 mb-4">
                Plan: <span className="font-medium text-gray-700">{planName}</span>
              </p>
            )}

            {/* Preset buttons */}
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Select</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'quick', label: 'Quick Projections', icon: Zap },
                  { key: 'advanced', label: 'Advanced', icon: BarChart2 },
                  { key: 'all', label: 'All Sections', icon: Check },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      activePreset === key
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 text-gray-600'
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

            {/* Section groups */}
            <div className="space-y-5">
              {SECTION_GROUPS.map(group => {
                const Icon = group.icon
                const groupSelected = group.sections.filter(s => selected.has(s.id)).length
                const allGroupSelected = groupSelected === group.sections.length

                return (
                  <div key={group.id}>
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${group.color}`} />
                        <h3 className="text-sm font-semibold text-gray-700">{group.label}</h3>
                      </div>
                      <button
                        onClick={() => {
                          const ids = group.sections.map(s => s.id)
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
                      {group.sections.map(section => (
                        <label key={section.id} className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative mt-0.5 flex-shrink-0">
                            <input
                              type="checkbox"
                              checked={selected.has(section.id)}
                              onChange={() => toggle(section.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 leading-tight">
                              {section.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{section.desc}</p>
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
              {selected.size} section{selected.size !== 1 ? 's' : ''} selected
              {selected.size > 0 && ' · Opens in new tab'}
            </p>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={generate}
                disabled={selected.size === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                Generate PDF
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

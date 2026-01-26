'use client'

import { useState, useEffect } from 'react'
import { ScenarioProvider } from './scenario-context'
import SnapshotTab from './tabs/snapshot-tab'
import PlanDetailsTab from './tabs/plan-details-tab'
import OtherIncomeTab from './tabs/other-income-tab'
import CompoundingTab from './tabs/compounding-tab'
import DetailsTab from './tabs/details-tab'
import AnalysisTab from './tabs/analysis-tab'
import TaxEfficiencyTab from './tabs/tax-efficiency-tab'

interface RetirementPlanTabsProps {
  planId: number
}

const simpleTabs = [
  { id: 'snapshot', label: 'Your Snapshot', icon: '🏠' },
]

const advancedTabs = [
  { id: 'plan-details', label: 'Plan Summary', icon: '⚙️', description: 'Your retirement profile and assumptions' },
  { id: 'compounding', label: 'Compounding', icon: '📈', description: 'See how your savings grow over time' },
  { id: 'details', label: 'Projections', icon: '📋', description: 'Year-by-year retirement projections' },
  { id: 'analysis', label: 'Risk Analysis', icon: '📊', description: 'Understand risks and opportunities' },
  { id: 'tax-efficiency', label: 'Tax Efficiency', icon: '💰', description: 'Optimize your tax strategy' },
  { id: 'other-income', label: 'Other Income', icon: '📊', description: 'Additional income sources', disabled: true },
]

export default function RetirementPlanTabs({ planId }: RetirementPlanTabsProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'advanced'>('simple')
  const [activeTab, setActiveTab] = useState('snapshot')

  // Listen for tab switch events from child components
  useEffect(() => {
    const handleSwitchTab = (e: CustomEvent) => {
      setActiveTab(e.detail)
      if (e.detail !== 'snapshot') {
        setViewMode('advanced')
      }
    }
    window.addEventListener('switchTab', handleSwitchTab as EventListener)
    return () => {
      window.removeEventListener('switchTab', handleSwitchTab as EventListener)
    }
  }, [])

  const handleSwitchToAdvanced = () => {
    setViewMode('advanced')
    setActiveTab('plan-details')
  }

  const tabs = viewMode === 'simple' ? simpleTabs : advancedTabs

  return (
    <ScenarioProvider planId={planId}>
      <div className="rounded-lg bg-white shadow">
        {/* View Mode Switcher */}
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <button
                onClick={() => {
                  setViewMode('simple')
                  setActiveTab('snapshot')
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'simple'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => {
                  setViewMode('advanced')
                  if (activeTab === 'snapshot') {
                    setActiveTab('plan-details')
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'advanced'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Advanced
              </button>
            </div>
            {viewMode === 'simple' && (
              <button
                onClick={handleSwitchToAdvanced}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <span>Need more control?</span>
                <span>→</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        {viewMode === 'advanced' && (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-2 border-b border-gray-200">
              <p className="text-xs text-gray-600">
                <strong>Advanced Mode:</strong> Full control over all assumptions and detailed modeling. 
                <button
                  onClick={() => {
                    setViewMode('simple')
                    setActiveTab('snapshot')
                  }}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Switch back to Simple view
                </button>
              </p>
            </div>
            <nav className="flex overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => {
                const isDisabled = 'disabled' in tab ? (tab.disabled as boolean) : false
                const description = 'description' in tab ? (tab.description as string) : ''
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    title={description}
                    className={`
                      flex flex-col items-start sm:flex-row sm:items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium
                      ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
                      }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-base sm:text-lg">{tab.icon}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                    </div>
                    {description && (
                      <span className="text-xs text-gray-500 hidden lg:inline">{description}</span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'snapshot' && <SnapshotTab planId={planId} onSwitchToAdvanced={handleSwitchToAdvanced} />}
          {activeTab === 'plan-details' && <PlanDetailsTab planId={planId} />}
          {activeTab === 'compounding' && <CompoundingTab planId={planId} />}
          {activeTab === 'details' && <DetailsTab planId={planId} />}
          {activeTab === 'analysis' && <AnalysisTab planId={planId} />}
          {activeTab === 'tax-efficiency' && <TaxEfficiencyTab planId={planId} />}
          {activeTab === 'other-income' && <OtherIncomeTab planId={planId} />}
        </div>
      </div>
    </ScenarioProvider>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { ScenarioProvider } from './scenario-context'
import SnapshotTab from './tabs/snapshot-tab'
import PlanDetailsTab from './tabs/plan-details-tab'
import OtherIncomeTab from './tabs/other-income-tab'
import DetailsTab from './tabs/details-tab'
import AnalysisTab from './tabs/analysis-tab'
import TaxEfficiencyTab from './tabs/tax-efficiency-tab'
import ScenarioModelingTab from './tabs/scenario-modeling-tab'
import OtherToolsTab from './tabs/other-tools-tab'

interface RetirementPlanTabsProps {
  planId: number
}

const simpleTabs = [
  { id: 'snapshot', label: 'Your Snapshot', icon: '🏠' },
]

const advancedTabs = [
  { id: 'plan-details', label: 'Plan Summary', icon: '⚙️', description: 'Your retirement profile and assumptions' },
  { id: 'scenario-modeling', label: 'Scenario Modeling', icon: '📉', description: 'Model different retirement scenarios' },
  { id: 'details', label: 'Projections', icon: '📋', description: 'Year-by-year retirement projections' },
  { id: 'analysis', label: 'Risk Analysis', icon: '📊', description: 'Understand risks and opportunities' },
  { id: 'tax-efficiency', label: 'Tax Efficiency', icon: '💰', description: 'Optimize your tax strategy' },
  { id: 'other-tools', label: 'Other Tools', icon: '🛠️', description: 'Additional retirement planning tools' },
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
        {/* Advanced Mode Header and Tab Navigation */}
        {viewMode === 'advanced' && (
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-4 py-4 border-b border-gray-200">
              <p className="text-sm text-gray-700">
                <strong>Advanced Mode:</strong> Full control over all assumptions and detailed modeling.{' '}
                <button
                  onClick={() => {
                    setViewMode('simple')
                    setActiveTab('snapshot')
                  }}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Switch back to Quick Summary
                </button>
              </p>
            </div>
            <nav className="flex flex-wrap gap-0" aria-label="Tabs">
              {tabs.map((tab) => {
                const isDisabled = 'disabled' in tab ? (tab.disabled as boolean) : false
                return (
                  <button
                    key={tab.id}
                    onClick={() => !isDisabled && setActiveTab(tab.id)}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium
                      ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
                      }
                      ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <span className="text-base">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        )}

        {/* Simple Mode - Quick Summary */}
        {viewMode === 'simple' && (
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                <strong>Quick Summary:</strong> Quick overview with key retirement metrics and projections.{' '}
                <button
                  onClick={handleSwitchToAdvanced}
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Take More Control
                </button>
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'snapshot' && <SnapshotTab planId={planId} onSwitchToAdvanced={handleSwitchToAdvanced} />}
          {activeTab === 'plan-details' && <PlanDetailsTab planId={planId} />}
          {activeTab === 'scenario-modeling' && <ScenarioModelingTab planId={planId} />}
          {activeTab === 'details' && <DetailsTab planId={planId} />}
          {activeTab === 'analysis' && <AnalysisTab planId={planId} />}
          {activeTab === 'tax-efficiency' && <TaxEfficiencyTab planId={planId} />}
          {activeTab === 'other-tools' && <OtherToolsTab planId={planId} />}
          {activeTab === 'other-income' && <OtherIncomeTab planId={planId} />}
        </div>
      </div>
    </ScenarioProvider>
  )
}

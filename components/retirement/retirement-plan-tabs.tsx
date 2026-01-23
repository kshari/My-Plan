'use client'

import { useState } from 'react'
import { ScenarioProvider } from './scenario-context'
import PlanDetailsTab from './tabs/plan-details-tab'
import OtherIncomeTab from './tabs/other-income-tab'
import CompoundingTab from './tabs/compounding-tab'
import DetailsTab from './tabs/details-tab'
import AnalysisTab from './tabs/analysis-tab'

interface RetirementPlanTabsProps {
  planId: number
}

const tabs = [
  { id: 'plan-details', label: 'Plan Summary', icon: '⚙️' },
  { id: 'compounding', label: 'Compounding', icon: '📈' },
  { id: 'details', label: 'Projections', icon: '📋' },
  { id: 'analysis', label: 'Analysis', icon: '📊' },
  { id: 'other-income', label: 'Other Income', icon: '📊', disabled: true },
]

export default function RetirementPlanTabs({ planId }: RetirementPlanTabsProps) {
  const [activeTab, setActiveTab] = useState('plan-details')

  return (
    <ScenarioProvider planId={planId}>
      <div className="rounded-lg bg-white shadow">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                disabled={tab.disabled}
                className={`
                  flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
                  }
                  ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="text-base sm:text-lg">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'plan-details' && <PlanDetailsTab planId={planId} />}
          {activeTab === 'compounding' && <CompoundingTab planId={planId} />}
          {activeTab === 'details' && <DetailsTab planId={planId} />}
          {activeTab === 'analysis' && <AnalysisTab planId={planId} />}
          {activeTab === 'other-income' && <OtherIncomeTab planId={planId} />}
        </div>
      </div>
    </ScenarioProvider>
  )
}

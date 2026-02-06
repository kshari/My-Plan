'use client'

import { useState } from 'react'
import CompoundingTab from './compounding-tab'

interface OtherToolsTabProps {
  planId: number
}

const subTabs = [
  { id: 'compounding', label: 'Compounding', icon: '📈', description: 'See how your savings grow over time' },
]

export default function OtherToolsTab({ planId }: OtherToolsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState('compounding')

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div className="mb-4 border-b border-gray-200 overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-2 sm:px-1 py-3 sm:py-4 text-sm font-medium ${
                activeSubTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-700 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              <span className="text-base mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab Content */}
      <div>
        {activeSubTab === 'compounding' && <CompoundingTab planId={planId} />}
      </div>
    </div>
  )
}

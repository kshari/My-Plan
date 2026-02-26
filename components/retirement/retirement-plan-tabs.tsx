'use client'

import { useState, useEffect } from 'react'
import {
  LayoutGrid,
  SlidersHorizontal,
  GitBranch,
  BarChart2,
  ShieldAlert,
  Coins,
  Wrench,
  DollarSign,
  Zap,
} from 'lucide-react'
import { ScenarioProvider } from './scenario-context'
import { useSidebarNav, type ContextNavSection } from '@/components/layout/sidebar-context'
import OverviewTab from './tabs/overview-tab'
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

const planNavSections: ContextNavSection[] = [
  {
    items: [
      { id: 'overview',        label: 'Overview',        icon: LayoutGrid },
      { id: 'quick-analysis',  label: 'Quick Analysis',  icon: Zap },
    ],
  },
  {
    label: 'Setup',
    items: [
      { id: 'plan-details',  label: 'Plan Data', icon: SlidersHorizontal },
      { id: 'other-income',  label: 'Other Income', icon: DollarSign, disabled: true },
    ],
  },
  {
    label: 'Advanced Analysis',
    items: [
      { id: 'scenario-modeling', label: 'Scenarios',      icon: GitBranch },
      { id: 'details',           label: 'Projections',    icon: BarChart2 },
      { id: 'analysis',          label: 'Risk Analysis',  icon: ShieldAlert },
      { id: 'tax-efficiency',    label: 'Tax Efficiency', icon: Coins },
      { id: 'other-tools',       label: 'Other Tools',    icon: Wrench },
    ],
  },
]

type TabId =
  | 'overview'
  | 'quick-analysis'
  | 'plan-details'
  | 'other-income'
  | 'scenario-modeling'
  | 'details'
  | 'analysis'
  | 'tax-efficiency'
  | 'other-tools'

export default function RetirementPlanTabs({ planId }: RetirementPlanTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { setNav, updateActiveId } = useSidebarNav()

  // Register plan nav in the main sidebar on mount, clean up on unmount
  useEffect(() => {
    setNav({
      title: 'Retirement Plan',
      backHref: '/apps/retirement',
      sections: planNavSections,
      activeId: activeTab,
      onNavigate: (id) => setActiveTab(id as TabId),
    })
    return () => setNav(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep sidebar active highlight in sync whenever the tab changes
  useEffect(() => {
    updateActiveId(activeTab)
  }, [activeTab, updateActiveId])

  // Allow child components to switch tabs via custom event
  useEffect(() => {
    const handler = (e: CustomEvent<string>) => setActiveTab(e.detail as TabId)
    window.addEventListener('switchTab', handler as EventListener)
    return () => window.removeEventListener('switchTab', handler as EventListener)
  }, [])

  const navigate = (id: string) => setActiveTab(id as TabId)

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':          return <OverviewTab planId={planId} onNavigate={navigate} />
      case 'quick-analysis':    return <SnapshotTab planId={planId} onSwitchToAdvanced={() => navigate('details')} />
      case 'plan-details':      return <PlanDetailsTab planId={planId} />
      case 'scenario-modeling': return <ScenarioModelingTab planId={planId} />
      case 'details':           return <DetailsTab planId={planId} />
      case 'analysis':          return <AnalysisTab planId={planId} />
      case 'tax-efficiency':    return <TaxEfficiencyTab planId={planId} />
      case 'other-tools':       return <OtherToolsTab planId={planId} />
      case 'other-income':      return <OtherIncomeTab planId={planId} />
      default:                  return null
    }
  }

  return (
    <ScenarioProvider planId={planId}>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 sm:p-6">
          {renderContent()}
        </div>
      </div>
    </ScenarioProvider>
  )
}

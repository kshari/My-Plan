'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGE_BADGE_STYLES,
} from '@/lib/constants/property-defaults'
import type { DealStage, DealStageHistoryEntry } from '@/lib/types/property-lifecycle'
import { DealStageStepper } from '@/components/property/deal-stage-stepper'
import { DealStageHistory } from '@/components/property/deal-stage-history'
import DealWorkspace from '@/components/property/deal-workspace'
import { OverviewTab } from '@/components/property/deal-tabs/overview-tab'
import { DueDiligenceTab } from '@/components/property/deal-tabs/due-diligence-tab'
import { ClosingTab } from '@/components/property/deal-tabs/closing-tab'
import { RenovationTab } from '@/components/property/deal-tabs/renovation-tab'
import { LeaseSaleTab } from '@/components/property/deal-tabs/lease-sale-tab'
import { ManagementTab } from '@/components/property/deal-tabs/management-tab'
import type { Contact } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { History, ChevronDown } from 'lucide-react'

type TabId = 'overview' | 'underwriting' | 'due-diligence' | 'closing' | 'renovation' | 'lease-sale' | 'management'

interface Tab {
  id: TabId
  label: string
  /** Stage where this tab is most relevant. */
  relevantStages?: DealStage[]
}

const TABS: Tab[] = [
  { id: 'overview',       label: 'Overview' },
  { id: 'underwriting',   label: 'Underwriting', relevantStages: ['analyzing', 'offer'] },
  { id: 'due-diligence',  label: 'Due Diligence', relevantStages: ['contract'] },
  { id: 'closing',        label: 'Closing',       relevantStages: ['closing'] },
  { id: 'renovation',     label: 'Renovation',    relevantStages: ['rehab'] },
  { id: 'lease-sale',     label: 'Lease / Sale',  relevantStages: ['market'] },
  { id: 'management',     label: 'Management',    relevantStages: ['operate'] },
]

/** Map each deal stage to the most relevant tab. Falls back to 'overview'. */
function defaultTabForStage(stage: DealStage): TabId {
  const tab = TABS.find((t) => t.relevantStages?.includes(stage))
  return tab?.id ?? 'overview'
}

type ScenarioRow = Record<string, unknown> & { id: number; created_at: string }

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  type: string | null
  'Number of Units'?: number | null
  'Has HOA'?: boolean | null
  swimming_pool?: boolean | null
  'Asking Price': number | null
  listing_status?: string | null
  deal_stage?: string | null
  stage_updated_at?: string | null
  pm_contact_id?: string | null
  pm_fee_type?: 'fixed' | 'percent' | null
  pm_fee_amount?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  plan_name?: string | null
  notes?: string | null
  created_at: string
}

interface DealWorkspaceShellProps {
  property: Property
  initialScenarios: ScenarioRow[]
  initialScenarioId?: number
  stageHistory: DealStageHistoryEntry[]
  pmContact?: Contact | null
}

export default function DealWorkspaceShell({
  property,
  initialScenarios,
  initialScenarioId,
  stageHistory,
  pmContact,
}: DealWorkspaceShellProps) {
  const currentStage = (property.deal_stage ?? 'lead') as DealStage
  const [activeTab, setActiveTab] = useState<TabId>(() => defaultTabForStage(currentStage))
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* ── Stage stepper header ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold leading-tight">
              {property.address || 'Untitled Property'}
            </h2>
            {(property.city || property.county) && (
              <p className="text-sm text-muted-foreground">
                {[property.city, property.county].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <Badge className={cn('text-xs shrink-0', DEAL_STAGE_BADGE_STYLES[currentStage])}>
            {DEAL_STAGE_LABELS[currentStage]}
          </Badge>
        </div>

        <DealStageStepper
          propertyId={property.id}
          currentStage={currentStage}
        />

        {/* Stage history collapsible */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1 text-muted-foreground"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History className="h-3 w-3" />
            Stage history
            <ChevronDown className={cn('h-3 w-3 transition-transform', historyOpen && 'rotate-180')} />
          </Button>
          {historyOpen && (
            <div className="mt-2">
              <DealStageHistory history={stageHistory} />
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex overflow-x-auto border-b border-border gap-0.5 pb-0 -mb-px">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const isRelevant = tab.relevantStages?.includes(currentStage) ?? false
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                isActive
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                isRelevant && !isActive && 'text-blue-600 dark:text-blue-400'
              )}
            >
              {tab.label}
              {isRelevant && !isActive && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="pt-1">
        {activeTab === 'overview' && (
          <OverviewTab property={property} currentStage={currentStage} />
        )}
        {activeTab === 'underwriting' && (
          <DealWorkspace
            property={property}
            initialScenarios={initialScenarios}
            initialScenarioId={initialScenarioId}
          />
        )}
        {activeTab === 'due-diligence' && (
          <DueDiligenceTab propertyId={property.id} currentStage={currentStage} />
        )}
        {activeTab === 'closing' && (
          <ClosingTab propertyId={property.id} currentStage={currentStage} />
        )}
        {activeTab === 'renovation' && (
          <RenovationTab propertyId={property.id} currentStage={currentStage} />
        )}
        {activeTab === 'lease-sale' && (
          <LeaseSaleTab propertyId={property.id} currentStage={currentStage} />
        )}
        {activeTab === 'management' && (
          <ManagementTab
            propertyId={property.id}
            currentStage={currentStage}
            pmContact={pmContact}
            pmFeeType={property.pm_fee_type}
            pmFeeAmount={property.pm_fee_amount}
          />
        )}
      </div>
    </div>
  )
}

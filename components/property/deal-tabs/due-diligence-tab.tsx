'use client'

import type { DealStage } from '@/lib/types/property-lifecycle'
import { TaskList } from '@/components/property/tasks/task-list'

interface DueDiligenceTabProps {
  propertyId: number
  currentStage: DealStage
}

export function DueDiligenceTab({ propertyId, currentStage }: DueDiligenceTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Due Diligence Checklist</h3>
        <TaskList
          propertyId={propertyId}
          filterStages={['contract', 'offer', 'analyzing']}
          showAddTask
        />
      </div>
    </div>
  )
}

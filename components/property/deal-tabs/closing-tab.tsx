'use client'

import type { DealStage } from '@/lib/types/property-lifecycle'
import { TaskList } from '@/components/property/tasks/task-list'

interface ClosingTabProps {
  propertyId: number
  currentStage: DealStage
}

export function ClosingTab({ propertyId, currentStage }: ClosingTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Closing Milestones &amp; Tasks</h3>
        <TaskList
          propertyId={propertyId}
          filterStages={['closing']}
          showAddTask
        />
      </div>
    </div>
  )
}

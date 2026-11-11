'use client'

import type { DealStage } from '@/lib/types/property-lifecycle'
import { TaskList } from '@/components/property/tasks/task-list'
import { LeaseList } from '@/components/property/management/lease-list'

interface LeaseSaleTabProps {
  propertyId: number
  currentStage: DealStage
}

export function LeaseSaleTab({ propertyId, currentStage }: LeaseSaleTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Listing / Lease-Up Tasks</h3>
        <TaskList
          propertyId={propertyId}
          filterStages={['market']}
          showAddTask
        />
      </div>
      <LeaseList propertyId={propertyId} />
    </div>
  )
}

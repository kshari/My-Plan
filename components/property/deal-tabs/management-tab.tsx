'use client'

import type { DealStage, Contact } from '@/lib/types/property-lifecycle'
import { LeaseList } from '@/components/property/management/lease-list'
import { WorkOrderList } from '@/components/property/management/work-order-list'
import { PropertyManagerCard } from '@/components/property/management/property-manager-card'

interface ManagementTabProps {
  propertyId: number
  currentStage: DealStage
  pmContact?: Contact | null
  pmFeeType?: 'fixed' | 'percent' | null
  pmFeeAmount?: number | null
}

export function ManagementTab({
  propertyId,
  currentStage,
  pmContact,
  pmFeeType,
  pmFeeAmount,
}: ManagementTabProps) {
  return (
    <div className="space-y-4">
      <PropertyManagerCard
        propertyId={propertyId}
        initialPmContact={pmContact}
        initialFeeType={pmFeeType}
        initialFeeAmount={pmFeeAmount}
      />
      <LeaseList propertyId={propertyId} />
      <WorkOrderList propertyId={propertyId} />
    </div>
  )
}

'use client'

import type { DealStage } from '@/lib/types/property-lifecycle'
import { RehabTable } from '@/components/property/rehab/rehab-table'

interface RenovationTabProps {
  propertyId: number
  currentStage: DealStage
}

export function RenovationTab({ propertyId, currentStage }: RenovationTabProps) {
  return (
    <div className="space-y-4">
      <RehabTable propertyId={propertyId} />
    </div>
  )
}

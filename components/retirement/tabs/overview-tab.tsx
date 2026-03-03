'use client'

import React from 'react'
import { PlanStructureContent } from '@/components/retirement/plan-structure-content'

interface OverviewTabProps {
  planId: number
  onNavigate: (tabId: string) => void
}

export default function OverviewTab({ planId, onNavigate }: OverviewTabProps) {
  return <PlanStructureContent showOpen onNavigate={onNavigate} />
}

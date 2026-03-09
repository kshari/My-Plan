'use client'

import { useMemo } from 'react'
import type { DemographicProfile } from '@/lib/demographics'
import { BENCHMARK_DATA } from '@/lib/constants/benchmark-data'
import { computeResilienceScore, type ResilienceBreakdown } from '@/lib/utils/pulse-calculations'

export function useResilienceScore(profile: DemographicProfile | null): ResilienceBreakdown | null {
  return useMemo(() => {
    if (!profile) return null
    return computeResilienceScore(profile, BENCHMARK_DATA)
  }, [profile])
}

'use client'

import { useMemo } from 'react'
import type { FunFact } from '@/lib/constants/fun-facts'

export function useDailyFact(facts: FunFact[]): FunFact {
  return useMemo(() => {
    const today = new Date()
    const dayIndex = today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()
    return facts[dayIndex % facts.length]
  }, [facts])
}

'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { type ScoringConfig, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'

const STORAGE_KEY = 'pi_scoring_config'

interface ScoringConfigContextValue {
  config: ScoringConfig
  setConfig: (cfg: ScoringConfig) => void
  resetConfig: () => void
}

const ScoringConfigContext = createContext<ScoringConfigContextValue>({
  config: DEFAULT_SCORING_CONFIG,
  setConfig: () => {},
  resetConfig: () => {},
})

export function ScoringConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<ScoringConfig>(DEFAULT_SCORING_CONFIG)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ScoringConfig>
        setConfigState({ ...DEFAULT_SCORING_CONFIG, ...parsed })
      }
    } catch {}
  }, [])

  const setConfig = useCallback((cfg: ScoringConfig) => {
    setConfigState(cfg)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch {}
  }, [])

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_SCORING_CONFIG)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  return (
    <ScoringConfigContext.Provider value={{ config, setConfig, resetConfig }}>
      {children}
    </ScoringConfigContext.Provider>
  )
}

export function useScoringConfig() {
  return useContext(ScoringConfigContext)
}

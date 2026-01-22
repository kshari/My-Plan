'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ScenarioContextType {
  selectedScenarioId: number | null
  setSelectedScenarioId: (id: number | null) => void
  planId: number
}

const ScenarioContext = createContext<ScenarioContextType | undefined>(undefined)

export function ScenarioProvider({ 
  children, 
  planId 
}: { 
  children: ReactNode
  planId: number 
}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)

  return (
    <ScenarioContext.Provider value={{ selectedScenarioId, setSelectedScenarioId, planId }}>
      {children}
    </ScenarioContext.Provider>
  )
}

export function useScenario() {
  const context = useContext(ScenarioContext)
  if (context === undefined) {
    throw new Error('useScenario must be used within a ScenarioProvider')
  }
  return context
}

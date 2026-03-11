'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type AgentPanelMode = 'hidden' | 'docked' | 'fullscreen'

const DEFAULT_WIDTH = 420
const MIN_WIDTH = 320
const MAX_WIDTH_RATIO = 0.5

interface AgentPanelState {
  mode: AgentPanelMode
  panelWidth: number
  open: () => void
  close: () => void
  toggleFullscreen: () => void
  dockRight: () => void
  setPanelWidth: (w: number) => void
}

const AgentPanelContext = createContext<AgentPanelState>({
  mode: 'hidden',
  panelWidth: DEFAULT_WIDTH,
  open: () => {},
  close: () => {},
  toggleFullscreen: () => {},
  dockRight: () => {},
  setPanelWidth: () => {},
})

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AgentPanelMode>('hidden')
  const [panelWidth, setPanelWidthRaw] = useState(DEFAULT_WIDTH)

  const open = useCallback(() => setMode('docked'), [])
  const close = useCallback(() => setMode('hidden'), [])
  const toggleFullscreen = useCallback(
    () => setMode((m) => (m === 'fullscreen' ? 'docked' : 'fullscreen')),
    []
  )
  const dockRight = useCallback(() => setMode('docked'), [])

  const setPanelWidth = useCallback((w: number) => {
    const maxW = typeof window !== 'undefined' ? window.innerWidth * MAX_WIDTH_RATIO : 800
    setPanelWidthRaw(Math.max(MIN_WIDTH, Math.min(w, maxW)))
  }, [])

  return (
    <AgentPanelContext.Provider
      value={{ mode, panelWidth, open, close, toggleFullscreen, dockRight, setPanelWidth }}
    >
      {children}
    </AgentPanelContext.Provider>
  )
}

export function useAgentPanel() {
  return useContext(AgentPanelContext)
}

export { MIN_WIDTH }

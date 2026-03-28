'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

export type AgentPanelMode = 'hidden' | 'inline' | 'docked' | 'fullscreen'

const DEFAULT_WIDTH = 420
const MIN_WIDTH = 320
const MAX_WIDTH_RATIO = 0.5

interface AgentPanelState {
  mode: AgentPanelMode
  panelWidth: number
  open: () => void
  /** Open inline in the page content (home page default) */
  openInline: () => void
  close: () => void
  toggleFullscreen: () => void
  dockRight: () => void
  setPanelWidth: (w: number) => void
}

const AgentPanelContext = createContext<AgentPanelState>({
  mode: 'hidden',
  panelWidth: DEFAULT_WIDTH,
  open: () => {},
  openInline: () => {},
  close: () => {},
  toggleFullscreen: () => {},
  dockRight: () => {},
  setPanelWidth: () => {},
})

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AgentPanelMode>('hidden')
  const [panelWidth, setPanelWidthRaw] = useState(DEFAULT_WIDTH)
  // Remembers whether we were 'inline' or 'docked' before going fullscreen
  const prevNonFullscreenMode = useRef<AgentPanelMode>('docked')

  const open = useCallback(() => setMode('docked'), [])
  const openInline = useCallback(() => setMode('inline'), [])
  const close = useCallback(() => setMode('hidden'), [])
  const toggleFullscreen = useCallback(
    () => setMode((m) => {
      if (m === 'fullscreen') return prevNonFullscreenMode.current
      prevNonFullscreenMode.current = m
      return 'fullscreen'
    }),
    []
  )
  const dockRight = useCallback(() => setMode('docked'), [])

  const setPanelWidth = useCallback((w: number) => {
    const maxW = typeof window !== 'undefined' ? window.innerWidth * MAX_WIDTH_RATIO : 800
    setPanelWidthRaw(Math.max(MIN_WIDTH, Math.min(w, maxW)))
  }, [])

  return (
    <AgentPanelContext.Provider
      value={{ mode, panelWidth, open, openInline, close, toggleFullscreen, dockRight, setPanelWidth }}
    >
      {children}
    </AgentPanelContext.Provider>
  )
}

export function useAgentPanel() {
  return useContext(AgentPanelContext)
}

export { MIN_WIDTH }

'use client'

import { useEffect } from 'react'
import { useAgentPanel } from '@/components/agent/agent-panel-context'

export function AgentPageOpener() {
  const { mode, toggleFullscreen, open } = useAgentPanel()

  useEffect(() => {
    if (mode === 'hidden') {
      open()
      toggleFullscreen()
    } else if (mode === 'docked') {
      toggleFullscreen()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      The Assistant panel is open. Use the panel controls to dock, resize, or close it.
    </div>
  )
}

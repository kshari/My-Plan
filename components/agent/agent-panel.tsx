'use client'

import { useCallback, useRef, useEffect } from 'react'
import { X, Minus, Maximize2, PanelRight, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentPanel, MIN_WIDTH } from './agent-panel-context'
import { AgentChat } from './agent-chat'

export function AgentPanel() {
  const { mode, panelWidth, close, toggleFullscreen, dockRight, setPanelWidth } = useAgentPanel()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'docked') return
      e.preventDefault()
      dragging.current = true
      startX.current = e.clientX
      startW.current = panelWidth
    },
    [mode, panelWidth]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      setPanelWidth(startW.current + delta)
    }
    const onMouseUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setPanelWidth])

  if (mode === 'hidden') return null

  const isDocked = mode === 'docked'

  return (
    <div
      className={cn(
        'flex flex-col bg-background',
        isDocked ? 'relative shrink-0 border-l' : 'flex-1 min-w-0'
      )}
      style={isDocked ? { width: panelWidth, minWidth: MIN_WIDTH } : undefined}
    >
      {/* Resize handle — docked only */}
      {isDocked && (
        <div
          onMouseDown={onMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 z-10"
        />
      )}

      {/* Title bar */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Bot className="h-4 w-4 text-sky-500" />
        <span className="text-sm font-semibold flex-1">AI Assistant</span>

        {isDocked ? (
          <>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={dockRight}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Dock right"
            >
              <PanelRight className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Chat body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AgentChat mode={mode} />
      </div>
    </div>
  )
}

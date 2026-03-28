'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Bot, X, Maximize2, Minimize2, PanelRight,
  Clipboard, ClipboardCheck, Send, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAgentPanel } from './agent-panel-context'
import { useAgentChat } from './agent-chat-context'
import { AgentChat } from './agent-chat'

const COPY_SYSTEM_PROMPT = `You are a knowledgeable financial coach. The user has provided their actual financial data below from their personal finance planning app. Use the exact numbers from their data in your answers. Be specific, actionable, and calculate where needed.`

/**
 * Unified home page agent card.
 *
 * Dormant (hidden): shows only the prompt input — a clean entry point.
 * Active (inline / fullscreen): the same card expands to show the full
 * AI Assistant chat below the header, with Dock / Fullscreen / Close controls.
 * Docked: not rendered here — the side AgentPanel handles it.
 */
export function HomeAgentCard() {
  const { mode, openInline, close, dockRight, toggleFullscreen } = useAgentPanel()
  const { setPendingInput } = useAgentChat()

  const [text, setText] = useState('')
  const [copying, setCopying] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isActive = mode === 'inline' || mode === 'fullscreen'

  // Auto-resize the dormant textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el || isActive) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text, isActive])

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current) }
  }, [])

  // Not rendered when docked — the side AgentPanel handles that view
  if (mode === 'docked') return null

  const handleAskAI = () => {
    const q = text.trim()
    if (q) {
      setPendingInput(q)
      setText('')
    }
    openInline()
  }

  const handleCopyForAI = async () => {
    const question = text.trim()
    if (!question || copying) return
    setCopying(true)
    try {
      const params = new URLSearchParams({ page: '/', message: question })
      const res = await fetch(`/api/agent/context?${params}`)
      if (!res.ok) throw new Error('Failed to load data')
      const { context } = await res.json()
      const prompt = [
        COPY_SYSTEM_PROMPT, '',
        '## My Financial Data', '', context, '',
        '## My Question', '', question,
      ].join('\n')
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      // silently fail — browser clipboard API requires focus/https
    } finally {
      setCopying(false)
    }
  } 

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAskAI()
    }
  }

  return (
    <div className={cn(
      'rounded-2xl border bg-card overflow-hidden transition-shadow duration-200',
      mode === 'inline' && 'min-h-[440px] max-h-[72vh]',
      isActive ? 'shadow-md' : 'shadow-sm',
    )}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={cn(
        'flex shrink-0 items-center gap-2 border-b px-3',
        isActive ? 'h-11' : 'h-10 bg-muted/20',
      )}>
        <Bot className={cn('h-4 w-4 shrink-0', isActive ? 'text-sky-500' : 'text-muted-foreground')} />
        <span className={cn(
          'flex-1 font-semibold leading-none',
          isActive ? 'text-sm' : 'text-xs text-muted-foreground',
        )}>
          {isActive ? 'AI Assistant' : 'Ask your financial assistant'}
        </span>

        {isActive && (
          <div className="flex items-center gap-0.5">
            {mode === 'inline' && (
              <>
                <button
                  onClick={dockRight}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Dock to the right"
                >
                  <PanelRight className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Full screen"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </>
            )}
            {mode === 'fullscreen' && (
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Exit full screen"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={close}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      {isActive ? (
        /*
         * Use a relative container with explicit height so AgentChat's
         * `h-full` resolves to a real pixel value — that's what makes the
         * inner `flex-1 overflow-y-auto` messages area scroll correctly
         * while the input bar stays pinned at the bottom.
         *
         * Header is h-11 (44px). The card is capped at 72vh / min 440px,
         * so we subtract the header height here.
         */
        <div
          className="relative"
          style={{ height: 'calc(72vh - 44px)', minHeight: 'calc(440px - 44px)' }}
        >
          <div className="absolute inset-0">
            <AgentChat mode={mode} layout="gemini" />
          </div>
        </div>
      ) : (
        /* Dormant prompt input */
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances…  e.g. Am I on track to retire at 62?"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 leading-relaxed py-0.5"
              style={{ minHeight: '4.5rem', maxHeight: '200px' }}
            />
            <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
              <Button
                size="sm"
                onClick={handleAskAI}
                className="h-8 gap-1.5 text-xs px-3"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ask AI</span>
              </Button>
              <button
                type="button"
                onClick={handleCopyForAI}
                disabled={!text.trim() || copying}
                title="Copy prompt with your data for ChatGPT / Gemini / Claude"
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground',
                  'transition-colors hover:border-primary hover:text-primary',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  copied && 'border-green-500 text-green-500 dark:text-green-400',
                )}
              >
                {copying
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : copied
                    ? <ClipboardCheck className="h-3.5 w-3.5" />
                    : <Clipboard className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/50">
            Press Enter to ask the built-in AI assistant · The copy button generates a prompt with your data for ChatGPT, Gemini, or Claude.
          </p>
        </div>
      )}
    </div>
  )
}

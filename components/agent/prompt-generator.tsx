'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Clipboard, ClipboardCheck, Send, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const EXTERNAL_AI_SYSTEM_PROMPT = `You are a knowledgeable financial coach. The user has provided their actual financial data below from their personal finance planning app. Use the exact numbers from their data in your answers. Be specific, actionable, and calculate where needed.`

interface PromptGeneratorProps {
  /** 'home' = large standalone bar, 'inline' = compact icon button inside agent panel */
  variant?: 'home' | 'inline'
  /** For 'inline' variant: the current input value to use as the question */
  value?: string
  /** Called when the user clicks "Ask AI Assistant" — receives the typed text */
  onSendToAgent?: (text: string) => void
  className?: string
}

export function PromptGenerator({ variant = 'home', value, onSendToAgent, className }: PromptGeneratorProps) {
  const [text, setText] = useState(value ?? '')
  const [copied, setCopied] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-resize textarea on input
  useEffect(() => {
    const el = textareaRef.current
    if (!el || variant !== 'home') return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text, variant])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const buildAndCopy = useCallback(async () => {
    const question = (variant === 'inline' && value !== undefined ? value : text).trim()
    if (!question) return

    setFetching(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: '/', message: question })
      const res = await fetch(`/api/agent/context?${params}`)
      if (!res.ok) throw new Error('Failed to load your financial data')
      const { context } = await res.json()

      const prompt = [
        EXTERNAL_AI_SYSTEM_PROMPT,
        '',
        '## My Financial Data',
        '',
        context,
        '',
        '## My Question',
        '',
        question,
      ].join('\n')

      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setFetching(false)
    }
  }, [text, value, variant])

  const handleSendToAgent = useCallback(() => {
    const question = text.trim()
    if (!question || !onSendToAgent) return
    onSendToAgent(question)
    setText('')
  }, [text, onSendToAgent])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (onSendToAgent) {
          handleSendToAgent()
        } else {
          buildAndCopy()
        }
      }
    },
    [handleSendToAgent, buildAndCopy, onSendToAgent]
  )

  if (variant === 'inline') {
    const hasText = variant === 'inline' ? !!value?.trim() : !!text.trim()
    return (
      <button
        type="button"
        onClick={buildAndCopy}
        disabled={!hasText || fetching}
        title="Copy prompt with your data for ChatGPT / Gemini / Claude"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground',
          'transition-colors hover:border-primary hover:text-primary',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          copied && 'border-green-500 text-green-600 dark:text-green-400',
          className
        )}
      >
        {fetching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : copied ? (
          <ClipboardCheck className="h-4 w-4" />
        ) : (
          <Clipboard className="h-4 w-4" />
        )}
      </button>
    )
  }

  // --- Home page variant ---
  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className={cn(
        'relative flex items-end gap-2 rounded-2xl border bg-card px-4 py-3 shadow-sm',
        'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all'
      )}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your finances…  e.g. Am I on track to retire at 62?"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 leading-relaxed py-0.5"
          style={{ minHeight: '1.5rem', maxHeight: '200px' }}
        />
        <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
          {onSendToAgent && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSendToAgent}
              disabled={!text.trim()}
              title="Ask the built-in AI Assistant"
              className="h-8 gap-1.5 text-xs px-2.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={buildAndCopy}
            disabled={!text.trim() || fetching}
            title="Copy prompt with your data for ChatGPT, Gemini, Claude, etc."
            className={cn(
              'h-8 gap-1.5 text-xs px-3 transition-colors',
              copied
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : ''
            )}
          >
            {fetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : copied ? (
              <ClipboardCheck className="h-3.5 w-3.5" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {copied ? 'Copied!' : 'Copy for AI'}
            </span>
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
      )}

      <p className="text-[11px] text-muted-foreground/60 px-1">
        "Copy for AI" generates a prompt with your data pre-filled — paste it into ChatGPT, Gemini, or Claude.
        {onSendToAgent && ' "Ask AI" sends it to the built-in assistant.'}
      </p>
    </div>
  )
}

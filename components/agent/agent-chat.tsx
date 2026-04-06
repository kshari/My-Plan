'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Send, Bot, User, Settings2, Loader2, Trash2, Check, X, Download, MonitorSmartphone, FlaskConical, ChevronDown, ChevronUp, Zap, Info } from 'lucide-react'

// ─── Pending-action human-readable formatter ─────────────────────────────────

const INTERNAL_ID_FIELDS = new Set(['account_id', 'plan_id', 'expense_id', 'income_id'])

const ACTION_TITLES: Record<string, string> = {
  update_fp_profile: 'Update Financial Pulse Profile',
  update_rp_plan: 'Update Retirement Plan',
  update_rp_account: 'Update Retirement Account',
  update_rp_expense: 'Update Retirement Expense',
  update_rp_other_income: 'Update Income Source',
  create_rp_scenario: 'Create Retirement Scenario',
}

const FIELD_LABELS: Record<string, string> = {
  age: 'Age',
  state: 'State',
  household_type: 'Household Type',
  household_size: 'Household Size',
  annual_gross_income: 'Annual Gross Income',
  filing_status: 'Filing Status',
  total_retirement_savings: 'Total Retirement Savings',
  total_non_retirement_savings: 'Total Non-Retirement Savings',
  monthly_expenses: 'Monthly Expenses',
  monthly_savings: 'Monthly Savings',
  home_value: 'Home Value',
  mortgage_balance: 'Mortgage Balance',
  plan_name: 'Plan Name',
  birth_year: 'Birth Year',
  life_expectancy: 'Life Expectancy',
  include_spouse: 'Include Spouse',
  spouse_birth_year: "Spouse's Birth Year",
  spouse_life_expectancy: "Spouse's Life Expectancy",
  account_name: 'Account Name',
  owner: 'Owner',
  balance: 'Balance',
  account_type: 'Account Type',
  annual_contribution: 'Annual Contribution',
  expense_name: 'Expense Name',
  amount_before_65: 'Monthly Amount (before 65)',
  amount_after_65: 'Monthly Amount (after 65)',
  income_name: 'Income Source',
  annual_amount: 'Annual Amount',
  start_age: 'Start Age',
  end_age: 'End Age',
  cola: 'Cost-of-Living Adjustment',
  scenario_name: 'Scenario Name',
}

const CURRENCY_FIELDS = new Set([
  'annual_gross_income', 'total_retirement_savings', 'total_non_retirement_savings',
  'monthly_expenses', 'monthly_savings', 'home_value', 'mortgage_balance',
  'balance', 'annual_contribution', 'amount_before_65', 'amount_after_65', 'annual_amount',
])

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_filing_jointly: 'Married Filing Jointly',
  married_filing_separately: 'Married Filing Separately',
  head_of_household: 'Head of Household',
}

const HOUSEHOLD_TYPE_LABELS: Record<string, string> = {
  single: 'Single',
  married: 'Married',
  married_with_children: 'Married with Children',
}

function formatFieldValue(key: string, value: unknown): string {
  if (key === 'filing_status' && typeof value === 'string') return FILING_STATUS_LABELS[value] ?? value
  if (key === 'household_type' && typeof value === 'string') return HOUSEHOLD_TYPE_LABELS[value] ?? value
  if (key === 'include_spouse') return value ? 'Yes' : 'No'
  if (CURRENCY_FIELDS.has(key) && typeof value === 'number') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }
  if (key === 'cola' && typeof value === 'number') return `${value}%`
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function formatAction(type: string, payload: Record<string, unknown>): { title: string; changes: { label: string; value: string }[] } {
  const title = ACTION_TITLES[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const changes = Object.entries(payload)
    .filter(([k]) => !INTERNAL_ID_FIELDS.has(k))
    .map(([k, v]) => ({ label: FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), value: formatFieldValue(k, v) }))
  return { title, changes }
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './markdown-content'
import { AgentCredentialsForm } from './agent-credentials-form'
import { PromptGenerator } from './prompt-generator'
import type { AgentPanelMode } from './agent-panel-context'
import { useAgentChat, type Message } from './agent-chat-context'
import {
  isWebGPUAvailable,
  getOrCreateEngine,
  isEngineReady,
  chatWithWebLLM,
  getModelId,
  type WebLLMStatus,
} from '@/lib/agent/webllm-engine'
import { classifyPrompt } from '@/lib/agent/prompt-router'

export type AgentProvider = 'webllm' | 'openai' | 'gemini' | 'gemini-api-key' | 'claude' | 'auto'

interface AgentChatProps {
  mode?: AgentPanelMode
  /** 'gemini' renders a Gemini/Cursor-style layout: messages above, controls bottom */
  layout?: 'default' | 'gemini'
}

export function AgentChat({ mode, layout = 'default' }: AgentChatProps) {
  const embedded = mode === 'docked' || mode === 'fullscreen' || mode === 'inline'
  const pathname = usePathname()
  const { messages, setMessages, clearMessages, pendingInput, setPendingInput } = useAgentChat()

  // Lazy initializers read from localStorage so the correct provider is available
  // on the very first render — before fetchSavedSettings() returns.
  const [provider, setProvider] = useState<AgentProvider>(() => {
    if (typeof window === 'undefined') return 'openai'
    try {
      const cached = localStorage.getItem('agent_provider_settings')
      if (cached) return (JSON.parse(cached).provider as AgentProvider) || 'openai'
    } catch { /* ignore */ }
    return 'openai'
  })
  const [autoCloudProvider, setAutoCloudProvider] = useState<Exclude<AgentProvider, 'webllm' | 'auto'>>(() => {
    if (typeof window === 'undefined') return 'openai'
    try {
      const cached = localStorage.getItem('agent_provider_settings')
      if (cached) return (JSON.parse(cached).autoCloudProvider as Exclude<AgentProvider, 'webllm' | 'auto'>) || 'openai'
    } catch { /* ignore */ }
    return 'openai'
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [configuredProviders, setConfiguredProviders] = useState<{ provider: string }[]>([])
  const [routerLlmClassification, setRouterLlmClassification] = useState(true)
  const [showCredentials, setShowCredentials] = useState(false)
  const [showExperimentalDetails, setShowExperimentalDetails] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const geminiTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [webllmStatus, setWebllmStatus] = useState<WebLLMStatus>({ state: 'idle' })
  const [webgpuSupported] = useState(() => isWebGPUAvailable())
  const streamingMsgId = useRef<string | null>(null)
  // Keep a stable ref so effects can call sendMessage without stale closure issues
  const sendMessageRef = useRef<(textOverride?: string) => Promise<void>>(async () => {})
  // Dedupe guard — prevents React Strict Mode's double-effect from sending twice
  const lastProcessedPendingRef = useRef<string>('')
  // Becomes true once credentials + settings have loaded — gates the pending-input auto-send
  // so we never send before configuredProviders is populated.
  const [initReady, setInitReady] = useState(false)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  // Auto-resize gemini textarea
  useEffect(() => {
    const el = geminiTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  const settingsLoaded = useRef(false)

  const fetchCredentials = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/credentials')
      if (res.ok) {
        const data = await res.json()
        setConfiguredProviders(data.providers ?? [])
      }
    } catch {
      setConfiguredProviders([])
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/config')
      if (res.ok) {
        const data = await res.json()
        setRouterLlmClassification(data.routerLlmClassification ?? true)
      }
    } catch {
      // keep default (true = LLM)
    }
  }, [])

  const fetchSavedSettings = useCallback(async () => {
    try {
      // Read localStorage immediately (sync) so the UI shows the right provider
      // before the network request returns — avoids the 'openai' flash on every open
      const cached = typeof window !== 'undefined' && localStorage.getItem('agent_provider_settings')
      if (cached) {
        const parsed = JSON.parse(cached) as { provider?: string; autoCloudProvider?: string }
        if (parsed.provider) setProvider(parsed.provider as AgentProvider)
        if (parsed.autoCloudProvider) setAutoCloudProvider(parsed.autoCloudProvider as Exclude<AgentProvider, 'webllm' | 'auto'>)
      }
      // Reconcile with database (authoritative)
      const res = await fetch('/api/agent/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.provider) setProvider(data.provider as AgentProvider)
        if (data.autoCloudProvider) setAutoCloudProvider(data.autoCloudProvider as Exclude<AgentProvider, 'webllm' | 'auto'>)
        settingsLoaded.current = true
        if (typeof window !== 'undefined') {
          localStorage.setItem('agent_provider_settings', JSON.stringify(data))
        }
      }
    } catch {
      settingsLoaded.current = true
    }
  }, [])

  const saveSettings = useCallback(async (newProvider: AgentProvider, newCloudProvider: Exclude<AgentProvider, 'webllm' | 'auto'>) => {
    if (!settingsLoaded.current) return
    // Persist immediately to localStorage so the next mount sees it right away
    if (typeof window !== 'undefined') {
      localStorage.setItem('agent_provider_settings', JSON.stringify({ provider: newProvider, autoCloudProvider: newCloudProvider }))
    }
    try {
      await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: newProvider, autoCloudProvider: newCloudProvider }),
      })
    } catch {
      // non-critical — settings persist locally for the session
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchCredentials(), fetchConfig(), fetchSavedSettings()])
      .finally(() => setInitReady(true))
  }, [fetchCredentials, fetchConfig, fetchSavedSettings])

  // Pick up a message pre-seeded from outside (e.g. home page prompt bar) and auto-send.
  // Guards:
  //  1. initReady — waits until credentials + settings have loaded so canUseProvider() is accurate.
  //  2. lastProcessedPendingRef — deduplicates against React Strict Mode's double-effect invocation.
  // When pendingInput arrives before initReady, the effect returns early and re-fires once
  // initReady becomes true (because initReady is in the dependency array).
  useEffect(() => {
    if (!initReady) return
    if (!pendingInput || pendingInput === lastProcessedPendingRef.current) return
    lastProcessedPendingRef.current = pendingInput
    const text = pendingInput
    setPendingInput('')
    sendMessageRef.current(text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput, setPendingInput, initReady])

  const canUseProvider = useCallback(
    (p: AgentProvider) => {
      if (p === 'webllm') return webgpuSupported
      if (p === 'auto') return webgpuSupported && configuredProviders.length > 0
      return configuredProviders.some((c) => c.provider === p)
    },
    [configuredProviders, webgpuSupported]
  )

  const providerLabel = (p: AgentProvider) =>
    p === 'webllm' ? 'Local (WebLLM)' : p === 'openai' ? 'OpenAI (API Key)' : p === 'gemini' ? 'Gemini (OAuth)' : p === 'gemini-api-key' ? 'Gemini (API Key)' : p === 'claude' ? 'Claude (API Key)' : 'Auto (Hybrid)'

  const routedViaLabel = (r: Message['routedVia']): string => {
    if (!r) return ''
    if (r === 'local') return 'Local'
    if (r === 'openai') return 'OpenAI'
    if (r === 'gemini') return 'Gemini OAuth'
    if (r === 'gemini-api-key') return 'Gemini'
    if (r === 'claude') return 'Claude'
    return ''
  }

  // Resolve which cloud provider to use for complex messages in auto mode.
  // Prefers the user's explicit autoCloudProvider selection; falls back to
  // the first configured provider if that selection has not been set up yet.
  const resolveCloudProvider = useCallback((): AgentProvider | null => {
    // If the explicitly selected cloud provider is configured, use it
    if (configuredProviders.some((c) => c.provider === autoCloudProvider)) {
      return autoCloudProvider
    }
    // Fallback: first available configured provider
    const order: AgentProvider[] = ['openai', 'claude', 'gemini-api-key', 'gemini']
    for (const p of order) {
      if (configuredProviders.some((c) => c.provider === p)) return p
    }
    return null
  }, [configuredProviders, autoCloudProvider])

  const buildHistory = useCallback((): { role: 'user' | 'assistant'; content: string }[] => {
    return messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }))
  }, [messages])

  const loadWebLLM = useCallback(async () => {
    if (isEngineReady()) {
      setWebllmStatus({ state: 'ready' })
      return
    }
    try {
      await getOrCreateEngine((status) => setWebllmStatus(status))
    } catch {
      // error already set via callback
    }
  }, [])

  const confirmActions = useCallback(async (messageId: string, actions: NonNullable<Message['pendingActions']>) => {
    setLoading(true)
    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: actions.map((a) => ({ type: a.type, payload: a.payload })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      const results: { success: boolean; error?: string }[] = data.results ?? []
      const applied = results
        .map((r, i) => r.success ? actions[i]?.type : null)
        .filter(Boolean) as string[]
      const failed = results
        .map((r, i) => r.success ? null : (r.error ?? actions[i]?.type ?? 'unknown'))
        .filter(Boolean) as string[]
      const suffix = failed.length
        ? `\n\n${applied.length} change(s) applied. ${failed.length} failed: ${failed.join('; ')}`
        : '\n\nChanges applied.'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, pendingActions: undefined, actionsApplied: applied, content: m.content + suffix }
            : m
        )
      )
      // Notify other parts of the UI that scenario data changed (for refresh triggers)
      const scenarioMutated = applied.some((t) => t === 'create_rp_scenario' || t === 'update_rp_scenario')
      if (scenarioMutated && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agent:scenario-mutated'))
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, pendingActions: undefined, content: m.content + '\n\nFailed to apply changes.' }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const dismissActions = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, pendingActions: undefined, content: m.content + '\n\nChanges cancelled.' }
          : m
      )
    )
  }, [])

  const sendWebLLMMessage = useCallback(async (text: string) => {
    const engine = isEngineReady()
      ? await getOrCreateEngine()
      : await getOrCreateEngine((s) => setWebllmStatus(s))

    // Fetch scoped user context from server
    let context = ''
    try {
      const ctxParams = new URLSearchParams({ page: pathname, message: text })
      const res = await fetch(`/api/agent/context?${ctxParams.toString()}`)
      if (res.ok) {
        const data = await res.json()
        context = data.context ?? ''
      }
    } catch {
      // proceed without context
    }

    const assistantId = crypto.randomUUID()
    streamingMsgId.current = assistantId
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', routedVia: 'local' as const }])

    try {
      const result = await chatWithWebLLM(engine, {
        message: text,
        context,
        history: buildHistory(),
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            )
          )
        },
      })

      // Log the interaction server-side for audit
      const contextPreview = context.length > 3000 ? context.slice(0, 3000) + '\n...[truncated]' : context
      const conversationBlock = buildHistory().map((h) => `${h.role}: ${h.content}`).join('\n\n')
      const fullPromptSent = `${context}\n\n--- Conversation ---\n\n${conversationBlock}\n\nuser: ${text}`
      const promptSent = fullPromptSent.length > 10000 ? fullPromptSent.slice(0, 10000) + '\n...[truncated]' : fullPromptSent
      const decisions = [
        'provider=webllm',
        'auth=local',
        `page=${pathname}`,
        `context_length=${context.length}`,
        `model=${getModelId()}`,
        `reply_length=${result.reply.length}`,
      ].join('\n')
      fetch('/api/agent/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'webllm',
          model: getModelId(),
          user_prompt: text.slice(0, 10000),
          status: 'success',
          duration_ms: result.durationMs,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          context_preview: contextPreview,
          result_summary: `reply: ${result.reply.length} chars`,
          decisions,
          prompt_sent: promptSent,
        }),
      }).catch(() => {})

    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Local model error'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: errMsg } : m
        )
      )

      const conversationBlock = buildHistory().map((h) => `${h.role}: ${h.content}`).join('\n\n')
      const fullPromptSent = `${context}\n\n--- Conversation ---\n\n${conversationBlock}\n\nuser: ${text}`
      const promptSent = fullPromptSent.length > 10000 ? fullPromptSent.slice(0, 10000) + '\n...[truncated]' : fullPromptSent
      const decisions = [
        'provider=webllm',
        'auth=local',
        `page=${pathname}`,
        `model=${getModelId()}`,
        `outcome=error: ${errMsg}`,
      ].join('\n')
      fetch('/api/agent/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'webllm',
          model: getModelId(),
          user_prompt: text.slice(0, 10000),
          status: 'error',
          error_message: errMsg,
          result_summary: `error: ${errMsg.slice(0, 500)}`,
          decisions,
          prompt_sent: promptSent,
        }),
      }).catch(() => {})
    } finally {
      streamingMsgId.current = null
    }
  }, [buildHistory, pathname])

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: text }])
    setLoading(true)

    // Resolve effective provider: for 'auto', classify the prompt
    let effectiveProvider: AgentProvider = provider
    if (provider === 'auto') {
      const complexity = await classifyPrompt(text, messages.length, routerLlmClassification)
      if (complexity === 'simple' && webgpuSupported && isEngineReady()) {
        effectiveProvider = 'webllm'
      } else if (complexity === 'simple' && webgpuSupported) {
        // WebLLM not loaded yet — prefer cloud if available, else load WebLLM
        const cloud = resolveCloudProvider()
        effectiveProvider = cloud ?? 'webllm'
      } else {
        // complex — use cloud
        const cloud = resolveCloudProvider()
        if (!cloud) {
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', content: 'Auto mode requires at least one cloud provider configured. Add an API key in AI Settings.' },
          ])
          setLoading(false)
          return
        }
        effectiveProvider = cloud
      }
    }

    if (effectiveProvider === 'webllm') {
      if (!webgpuSupported) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: 'Your browser does not support WebGPU. Try Chrome 113+ or Edge 113+.' },
        ])
        setLoading(false)
        return
      }
      try {
        await sendWebLLMMessage(text)
      } finally {
        setLoading(false)
      }
      return
    }

    if (!canUseProvider(effectiveProvider)) {
      const hint =
        effectiveProvider === 'gemini'
          ? 'Connect your Google account in the settings below to use Gemini (OAuth).'
          : effectiveProvider === 'gemini-api-key'
            ? 'Add your Gemini API key in the settings below to use Gemini (API Key).'
            : effectiveProvider === 'claude'
              ? 'Add your Claude API key in the settings below to use Claude.'
              : 'Add your OpenAI API key in the settings below.'
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: hint },
      ])
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          provider: effectiveProvider === 'gemini-api-key' ? 'gemini-api-key' : effectiveProvider,
          history: buildHistory(),
          currentPage: pathname,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: data.error ?? `Request failed (${res.status})` },
        ])
        return
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply ?? '',
          pendingActions: data.pendingActions,
          routedVia: effectiveProvider as Message['routedVia'],
        },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: e instanceof Error ? e.message : 'Something went wrong.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, provider, canUseProvider, buildHistory, webgpuSupported, sendWebLLMMessage, pathname, messages.length, resolveCloudProvider, routerLlmClassification])

  // Keep ref current so the pendingInput effect always calls the latest sendMessage
  sendMessageRef.current = sendMessage

  const clearChat = clearMessages

  const webllmReady = webllmStatus.state === 'ready'
  const webllmLoading = webllmStatus.state === 'loading'

  // ─── Gemini / Cursor style layout ──────────────────────────────────────────
  if (layout === 'gemini') {
    const providerChipLabel =
      provider === 'webllm' ? 'Local'
      : provider === 'auto' ? 'Auto'
      : provider === 'openai' ? 'OpenAI'
      : provider === 'gemini' ? 'Gemini (OAuth)'
      : provider === 'gemini-api-key' ? 'Gemini'
      : provider === 'claude' ? 'Claude'
      : provider

    const providerConfigured = canUseProvider(provider)

    return (
      <div className="flex flex-col h-full bg-background">

        {/* ── Messages ──────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 space-y-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
                <Bot className="h-6 w-6 text-sky-500" />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <p className="text-sm font-medium">Ask about your finances</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {provider === 'webllm'
                    ? 'Local mode — no data leaves your device. Best for quick lookups.'
                    : provider === 'auto'
                      ? 'Simple questions → local model · Complex questions → cloud provider'
                      : 'Type a question about your plans, retirement projections, or investments.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-7">
              {messages.map((m) => (
                <div key={m.id}>
                  {m.role === 'user' ? (
                    /* User message — right-aligned, light pill */
                    <div className="flex justify-end">
                      <div className="max-w-[78%] rounded-2xl rounded-tr-sm bg-muted/60 px-4 py-2.5 text-sm leading-relaxed">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    /* AI response — Gemini style: icon + label, then full-width text */
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/10">
                          <Bot className="h-3.5 w-3.5 text-sky-500" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">AI Assistant</span>
                        {m.routedVia && (
                          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-0.5 ml-1">
                            {m.routedVia === 'local'
                              ? <MonitorSmartphone className="h-2.5 w-2.5" />
                              : <Zap className="h-2.5 w-2.5" />}
                            {routedViaLabel(m.routedVia)}
                          </span>
                        )}
                      </div>
                      <div className="pl-8 prose prose-sm dark:prose-invert max-w-none text-[13.5px] leading-relaxed">
                        <MarkdownContent content={m.content || ''} />
                      </div>
                      {m.actionsApplied?.length ? (
                        <p className="pl-8 text-xs mt-2 text-green-600 dark:text-green-400">
                          Applied: {m.actionsApplied.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {/* Pending actions */}
                  {m.pendingActions?.length ? (
                    <div className="mt-3 ml-8 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 max-w-[90%]">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-3">
                        Confirm {m.pendingActions.length} change{m.pendingActions.length > 1 ? 's' : ''}
                      </p>
                      <div className="space-y-3 mb-4">
                        {m.pendingActions.map((a, i) => {
                          const { title, changes } = formatAction(a.type, a.payload)
                          return (
                            <div key={i}>
                              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">{title}</p>
                              <div className="space-y-1">
                                {changes.map((c, j) => (
                                  <div key={j} className="flex items-baseline gap-2 text-xs text-amber-800 dark:text-amber-300">
                                    <span className="text-amber-600 dark:text-amber-500 shrink-0">{c.label}</span>
                                    <span className="border-t border-amber-200 dark:border-amber-700/50 flex-1 mx-1" />
                                    <span className="font-medium shrink-0">{c.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => confirmActions(m.id, m.pendingActions!)} disabled={loading} className="gap-1 h-7 text-xs">
                          <Check className="h-3 w-3" /> Apply changes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => dismissActions(m.id)} disabled={loading} className="gap-1 h-7 text-xs border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                          <X className="h-3 w-3" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

              {/* Streaming / thinking indicator */}
              {loading && !streamingMsgId.current && (
                <div className="flex items-center gap-2 pl-8">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Bottom input panel ─────────────────────────────────────── */}
        <div className="shrink-0 px-3 pt-2 pb-0">
          <div className="rounded-2xl border bg-card shadow-sm">

            {/* Textarea */}
            <div className="px-4 pt-3 pb-1">
              <textarea
                ref={geminiTextareaRef}
                placeholder={provider === 'webllm' ? 'Ask locally — data stays on device…' : 'Ask about your plans or data…'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                disabled={loading}
                rows={1}
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '180px' }}
              />
            </div>

            {/* Footer bar — provider + copy + send only */}
            <div className="flex items-center gap-1 px-3 pb-2.5 pt-1">
              {/* Provider selector chip */}
              <Select value={provider} onValueChange={(v) => {
                const p = v as AgentProvider
                setProvider(p)
                saveSettings(p, autoCloudProvider)
              }}>
                <SelectTrigger
                  size="sm"
                  className={cn(
                    'h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs font-medium rounded-lg',
                    'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                    !providerConfigured && provider !== 'webllm' && 'text-amber-600 dark:text-amber-500',
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" disabled={!webgpuSupported || configuredProviders.length === 0}>
                    <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />{providerLabel('auto')}</span>
                  </SelectItem>
                  <SelectItem value="webllm" disabled={!webgpuSupported}>
                    <span className="flex items-center gap-1.5"><MonitorSmartphone className="h-3.5 w-3.5" />{providerLabel('webllm')}</span>
                  </SelectItem>
                  <SelectItem value="openai">{providerLabel('openai')}</SelectItem>
                  <SelectItem value="gemini">{providerLabel('gemini')}</SelectItem>
                  <SelectItem value="gemini-api-key">{providerLabel('gemini-api-key')}</SelectItem>
                  <SelectItem value="claude">{providerLabel('claude')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Cloud provider chip — auto mode only */}
              {provider === 'auto' && (
                <Select value={autoCloudProvider} onValueChange={(v) => {
                  const cp = v as Exclude<AgentProvider, 'webllm' | 'auto'>
                  setAutoCloudProvider(cp)
                  saveSettings(provider, cp)
                }}>
                  <SelectTrigger size="sm" className="h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai" disabled={!configuredProviders.some((c) => c.provider === 'openai')}>{providerLabel('openai')}</SelectItem>
                    <SelectItem value="claude" disabled={!configuredProviders.some((c) => c.provider === 'claude')}>{providerLabel('claude')}</SelectItem>
                    <SelectItem value="gemini-api-key" disabled={!configuredProviders.some((c) => c.provider === 'gemini-api-key')}>{providerLabel('gemini-api-key')}</SelectItem>
                    <SelectItem value="gemini" disabled={!configuredProviders.some((c) => c.provider === 'gemini')}>{providerLabel('gemini')}</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* WebLLM inline status */}
              {provider === 'webllm' && !webgpuSupported && (
                <span className="text-[10px] text-red-500 px-1">WebGPU not supported</span>
              )}
              {provider === 'webllm' && webgpuSupported && !webllmReady && !webllmLoading && (
                <Button variant="ghost" size="sm" onClick={loadWebLLM} className="h-7 gap-1 text-xs px-2">
                  <Download className="h-3 w-3" /> Load model
                </Button>
              )}
              {provider === 'webllm' && webllmReady && (
                <span className="text-[10px] text-green-600 dark:text-green-400 px-1">Model ready</span>
              )}

              {/* Provider not configured hint */}
              {provider !== 'webllm' && provider !== 'auto' && !canUseProvider(provider) && (
                <span className="text-[10px] text-amber-600 dark:text-amber-500 px-1">
                  {provider === 'gemini' ? 'Connect Google in AI Settings ↓' : 'Add API key in AI Settings ↓'}
                </span>
              )}

              <div className="flex-1" />
              <Button
                size="icon"
                className="h-8 w-8 rounded-full shrink-0"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <PromptGenerator variant="inline" value={input} />
            </div>
          </div>
        </div>

        {/* ── Controls row — outside the input card ──────────────────── */}
        <div className="shrink-0 flex items-center gap-0.5 px-4 py-1.5">
          <button
            onClick={() => { setShowCredentials(true); setShowExperimentalDetails(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            AI Settings
          </button>
          <button
            onClick={() => { setShowExperimentalDetails(true); setShowCredentials(false) }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            How it works
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear chat
            </button>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/35 pr-1">Experimental</span>
        </div>

        {/* ── WebLLM status (below controls) ─────────────────────────── */}
        {provider === 'webllm' && webllmLoading && (
          <div className="shrink-0 mx-3 mb-2 rounded-xl border bg-muted/30 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="flex-1 truncate">{webllmStatus.state === 'loading' ? webllmStatus.text : 'Loading model…'}</span>
              <span className="font-mono">{webllmStatus.state === 'loading' ? `${Math.round(webllmStatus.progress * 100)}%` : ''}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${webllmStatus.state === 'loading' ? webllmStatus.progress * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
        {provider === 'webllm' && webllmStatus.state === 'error' && (
          <div className="shrink-0 mx-3 mb-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3">
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">Failed to load model: {webllmStatus.error}</p>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={loadWebLLM}>Retry</Button>
          </div>
        )}

        {/* ── AI Settings dialog ──────────────────────────────────────── */}
        <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle className="text-base">Configure AI Provider</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add your API keys to enable cloud AI. Keys are encrypted and stored securely for cross-device sync.
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AgentCredentialsForm onSaved={() => { fetchCredentials(); setShowCredentials(false) }} />
            </div>
          </DialogContent>
        </Dialog>

        {/* ── How it works dialog ─────────────────────────────────────── */}
        <Dialog open={showExperimentalDetails} onOpenChange={setShowExperimentalDetails}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle className="text-base">How the AI Assistant works</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Experimental · Grounded in your data · Bring your own provider</p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-muted-foreground space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">About this feature</p>
                <p>
                  The AI Assistant is part of our mission to make personal financial planning more accessible
                  and intuitive. It lets you ask natural-language questions grounded in your own data — your
                  income, retirement plans, investments, and more — and get specific, numbers-backed answers
                  without manual lookups.
                </p>
                <p>
                  You can contribute by trying the assistant in your planning and sharing feedback via the
                  feedback button. Your input directly shapes what we build next.
                </p>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">How AI providers work</p>
                <p>
                  My Plan does not pay for or operate any AI service. You bring your own provider — all
                  costs (if any) are between you and the provider. Use the provider selector in the input
                  box to choose your option. Here&apos;s how each works:
                </p>
                <ul className="space-y-3 text-xs">
                  <li>
                    <span className="font-semibold text-foreground">Auto (Hybrid)</span>
                    {' '}— automatically routes each message: simple lookups and definitions go to the local
                    WebLLM model (no data leaves your device); complex questions like projections, simulations,
                    and analysis go to your configured cloud provider. Requires WebGPU support and at least
                    one cloud API key.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Local (WebLLM)</span>
                    {' '}— runs a small language model entirely in your browser using WebGPU. No data ever
                    leaves your device. Requires Chrome 113+ or Edge 113+ and a capable GPU. The model
                    (~1.5 GB) is downloaded once and cached locally.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">OpenAI (API Key)</span>
                    {' '}— uses OpenAI&apos;s API with your own key. Create one at{' '}
                    <span className="font-mono text-foreground/70">platform.openai.com/api-keys</span>.
                    Your key is encrypted and stored for cross-device sync. Usage is billed to your OpenAI account.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Claude (API Key)</span>
                    {' '}— uses Anthropic&apos;s Claude API with your own key. Create one at{' '}
                    <span className="font-mono text-foreground/70">console.anthropic.com/settings/keys</span>.
                    Your key is encrypted and stored. Choose from models like Claude Sonnet 4, Claude 3.5 Sonnet, and Claude 3 Haiku.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Gemini (OAuth)</span>
                    {' '}— connects to Google&apos;s Gemini API through your Google account via OAuth. No API
                    key needed — you authorise My Plan to make requests on your behalf. Requires a Google
                    Cloud project with the Generative Language API enabled.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Gemini (API Key)</span>
                    {' '}— uses Google&apos;s Gemini API with a key you create at{' '}
                    <span className="font-mono text-foreground/70">aistudio.google.com/apikey</span>.
                    Your key is encrypted and stored. Free-tier usage is available for most models.
                  </li>
                </ul>
              </div>

              <p className="text-xs border-t pt-4 text-muted-foreground/60">
                Open <strong className="text-foreground/70">AI Settings</strong> to configure your preferred provider and model.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── Default layout (docked / fullscreen) ──────────────────────────────────
  return (
    <div className={cn(
      'flex flex-col h-full',
      embedded ? 'bg-background' : 'rounded-xl border bg-card'
    )}>

      {/* Messages */}
      <div className={cn(
        'flex-1 overflow-y-auto p-4 space-y-4',
        embedded ? 'min-h-0' : 'min-h-[320px] max-h-[50vh]'
      )}>
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ask a question about your plans or data.
            </p>
            {provider === 'webllm' && webgpuSupported && (
              <p className="text-xs text-muted-foreground">
                Local mode — data never leaves your device.
                {!webllmReady && ' Load the model first using "AI Settings" below.'}
              </p>
            )}
            {provider === 'auto' && (
              <p className="text-xs text-muted-foreground">
                Simple questions → Local · Complex questions → Cloud
              </p>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div className={cn('flex gap-3', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  'rounded-lg max-w-[85%] text-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground px-3 py-2'
                    : 'bg-muted px-3.5 py-2.5'
                )}
              >
                {m.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                ) : (
                  <MarkdownContent content={m.content || ''} />
                )}
                {m.actionsApplied?.length ? (
                  <p className="text-xs mt-1.5 opacity-80">Applied: {m.actionsApplied.join(', ')}</p>
                ) : null}
                {m.role === 'assistant' && m.routedVia && (
                  <p className="text-[10px] mt-1.5 opacity-50 flex items-center gap-0.5">
                    {m.routedVia === 'local' ? <MonitorSmartphone className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                    {routedViaLabel(m.routedVia)}
                  </p>
                )}
              </div>
              {m.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            {/* Confirmation banner for pending actions */}
            {m.pendingActions?.length ? (
              <div className="ml-11 mt-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 max-w-[85%]">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-3">
                  Confirm {m.pendingActions.length} change{m.pendingActions.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-3 mb-4">
                  {m.pendingActions.map((a, i) => {
                    const { title, changes } = formatAction(a.type, a.payload)
                    return (
                      <div key={i}>
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1.5">{title}</p>
                        <div className="space-y-1">
                          {changes.map((c, j) => (
                            <div key={j} className="flex items-baseline gap-2 text-xs text-amber-800 dark:text-amber-300">
                              <span className="text-amber-600 dark:text-amber-500 shrink-0">{c.label}</span>
                              <span className="border-t border-amber-200 dark:border-amber-700/50 flex-1 mx-1" />
                              <span className="font-medium shrink-0">{c.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => confirmActions(m.id, m.pendingActions!)}
                    disabled={loading}
                    className="gap-1"
                  >
                    <Check className="h-3 w-3" /> Apply changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissActions(m.id)}
                    disabled={loading}
                    className="gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {loading && !streamingMsgId.current && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg px-3 py-2 bg-muted flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── WebLLM status strips ─────────────────────────────────── */}
      {provider === 'webllm' && webllmLoading && (
        <div className="shrink-0 border-t px-4 py-3 space-y-1.5 bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="flex-1 truncate">{webllmStatus.state === 'loading' ? webllmStatus.text : 'Loading model…'}</span>
            <span className="font-mono">{webllmStatus.state === 'loading' ? `${Math.round(webllmStatus.progress * 100)}%` : ''}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${webllmStatus.state === 'loading' ? webllmStatus.progress * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {provider === 'webllm' && webllmStatus.state === 'error' && (
        <div className="shrink-0 border-t px-4 py-3 bg-red-50 dark:bg-red-950/20">
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">Failed to load model: {webllmStatus.error}</p>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={loadWebLLM}>Retry</Button>
        </div>
      )}

      {/* ── Input card ───────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pt-2 pb-0 border-t">
        <div className="rounded-2xl border bg-card shadow-sm mt-2">
          <div className="px-4 pt-3 pb-1">
            <textarea
              ref={geminiTextareaRef}
              placeholder={provider === 'webllm' ? 'Ask locally — data stays on device…' : 'Ask about your plans or data…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              disabled={loading}
              rows={2}
              className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 leading-relaxed"
              style={{ minHeight: '44px', maxHeight: '180px' }}
            />
          </div>
          <div className="flex items-center gap-1 px-3 pb-2.5 pt-1">
            <Select value={provider} onValueChange={(v) => { const p = v as AgentProvider; setProvider(p); saveSettings(p, autoCloudProvider) }}>
              <SelectTrigger size="sm" className={cn('h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors', !canUseProvider(provider) && provider !== 'webllm' && 'text-amber-600 dark:text-amber-500')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" disabled={!webgpuSupported || configuredProviders.length === 0}><span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />{providerLabel('auto')}</span></SelectItem>
                <SelectItem value="webllm" disabled={!webgpuSupported}><span className="flex items-center gap-1.5"><MonitorSmartphone className="h-3.5 w-3.5" />{providerLabel('webllm')}</span></SelectItem>
                <SelectItem value="openai">{providerLabel('openai')}</SelectItem>
                <SelectItem value="gemini">{providerLabel('gemini')}</SelectItem>
                <SelectItem value="gemini-api-key">{providerLabel('gemini-api-key')}</SelectItem>
                <SelectItem value="claude">{providerLabel('claude')}</SelectItem>
              </SelectContent>
            </Select>
            {provider === 'auto' && (
              <Select value={autoCloudProvider} onValueChange={(v) => { const cp = v as Exclude<AgentProvider, 'webllm' | 'auto'>; setAutoCloudProvider(cp); saveSettings(provider, cp) }}>
                <SelectTrigger size="sm" className="h-7 w-auto gap-1 border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai" disabled={!configuredProviders.some((c) => c.provider === 'openai')}>{providerLabel('openai')}</SelectItem>
                  <SelectItem value="claude" disabled={!configuredProviders.some((c) => c.provider === 'claude')}>{providerLabel('claude')}</SelectItem>
                  <SelectItem value="gemini-api-key" disabled={!configuredProviders.some((c) => c.provider === 'gemini-api-key')}>{providerLabel('gemini-api-key')}</SelectItem>
                  <SelectItem value="gemini" disabled={!configuredProviders.some((c) => c.provider === 'gemini')}>{providerLabel('gemini')}</SelectItem>
                </SelectContent>
              </Select>
            )}
            {provider === 'webllm' && !webgpuSupported && <span className="text-[10px] text-red-500 px-1">WebGPU not supported</span>}
            {provider === 'webllm' && webgpuSupported && !webllmReady && !webllmLoading && (
              <Button variant="ghost" size="sm" onClick={loadWebLLM} className="h-7 gap-1 text-xs px-2"><Download className="h-3 w-3" /> Load model</Button>
            )}
            {provider === 'webllm' && webllmReady && <span className="text-[10px] text-green-600 dark:text-green-400 px-1">Model ready</span>}
            {provider !== 'webllm' && provider !== 'auto' && !canUseProvider(provider) && (
              <span className="text-[10px] text-amber-600 dark:text-amber-500 px-1">{provider === 'gemini' ? 'Connect Google in AI Settings ↓' : 'Add API key in AI Settings ↓'}</span>
            )}
            <div className="flex-1" />
            <Button size="icon" className="h-8 w-8 rounded-full shrink-0" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <PromptGenerator variant="inline" value={input} />
          </div>
        </div>
      </div>

      {/* ── Controls row ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-0.5 px-4 py-1.5 pb-2">
        <button onClick={() => { setShowCredentials(true); setShowExperimentalDetails(false) }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Settings2 className="h-3.5 w-3.5" /> AI Settings
        </button>
        <button onClick={() => { setShowExperimentalDetails(true); setShowCredentials(false) }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Info className="h-3.5 w-3.5" /> How it works
        </button>
        {messages.length > 0 && (
          <button onClick={clearChat} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" /> Clear chat
          </button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/35 pr-1">Experimental</span>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────── */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-base">Configure AI Provider</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Add your API keys to enable cloud AI. Keys are encrypted and stored securely for cross-device sync.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AgentCredentialsForm onSaved={() => { fetchCredentials(); setShowCredentials(false) }} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExperimentalDetails} onOpenChange={setShowExperimentalDetails}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="text-base">How the AI Assistant works</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Experimental · Grounded in your data · Bring your own provider</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-muted-foreground space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">About this feature</p>
              <p>
                The AI Assistant is part of our mission to make personal financial planning more accessible
                and intuitive. It lets you ask natural-language questions grounded in your own data — your
                income, retirement plans, investments, and more — and get specific, numbers-backed answers
                without manual lookups.
              </p>
              <p>
                You can contribute by trying the assistant in your planning and sharing feedback via the
                feedback button. Your input directly shapes what we build next.
              </p>
            </div>

            <div className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">How AI providers work</p>
              <p>
                My Plan does not pay for or operate any AI service. You bring your own provider — all
                costs (if any) are between you and the provider. Use the provider selector in the input
                box to choose your option. Here&apos;s how each works:
              </p>
              <ul className="space-y-3 text-xs">
                <li>
                  <span className="font-semibold text-foreground">Auto (Hybrid)</span>
                  {' '}— automatically routes each message: simple lookups and definitions go to the local
                  WebLLM model (no data leaves your device); complex questions like projections, simulations,
                  and analysis go to your configured cloud provider. Requires WebGPU support and at least
                  one cloud API key.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Local (WebLLM)</span>
                  {' '}— runs a small language model entirely in your browser using WebGPU. No data ever
                  leaves your device. Requires Chrome 113+ or Edge 113+ and a capable GPU. The model
                  (~1.5 GB) is downloaded once and cached locally.
                </li>
                <li>
                  <span className="font-semibold text-foreground">OpenAI (API Key)</span>
                  {' '}— uses OpenAI&apos;s API with your own key. Create one at{' '}
                  <span className="font-mono text-foreground/70">platform.openai.com/api-keys</span>.
                  Your key is encrypted and stored for cross-device sync. Usage is billed to your OpenAI account.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Claude (API Key)</span>
                  {' '}— uses Anthropic&apos;s Claude API with your own key. Create one at{' '}
                  <span className="font-mono text-foreground/70">console.anthropic.com/settings/keys</span>.
                  Your key is encrypted and stored. Choose from models like Claude Sonnet 4, Claude 3.5 Sonnet, and Claude 3 Haiku.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Gemini (OAuth)</span>
                  {' '}— connects to Google&apos;s Gemini API through your Google account via OAuth. No API
                  key needed — you authorise My Plan to make requests on your behalf. Requires a Google
                  Cloud project with the Generative Language API enabled.
                </li>
                <li>
                  <span className="font-semibold text-foreground">Gemini (API Key)</span>
                  {' '}— uses Google&apos;s Gemini API with a key you create at{' '}
                  <span className="font-mono text-foreground/70">aistudio.google.com/apikey</span>.
                  Your key is encrypted and stored. Free-tier usage is available for most models.
                </li>
              </ul>
            </div>

            <p className="text-xs border-t pt-4 text-muted-foreground/60">
              Open <strong className="text-foreground/70">AI Settings</strong> to configure your preferred provider and model.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

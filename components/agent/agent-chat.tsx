'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Send, Bot, User, Settings2, Loader2, Trash2, Check, X, Download, MonitorSmartphone, FlaskConical, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { MarkdownContent } from './markdown-content'
import { AgentCredentialsForm } from './agent-credentials-form'
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
}

export function AgentChat({ mode }: AgentChatProps) {
  const embedded = mode === 'docked' || mode === 'fullscreen'
  const pathname = usePathname()
  const { messages, setMessages, clearMessages } = useAgentChat()
  const [provider, setProvider] = useState<AgentProvider>('openai')
  const [autoCloudProvider, setAutoCloudProvider] = useState<Exclude<AgentProvider, 'webllm' | 'auto'>>('openai')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [configuredProviders, setConfiguredProviders] = useState<{ provider: string }[]>([])
  const [routerLlmClassification, setRouterLlmClassification] = useState(true)
  const [showCredentials, setShowCredentials] = useState(false)
  const [showExperimentalDetails, setShowExperimentalDetails] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [webllmStatus, setWebllmStatus] = useState<WebLLMStatus>({ state: 'idle' })
  const [webgpuSupported] = useState(() => isWebGPUAvailable())
  const streamingMsgId = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

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
      const res = await fetch('/api/agent/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.provider) setProvider(data.provider as AgentProvider)
        if (data.autoCloudProvider) setAutoCloudProvider(data.autoCloudProvider as Exclude<AgentProvider, 'webllm' | 'auto'>)
        settingsLoaded.current = true
      }
    } catch {
      settingsLoaded.current = true
    }
  }, [])

  const saveSettings = useCallback(async (newProvider: AgentProvider, newCloudProvider: Exclude<AgentProvider, 'webllm' | 'auto'>) => {
    if (!settingsLoaded.current) return
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
    fetchCredentials()
    fetchConfig()
    fetchSavedSettings()
  }, [fetchCredentials, fetchConfig, fetchSavedSettings])

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

  const confirmActions = useCallback(async (messageId: string, actions: PendingAction[]) => {
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
      const applied = (data.results ?? [])
        .map((r: { success: boolean }, i: number) => r.success ? actions[i]?.type : null)
        .filter(Boolean) as string[]
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, pendingActions: undefined, actionsApplied: applied, content: m.content + '\n\nChanges applied.' }
            : m
        )
      )
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

  const sendMessage = useCallback(async () => {
    const text = input.trim()
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

  const clearChat = clearMessages

  const webllmReady = webllmStatus.state === 'ready'
  const webllmLoading = webllmStatus.state === 'loading'

  return (
    <div className={cn(
      'flex flex-col h-full',
      embedded ? 'bg-background' : 'rounded-xl border bg-card'
    )}>
      {/* Experimental feature banner */}
      <div className="border-b bg-amber-50/80 dark:bg-amber-950/20">
        <button
          onClick={() => setShowExperimentalDetails((s) => !s)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            Experimental feature — still in development
          </span>
          {showExperimentalDetails
            ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
        </button>
        {showExperimentalDetails && (
          <div className="px-3 pb-3 space-y-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="space-y-1.5">
              <p className="font-semibold">About this feature</p>
              <p>
                The AI Assistant is part of our mission to make personal financial planning more accessible and intuitive.
                It lets you ask natural-language questions grounded in your own data — your income, retirement plans,
                property investments, and more — and get specific, numbers-backed answers without manual lookups.
              </p>
              <p>
                You can contribute to this mission by trying the app, using the assistant in your planning,
                and providing feedback. Your participation helps us improve the product for everyone. We'd love to hear
                your suggestions and issues — use the feedback button to share them. Your input directly shapes what we build next.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">How AI providers work</p>
              <p>
                My Plan does not pay for or operate any AI service. You bring your own provider, and all costs
                (if any) are between you and the provider. Here's how each option works:
              </p>
                <ul className="space-y-2 mt-1.5">
                  <li>
                    <span className="font-medium">Auto (Hybrid)</span> — Automatically routes each message: simple lookups
                    and definitions go to the local WebLLM model (no data leaves your device); complex questions like projections,
                    simulations, and analysis go to your configured cloud provider.
                    Requires WebGPU support and at least one cloud API key.
                  </li>
                  <li>
                    <span className="font-medium">Local (WebLLM)</span> — Runs a small language model entirely
                  in your browser using WebGPU. No data ever leaves your device. Requires Chrome 113+ or
                  Edge 113+ and a capable GPU. The model (~1.5 GB) is downloaded once and cached.
                </li>
                <li>
                  <span className="font-medium">OpenAI (API Key)</span> — Uses OpenAI's API with your own
                  API key. Create a key at <span className="font-mono">platform.openai.com/api-keys</span>.
                  Your key is encrypted and stored for cross-device sync. Usage is billed to your OpenAI account.
                </li>
                <li>
                  <span className="font-medium">Claude (API Key)</span> — Uses Anthropic's Claude API with your own
                  API key. Create a key at <span className="font-mono">console.anthropic.com/settings/keys</span>.
                  Your key is encrypted and stored. You can choose from models like Claude Sonnet 4, Claude 3.5 Sonnet, and Claude 3 Haiku.
                </li>
                <li>
                  <span className="font-medium">Gemini (OAuth)</span> — Connects to Google's Gemini API
                  through your Google account via OAuth. No API key needed — you authorize My Plan to make
                  requests on your behalf. Requires a Google Cloud project with the Generative Language API enabled.
                </li>
                <li>
                  <span className="font-medium">Gemini (API Key)</span> — Uses Google's Gemini API with an
                  API key you create at <span className="font-mono">aistudio.google.com/apikey</span>.
                  Your key is encrypted and stored. Free-tier usage is available for most models.
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Click &quot;AI Settings&quot; to configure your preferred provider and model.
            </p>
          </div>
        )}
      </div>

      {/* Header: agent selector + settings toggle + clear */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <div className="w-full sm:w-auto space-y-1">
          <label className="text-xs font-medium text-muted-foreground block">Choose AI Provider</label>
          <Select value={provider} onValueChange={(v) => {
            const p = v as AgentProvider
            setProvider(p)
            saveSettings(p, autoCloudProvider)
          }}>
            <SelectTrigger className="w-[200px]" size="default">
              <SelectValue placeholder="Choose AI Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" disabled={!webgpuSupported || configuredProviders.length === 0}>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  {providerLabel('auto')}
                </span>
              </SelectItem>
              <SelectItem value="webllm" disabled={!webgpuSupported}>
                <span className="flex items-center gap-1.5">
                  <MonitorSmartphone className="h-3.5 w-3.5" />
                  {providerLabel('webllm')}
                </span>
              </SelectItem>
              <SelectItem value="openai">{providerLabel('openai')}</SelectItem>
              <SelectItem value="gemini">{providerLabel('gemini')}</SelectItem>
              <SelectItem value="gemini-api-key">{providerLabel('gemini-api-key')}</SelectItem>
              <SelectItem value="claude">{providerLabel('claude')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cloud provider selector — only shown in auto mode */}
        {provider === 'auto' && (
          <div className="w-full sm:w-auto space-y-1">
            <label className="text-xs font-medium text-muted-foreground block">Cloud provider (complex)</label>
            <Select
              value={autoCloudProvider}
              onValueChange={(v) => {
                const cp = v as Exclude<AgentProvider, 'webllm' | 'auto'>
                setAutoCloudProvider(cp)
                saveSettings(provider, cp)
              }}
            >
              <SelectTrigger className="w-[180px]" size="default">
                <SelectValue placeholder="Choose cloud provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai" disabled={!configuredProviders.some((c) => c.provider === 'openai')}>
                  {providerLabel('openai')}
                </SelectItem>
                <SelectItem value="claude" disabled={!configuredProviders.some((c) => c.provider === 'claude')}>
                  {providerLabel('claude')}
                </SelectItem>
                <SelectItem value="gemini-api-key" disabled={!configuredProviders.some((c) => c.provider === 'gemini-api-key')}>
                  {providerLabel('gemini-api-key')}
                </SelectItem>
                <SelectItem value="gemini" disabled={!configuredProviders.some((c) => c.provider === 'gemini')}>
                  {providerLabel('gemini')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {provider === 'webllm' && !webgpuSupported && (
          <span className="text-xs text-red-600 dark:text-red-400">WebGPU not supported</span>
        )}
        {provider === 'webllm' && webgpuSupported && !webllmReady && !webllmLoading && (
          <Button variant="outline" size="sm" onClick={loadWebLLM} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Load Model
          </Button>
        )}
        {provider === 'webllm' && webllmReady && (
          <span className="text-xs text-green-600 dark:text-green-400">Model ready</span>
        )}
        {provider !== 'webllm' && provider !== 'auto' && !canUseProvider(provider) && (
          <span className="text-xs text-amber-600 dark:text-amber-500">
            {provider === 'gemini' ? 'Connect Google below' : 'Add API key in AI Settings'}
          </span>
        )}
        {provider === 'auto' && !webgpuSupported && (
          <span className="text-xs text-amber-600 dark:text-amber-500">WebGPU required for local routing</span>
        )}
        {provider === 'auto' && webgpuSupported && configuredProviders.length === 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-500">Add a cloud API key for complex questions</span>
        )}
        {provider === 'auto' && webgpuSupported && configuredProviders.length > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Simple → Local · Complex → {providerLabel(resolveCloudProvider() as AgentProvider ?? autoCloudProvider)}
            {' '}· Router: {routerLlmClassification ? 'LLM' : 'rules'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearChat} disabled={loading}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowCredentials((s) => !s)}>
            <Settings2 className="h-4 w-4 mr-1" />
            {showCredentials ? 'Hide' : 'AI Settings'}
          </Button>
        </div>
      </div>

      {/* WebLLM loading progress */}
      {provider === 'webllm' && webllmLoading && (
        <div className="border-b p-3 space-y-2 bg-muted/30">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="flex-1 text-xs text-muted-foreground truncate">
              {webllmStatus.state === 'loading' ? webllmStatus.text : 'Loading…'}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {webllmStatus.state === 'loading' ? `${Math.round(webllmStatus.progress * 100)}%` : ''}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${webllmStatus.state === 'loading' ? webllmStatus.progress * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* WebLLM error */}
      {provider === 'webllm' && webllmStatus.state === 'error' && (
        <div className="border-b p-3 bg-red-50 dark:bg-red-950/20">
          <p className="text-xs text-red-700 dark:text-red-300">
            Failed to load model: {webllmStatus.error}
          </p>
          <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={loadWebLLM}>
            Retry
          </Button>
        </div>
      )}

      {showCredentials && (
        <div className="border-b p-3 bg-muted/30">
          <AgentCredentialsForm onSaved={fetchCredentials} />
        </div>
      )}

      {/* Messages */}
      <div className={cn(
        'flex-1 overflow-y-auto p-4 space-y-4',
        embedded ? 'min-h-0' : 'min-h-[320px] max-h-[50vh]'
      )}>
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              Ask a question about your plans or data. Switch the agent above anytime.
            </p>
            {provider === 'webllm' && webgpuSupported && (
              <p className="text-xs text-muted-foreground">
                Local mode runs entirely in your browser via WebGPU. No data leaves your device.
                {!webllmReady && ' Click "Load Model" to download the model first (~1.5 GB one-time).'}
              </p>
            )}
            {provider === 'auto' && (
              <p className="text-xs text-muted-foreground">
                Simple questions (fact lookups, definitions) → Local model. Complex questions (projections, analysis, simulations) → Cloud.
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
              <div className="ml-11 mt-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 max-w-[85%]">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
                  The assistant wants to make {m.pendingActions.length} change{m.pendingActions.length > 1 ? 's' : ''}:
                </p>
                <ul className="space-y-1 mb-3">
                  {m.pendingActions.map((a, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-400 font-mono">
                      {a.type}: {JSON.stringify(a.payload)}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => confirmActions(m.id, m.pendingActions!)}
                    disabled={loading}
                    className="gap-1"
                  >
                    <Check className="h-3 w-3" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissActions(m.id)}
                    disabled={loading}
                    className="gap-1"
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

      {/* Input */}
      <div className="flex gap-2 p-3 border-t">
        <Input
          placeholder={provider === 'webllm' ? 'Ask locally — data stays on device…' : 'Ask about your plans or data…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={sendMessage} disabled={loading || !input.trim()} size="icon">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

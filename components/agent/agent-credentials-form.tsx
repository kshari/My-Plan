'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const GEMINI_STATIC_MODELS = [
  { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
  { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-flash-8b', displayName: 'Gemini 1.5 Flash 8B' },
  { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.0-pro', displayName: 'Gemini 1.0 Pro' },
]

const CLAUDE_STATIC_MODELS = [
  { id: 'claude-sonnet-4-20250514', displayName: 'Claude Sonnet 4' },
  { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku' },
  { id: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku' },
  { id: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus' },
]

interface AgentCredentialsFormProps {
  onSaved?: () => void
}

interface ProviderRow {
  provider: string
  createdAt?: string
  updatedAt?: string
  preferredModel?: string
}

interface GeminiModel {
  id: string
  displayName?: string
}

export function AgentCredentialsForm({ onSaved }: AgentCredentialsFormProps) {
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [openaiKey, setOpenaiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [geminiKey, setGeminiKey] = useState('')
  const [claudeKey, setClaudeKey] = useState('')
  const [geminiModelsOAuth, setGeminiModelsOAuth] = useState<GeminiModel[]>([])
  const [geminiModelsApiKey, setGeminiModelsApiKey] = useState<GeminiModel[]>([])
  const [loadingModelsOAuth, setLoadingModelsOAuth] = useState(false)
  const [loadingModelsApiKey, setLoadingModelsApiKey] = useState(false)
  const [selectedModelOAuth, setSelectedModelOAuth] = useState<string>('gemini-2.0-flash')
  const [selectedModelApiKey, setSelectedModelApiKey] = useState<string>('gemini-2.0-flash')
  const [selectedModelClaude, setSelectedModelClaude] = useState<string>('claude-sonnet-4-20250514')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/credentials')
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers ?? [])
        const geminiOAuth = (data.providers ?? []).find((p: ProviderRow) => p.provider === 'gemini')
        const geminiApiKey = (data.providers ?? []).find((p: ProviderRow) => p.provider === 'gemini-api-key')
        const claudeRow = (data.providers ?? []).find((p: ProviderRow) => p.provider === 'claude')
        if (geminiOAuth?.preferredModel) setSelectedModelOAuth(geminiOAuth.preferredModel)
        if (geminiApiKey?.preferredModel) setSelectedModelApiKey(geminiApiKey.preferredModel)
        if (claudeRow?.preferredModel) setSelectedModelClaude(claudeRow.preferredModel)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!providers.some((p) => p.provider === 'gemini')) return
    setLoadingModelsOAuth(true)
    fetch('/api/agent/models?provider=gemini')
      .then((r) => r.ok ? r.json() : { models: [] })
      .then((d) => setGeminiModelsOAuth(d.models ?? []))
      .catch(() => setGeminiModelsOAuth([]))
      .finally(() => setLoadingModelsOAuth(false))
  }, [providers])

  useEffect(() => {
    if (!providers.some((p) => p.provider === 'gemini-api-key')) return
    setLoadingModelsApiKey(true)
    fetch('/api/agent/models?provider=gemini-api-key')
      .then((r) => r.ok ? r.json() : { models: [] })
      .then((d) => setGeminiModelsApiKey(d.models ?? []))
      .catch(() => setGeminiModelsApiKey([]))
      .finally(() => setLoadingModelsApiKey(false))
  }, [providers])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'gemini-oauth-complete') {
        if (e.data.success) {
          toast.success('Google account connected for Gemini')
          onSaved?.()
          load()
        } else {
          toast.error('Failed to connect Google account')
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [load, onSaved])

  const hasOpenai = providers.some((p) => p.provider === 'openai')
  const hasGeminiOAuth = providers.some((p) => p.provider === 'gemini')
  const hasGeminiApiKey = providers.some((p) => p.provider === 'gemini-api-key')
  const hasClaude = providers.some((p) => p.provider === 'claude')

  const geminiOAuthModels = geminiModelsOAuth.length > 0 ? geminiModelsOAuth : GEMINI_STATIC_MODELS
  const geminiApiKeyModels = geminiModelsApiKey.length > 0 ? geminiModelsApiKey : GEMINI_STATIC_MODELS

  const handleSaveApiKey = async (provider: 'openai' | 'gemini-api-key' | 'claude', key: string, preferredModel?: string) => {
    const trimmed = key.trim()
    if (!trimmed) {
      toast.error('Enter an API key')
      return
    }
    setSaving(true)
    try {
      const body: { provider: string; apiKey: string; preferredModel?: string } = { provider, apiKey: trimmed }
      if ((provider === 'gemini-api-key' || provider === 'claude') && preferredModel) body.preferredModel = preferredModel
      const res = await fetch('/api/agent/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save')
        return
      }
      const labels: Record<string, string> = { openai: 'OpenAI key saved', 'gemini-api-key': 'Gemini API key saved', claude: 'Claude key saved' }
      toast.success(labels[provider] ?? 'Key saved')
      if (provider === 'openai') setOpenaiKey('')
      else if (provider === 'claude') setClaudeKey('')
      else setGeminiKey('')
      onSaved?.()
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleSetGeminiModel = async (provider: 'gemini' | 'gemini-api-key', modelId: string) => {
    if (provider === 'gemini') setSelectedModelOAuth(modelId)
    else setSelectedModelApiKey(modelId)
    setSaving(true)
    try {
      const res = await fetch('/api/agent/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, preferredModel: modelId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save model')
        return
      }
      toast.success('Model updated')
      onSaved?.()
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleSetClaudeModel = async (modelId: string) => {
    setSelectedModelClaude(modelId)
    setSaving(true)
    try {
      const res = await fetch('/api/agent/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'claude', preferredModel: modelId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save model')
        return
      }
      toast.success('Model updated')
      onSaved?.()
      load()
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (provider: string) => {
    try {
      const res = await fetch(`/api/agent/credentials?provider=${encodeURIComponent(provider)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        const msg = provider === 'gemini' ? 'Google account disconnected' : provider === 'gemini-api-key' ? 'Gemini API key removed' : provider === 'claude' ? 'Claude key removed' : 'Key removed'
        toast.success(msg)
        onSaved?.()
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to remove')
      }
    } catch {
      toast.error('Failed to remove')
    }
  }

  const connectGoogle = () => {
    const w = 500
    const h = 600
    const left = window.screenX + (window.outerWidth - w) / 2
    const top = window.screenY + (window.outerHeight - h) / 2
    window.open(
      '/api/agent/google/authorize',
      'google-oauth',
      `width=${w},height=${h},left=${left},top=${top}`
    )
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Configure AI providers. Credentials are encrypted and synced across devices.
      </p>

      {/* OpenAI (API Key) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OpenAI (API Key)</Label>
        {hasOpenai ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-600 dark:text-green-400">API key configured</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-destructive hover:text-destructive"
              onClick={() => handleRemove('openai')}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <Input
                type="password"
                placeholder="sk-…"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={() => handleSaveApiKey('openai', openaiKey)} disabled={saving || !openaiKey.trim()} size="sm">
              {saving ? 'Saving…' : 'Save Key'}
            </Button>
          </div>
        )}
      </div>

      {/* Gemini (OAuth) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gemini (OAuth)</Label>
        {hasGeminiOAuth ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">Google account connected</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => handleRemove('gemini')}
              >
                Disconnect
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
              <Select
                value={selectedModelOAuth}
                onValueChange={(v) => handleSetGeminiModel('gemini', v)}
                disabled={saving || loadingModelsOAuth}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={loadingModelsOAuth ? 'Loading…' : 'Select model'} />
                </SelectTrigger>
                <SelectContent>
                  {geminiOAuthModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName ?? m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={connectGoogle}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Connect with Google
          </Button>
        )}
      </div>

      {/* Gemini (API Key) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gemini (API Key)</Label>
        {hasGeminiApiKey ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">API key configured</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => handleRemove('gemini-api-key')}
              >
                Remove
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
              <Select
                value={selectedModelApiKey}
                onValueChange={(v) => handleSetGeminiModel('gemini-api-key', v)}
                disabled={saving || loadingModelsApiKey}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder={loadingModelsApiKey ? 'Loading…' : 'Select model'} />
                </SelectTrigger>
                <SelectContent>
                  {geminiApiKeyModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName ?? m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Input
                  type="password"
                  placeholder="Paste Gemini API key"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                onClick={() => handleSaveApiKey('gemini-api-key', geminiKey, selectedModelApiKey)}
                disabled={saving || !geminiKey.trim()}
                size="sm"
              >
                {saving ? 'Saving…' : 'Save Key'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
              <Select value={selectedModelApiKey} onValueChange={setSelectedModelApiKey}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_STATIC_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName ?? m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Claude (API Key) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claude (API Key)</Label>
        {hasClaude ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-600 dark:text-green-400">API key configured</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => handleRemove('claude')}
              >
                Remove
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
              <Select
                value={selectedModelClaude}
                onValueChange={handleSetClaudeModel}
                disabled={saving}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {CLAUDE_STATIC_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Input
                  type="password"
                  placeholder="sk-ant-…"
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                onClick={() => handleSaveApiKey('claude', claudeKey, selectedModelClaude)}
                disabled={saving || !claudeKey.trim()}
                size="sm"
              >
                {saving ? 'Saving…' : 'Save Key'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground shrink-0">Model</Label>
              <Select value={selectedModelClaude} onValueChange={setSelectedModelClaude}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAUDE_STATIC_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

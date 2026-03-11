'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Cpu,
  Wrench,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface LogItem {
  id: string
  user_id: string
  provider: string
  model: string | null
  user_prompt: string | null
  tool_calls_used: boolean
  actions_requested: string[] | null
  status: string
  error_message: string | null
  duration_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
  context_preview?: string | null
  result_summary?: string | null
  decisions?: string | null
  prompt_sent?: string | null
}

const STATUS_CONF: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Success' },
  partial: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', label: 'Partial' },
  error: { icon: AlertCircle, color: 'text-red-600 dark:text-red-400', label: 'Error' },
}

const PROVIDER_COLOR: Record<string, string> = {
  openai: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  claude: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  gemini: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'gemini-api-key': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  webllm: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
}

interface AdminAgentLogsProps {
  initialLogs: LogItem[]
  emailMap: Record<string, string>
}

export function AdminAgentLogs({ initialLogs, emailMap }: AdminAgentLogsProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)

  async function handleDeleteOne(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/agent-logs?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to delete log')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const res = await fetch('/api/admin/agent-logs?all=true', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || res.statusText)
      }
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Failed to delete logs')
    } finally {
      setDeletingAll(false)
    }
  }

  const filtered = initialLogs.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false
    if (providerFilter !== 'all' && l.provider !== providerFilter) return false
    return true
  })

  const providers = [...new Set(initialLogs.map((l) => l.provider))]
  const errorCount = initialLogs.filter((l) => l.status === 'error').length

  function formatTs(ts: string) {
    const d = new Date(ts)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function userLabel(userId: string) {
    return emailMap[userId] || userId.slice(0, 8) + '…'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agent Request Logs</h1>
          <p className="text-sm text-muted-foreground">
            {initialLogs.length} requests{errorCount > 0 && <> &middot; <span className="text-red-600 dark:text-red-400">{errorCount} errors</span></>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Status filter */}
          <div className="flex gap-1">
            {['all', 'success', 'partial', 'error'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Provider filter */}
          {providers.length > 1 && (
            <div className="flex gap-1">
              {['all', ...providers].map((p) => (
                <button
                  key={p}
                  onClick={() => setProviderFilter(p)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                    providerFilter === p
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={initialLogs.length === 0 || deletingAll}>
                {deletingAll ? 'Deleting…' : 'Delete all'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all agent logs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove all {initialLogs.length} log entries. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          No agent logs found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const conf = STATUS_CONF[log.status] || STATUS_CONF.success
            const StatusIcon = conf.icon
            const expanded = expandedId === log.id

            return (
              <div key={log.id} className="rounded-xl border bg-card overflow-hidden">
                <div className="flex w-full items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    className="flex flex-1 items-center gap-3 text-left hover:bg-accent/30 transition-colors min-w-0"
                  >
                    <StatusIcon className={cn('h-4 w-4 shrink-0', conf.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate max-w-[350px]">
                          {log.user_prompt?.slice(0, 80) || '(empty prompt)'}
                          {log.user_prompt && log.user_prompt.length > 80 ? '…' : ''}
                        </span>
                        <Badge variant="secondary" className={cn('text-[10px]', PROVIDER_COLOR[log.provider])}>
                          {log.provider}
                        </Badge>
                        {log.tool_calls_used && (
                          <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                            <Wrench className="h-3 w-3 mr-0.5" />tools
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {userLabel(log.user_id)} &middot; {formatTs(log.created_at)}
                        {log.duration_ms != null && <> &middot; {log.duration_ms}ms</>}
                        {log.model && <> &middot; {log.model}</>}
                      </p>
                    </div>
                    {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteOne(log.id)}
                    disabled={deletingId === log.id}
                    aria-label="Delete log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {expanded && (
                  <div className="border-t px-4 py-4 space-y-3 text-sm">
                    {/* Prompt */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">User Prompt</p>
                      <p className="whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-sm">{log.user_prompt || '(empty)'}</p>
                    </div>

                    {/* Prompt sent to model */}
                    {log.prompt_sent != null && log.prompt_sent !== '' && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Prompt sent to model</p>
                        <pre className="whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-xs max-h-64 overflow-y-auto font-sans">
                          {log.prompt_sent}
                        </pre>
                      </div>
                    )}

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">User</p>
                        <p className="text-sm font-mono truncate" title={log.user_id}>{userLabel(log.user_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Provider / Model</p>
                        <p className="text-sm">{log.provider} / {log.model || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Duration</p>
                        <p className="text-sm">{log.duration_ms != null ? `${log.duration_ms}ms` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Cpu className="h-3 w-3" />Tokens</p>
                        <p className="text-sm">
                          {log.input_tokens != null || log.output_tokens != null
                            ? `${log.input_tokens ?? '?'} in / ${log.output_tokens ?? '?'} out`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Context passed */}
                    {log.context_preview != null && log.context_preview !== '' && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Context passed to model</p>
                        <pre className="whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-xs max-h-48 overflow-y-auto font-sans">
                          {log.context_preview}
                        </pre>
                      </div>
                    )}

                    {/* Result from API */}
                    {log.result_summary != null && log.result_summary !== '' && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Result from API</p>
                        <p className="whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-sm">{log.result_summary}</p>
                      </div>
                    )}

                    {/* Decisions (before/after API) */}
                    {log.decisions != null && log.decisions !== '' && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Decisions (before & after API)</p>
                        <pre className="whitespace-pre-wrap bg-muted/40 rounded-lg p-3 text-xs font-sans">
                          {log.decisions}
                        </pre>
                      </div>
                    )}

                    {/* Actions */}
                    {log.actions_requested && log.actions_requested.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Actions Requested</p>
                        <div className="flex flex-wrap gap-1">
                          {log.actions_requested.map((a, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-mono">{a}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {log.error_message && (
                      <div>
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Error</p>
                        <p className="whitespace-pre-wrap bg-red-50 dark:bg-red-950/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                          {log.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

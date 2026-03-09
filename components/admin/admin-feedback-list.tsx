'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bug, Lightbulb, MessageCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseLocalDate } from '@/lib/utils/formatting'

interface FeedbackItem {
  id: string
  user_id: string
  email: string | null
  type: string
  message: string
  page_url: string | null
  status: string
  admin_notes: string | null
  created_at: string
}

const STATUS_OPTIONS = ['new', 'reviewed', 'resolved'] as const

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  feedback: { label: 'Feedback', icon: MessageCircle, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  bug: { label: 'Bug', icon: Bug, color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  feature_request: { label: 'Feature', icon: Lightbulb, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
}

const STATUS_COLOR: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  reviewed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

interface AdminFeedbackListProps {
  initialFeedback: FeedbackItem[]
}

export function AdminFeedbackList({ initialFeedback }: AdminFeedbackListProps) {
  const supabase = createClient()
  const [items, setItems] = useState<FeedbackItem[]>(initialFeedback)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<string>('all')

  const updateStatus = useCallback(async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('feedback')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) {
      toast.error('Failed to update status')
      return
    }
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)))
    toast.success(`Status updated to ${newStatus}`)
  }, [supabase])

  const saveNotes = useCallback(async (id: string) => {
    const notes = editingNotes[id]
    if (notes === undefined) return
    const { error } = await supabase
      .from('feedback')
      .update({ admin_notes: notes || null })
      .eq('id', id)
    if (error) {
      toast.error('Failed to save notes')
      return
    }
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, admin_notes: notes || null } : f)))
    setEditingNotes((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    toast.success('Notes saved')
  }, [supabase, editingNotes])

  const filtered = filter === 'all' ? items : items.filter((f) => f.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Feedback</h1>
          <p className="text-sm text-muted-foreground">{items.length} total submissions</p>
        </div>
        <div className="flex gap-1">
          {['all', ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                filter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {s}
              {s !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({items.filter((f) => f.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
          No feedback items found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.feedback
            const TypeIcon = typeConf.icon
            const expanded = expandedId === item.id
            const notesValue = editingNotes[item.id] ?? item.admin_notes ?? ''

            return (
              <div key={item.id} className="rounded-xl border bg-card overflow-hidden">
                {/* Summary row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
                >
                  <TypeIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate max-w-[300px]">{item.message}</span>
                      <Badge variant="secondary" className={cn('text-[10px]', typeConf.color)}>
                        {typeConf.label}
                      </Badge>
                      <Badge variant="secondary" className={cn('text-[10px]', STATUS_COLOR[item.status])}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.email ?? 'Unknown'} &middot; {parseLocalDate(item.created_at.split('T')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {item.page_url && <> &middot; {item.page_url}</>}
                    </p>
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t px-4 py-4 space-y-4">
                    {/* Full message */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Message</p>
                      <p className="text-sm whitespace-pre-wrap">{item.message}</p>
                    </div>

                    {item.page_url && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        Page: {item.page_url}
                      </div>
                    )}

                    {/* Status changer */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Status</p>
                      <div className="flex gap-1.5">
                        {STATUS_OPTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(item.id, s)}
                            className={cn(
                              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                              item.status === s
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Admin notes */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Admin Notes</p>
                      <textarea
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[60px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Add internal notes..."
                        value={notesValue}
                        onChange={(e) => setEditingNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      {editingNotes[item.id] !== undefined && editingNotes[item.id] !== (item.admin_notes ?? '') && (
                        <div className="flex justify-end mt-1.5">
                          <Button size="sm" onClick={() => saveNotes(item.id)}>
                            Save Notes
                          </Button>
                        </div>
                      )}
                    </div>
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

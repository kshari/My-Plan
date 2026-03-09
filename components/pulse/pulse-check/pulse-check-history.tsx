'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseLocalDate } from '@/lib/utils/formatting'
import { MOOD_EMOJIS, MOOD_LABELS, SCORE_LABELS } from '@/lib/constants/pulse-defaults'
import type { PulseCheck } from '@/lib/demographics'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

interface PulseCheckHistoryProps {
  checks: PulseCheck[]
  userId?: string
  onRefresh?: () => void
}

export function PulseCheckHistory({ checks, userId, onRefresh }: PulseCheckHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const canDelete = !!userId && !!onRefresh

  const handleDeleteOne = useCallback(async () => {
    if (!deleteId || !userId || !onRefresh) return
    setDeleting(true)
    const { error } = await supabase
      .from('fp_pulse_checks')
      .delete()
      .eq('id', deleteId)
      .eq('user_id', userId)
    setDeleteId(null)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete pulse check')
      return
    }
    toast.success('Pulse check deleted')
    onRefresh()
  }, [deleteId, userId, onRefresh, supabase])

  const handleDeleteAll = useCallback(async () => {
    if (!userId || !onRefresh) return
    setDeleting(true)
    const { error } = await supabase
      .from('fp_pulse_checks')
      .delete()
      .eq('user_id', userId)
    setDeleteAllOpen(false)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete pulse checks')
      return
    }
    toast.success('All pulse checks deleted')
    onRefresh()
  }, [userId, onRefresh, supabase])

  if (checks.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No pulse checks yet. Take your first one to start building your financial journal.
      </div>
    )
  }

  const sorted = [...checks].sort(
    (a, b) => parseLocalDate(b.check_date).getTime() - parseLocalDate(a.check_date).getTime()
  )

  return (
    <>
      <div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Financial Journal</h2>
            <p className="text-sm text-muted-foreground">Your pulse check history — track your financial well-being over time.</p>
          </div>
          {canDelete && checks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/50 hover:bg-destructive/10 shrink-0"
              onClick={() => setDeleteAllOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete all
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {sorted.map((check, i) => {
            const prev = sorted[i + 1]
            const nwDelta = prev ? check.net_worth_snapshot - prev.net_worth_snapshot : null
            const scoreDelta = prev ? check.resilience_score - prev.resilience_score : null
            const scoreLabel = SCORE_LABELS.find((l) => check.resilience_score >= l.min && check.resilience_score <= l.max)

            return (
              <div key={check.id ?? i} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{MOOD_EMOJIS[check.mood]}</span>
                    <div>
                      <p className="text-sm font-semibold">
                        {parseLocalDate(check.check_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className={cn('text-xs', scoreLabel?.color)}>
                        Score: {check.resilience_score} — {scoreLabel?.label}
                        {scoreDelta !== null && (
                          <span className={cn('ml-1.5', scoreDelta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                            ({scoreDelta >= 0 ? '+' : ''}{scoreDelta})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold">${check.net_worth_snapshot.toLocaleString()}</p>
                      {nwDelta !== null && (
                        <p className={cn('text-xs font-medium', nwDelta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {nwDelta >= 0 ? '+' : ''}${nwDelta.toLocaleString()}
                        </p>
                      )}
                    </div>
                    {canDelete && check.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        onClick={() => setDeleteId(check.id!)}
                        aria-label="Delete this pulse check"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {check.reflection_answer && (
                  <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground mb-0.5">{check.reflection_question}</p>
                    <p className="text-xs leading-relaxed">{check.reflection_answer}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Confirm delete one */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pulse check?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove this entry from your financial journal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteOne() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete all */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all pulse checks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all {checks.length} entries from your financial journal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAll() }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

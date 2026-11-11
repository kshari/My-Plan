'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_BADGE_STYLES,
} from '@/lib/constants/property-defaults'
import type { DealStage } from '@/lib/types/property-lifecycle'
import { Check, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface DealStageStepperProps {
  propertyId: number
  currentStage: DealStage
  /** Whether to render the full horizontal stepper or the compact badge+button version. */
  compact?: boolean
}

/** Active pipeline stages only — terminal stages shown as selectable targets but not inline. */
const PIPELINE_STAGES: DealStage[] = ['lead','analyzing','offer','contract','closing','rehab','market','operate']

export function DealStageStepper({ propertyId, currentStage, compact = false }: DealStageStepperProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [targetStage, setTargetStage] = useState<DealStage | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = DEAL_STAGES.indexOf(currentStage)

  async function advanceStage(stage: DealStage) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/property/deals/${propertyId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, notes: notes.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? 'Failed to update stage')
        return
      }
      setTargetStage(null)
      setNotes('')
      startTransition(() => { router.refresh() })
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    const nextStageIdx = PIPELINE_STAGES.indexOf(currentStage as DealStage)
    const nextStage = nextStageIdx >= 0 && nextStageIdx < PIPELINE_STAGES.length - 1
      ? PIPELINE_STAGES[nextStageIdx + 1]
      : null

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[currentStage])}>
          {DEAL_STAGE_LABELS[currentStage]}
        </Badge>
        {nextStage && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setTargetStage(nextStage)}
            disabled={isPending}
          >
            <ChevronRight className="h-3 w-3" />
            Move to {DEAL_STAGE_LABELS[nextStage]}
          </Button>
        )}
        <StageDialog
          open={!!targetStage}
          targetStage={targetStage}
          notes={notes}
          loading={loading || isPending}
          error={error}
          onNotes={setNotes}
          onConfirm={() => targetStage && advanceStage(targetStage)}
          onClose={() => { setTargetStage(null); setNotes(''); setError(null) }}
        />
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Horizontal stepper — pipeline stages only */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex items-start min-w-max">
          {PIPELINE_STAGES.map((stage, i) => {
            const stageGlobalIdx = DEAL_STAGES.indexOf(stage)
            const done   = stageGlobalIdx < currentIndex
            const active = stage === currentStage
            const isLast = i === PIPELINE_STAGES.length - 1
            const isClickable = stageGlobalIdx !== currentIndex

            return (
              <div key={stage} className="flex items-start">
                <button
                  className="flex flex-col items-center gap-1 group disabled:cursor-default"
                  disabled={!isClickable || loading || isPending}
                  onClick={() => setTargetStage(stage)}
                  title={isClickable ? `Move to ${DEAL_STAGE_LABELS[stage]}` : undefined}
                >
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all',
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-background border-border text-muted-foreground group-hover:border-blue-400 group-hover:text-blue-500',
                      !isClickable && 'cursor-default'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] text-center w-16 leading-tight',
                      active ? 'text-blue-600 font-semibold' : done ? 'text-emerald-600' : 'text-muted-foreground'
                    )}
                  >
                    {DEAL_STAGE_LABELS[stage]}
                  </span>
                </button>
                {!isLast && (
                  <div
                    className={cn(
                      'mt-3.5 h-0.5 w-8 transition-all',
                      stageGlobalIdx < currentIndex ? 'bg-emerald-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Terminal stage badges */}
      {(currentStage === 'exit' || currentStage === 'dead') && (
        <div className="mt-1">
          <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[currentStage])}>
            {DEAL_STAGE_LABELS[currentStage]}
          </Badge>
        </div>
      )}

      {/* Links to terminal stages */}
      {currentStage !== 'exit' && currentStage !== 'dead' && (
        <div className="flex gap-2 mt-1">
          <button
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            onClick={() => setTargetStage('dead')}
          >
            Mark Dead / Passed
          </button>
          <span className="text-muted-foreground text-xs">·</span>
          <button
            className="text-xs text-muted-foreground hover:text-emerald-600 transition-colors"
            onClick={() => setTargetStage('exit')}
          >
            Mark Exited / Sold
          </button>
        </div>
      )}

      <StageDialog
        open={!!targetStage}
        targetStage={targetStage}
        notes={notes}
        loading={loading || isPending}
        error={error}
        onNotes={setNotes}
        onConfirm={() => targetStage && advanceStage(targetStage)}
        onClose={() => { setTargetStage(null); setNotes(''); setError(null) }}
      />
    </div>
  )
}

function StageDialog({
  open, targetStage, notes, loading, error, onNotes, onConfirm, onClose,
}: {
  open: boolean
  targetStage: DealStage | null
  notes: string
  loading: boolean
  error: string | null
  onNotes: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  if (!targetStage) return null
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to {DEAL_STAGE_LABELS[targetStage]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Optional note about this stage transition..."
            value={notes}
            onChange={(e) => onNotes(e.target.value)}
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

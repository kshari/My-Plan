'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_BADGE_STYLES,
} from '@/lib/constants/property-defaults'
import type { DealStage } from '@/lib/types/property-lifecycle'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, ChevronRight, Loader2, ArrowRight } from 'lucide-react'

interface Deal {
  id: number
  address: string | null
  city: string | null
  type: string | null
  'Asking Price': number | null
  deal_stage: string
  stage_updated_at: string | null
}

interface PipelineStageViewProps {
  deals: Deal[]
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
      }).format(v)
    : null

const VISIBLE_STAGES = DEAL_STAGES.filter((s) => s !== 'dead')
const DEFAULT_OPEN: DealStage[] = ['lead', 'analyzing', 'offer']

export function PipelineStageView({ deals }: PipelineStageViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [openStages, setOpenStages] = useState<Set<DealStage>>(
    new Set(
      VISIBLE_STAGES.filter(
        (s) => DEFAULT_OPEN.includes(s) || deals.some((d) => d.deal_stage === s)
      )
    )
  )
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals)

  const grouped: Record<string, Deal[]> = {}
  for (const s of VISIBLE_STAGES) {
    grouped[s] = localDeals.filter((d) => d.deal_stage === s)
  }

  const allOpen = VISIBLE_STAGES.every((s) => openStages.has(s))

  function toggleAllOpen() {
    setOpenStages(allOpen ? new Set() : new Set(VISIBLE_STAGES))
  }

  function toggleStage(stage: DealStage) {
    setOpenStages((prev) => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleStageDeals(stage: DealStage, e: React.MouseEvent) {
    e.stopPropagation()
    const ids = (grouped[stage] ?? []).map((d) => d.id)
    if (ids.length === 0) return
    const allChecked = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allChecked) ids.forEach((id) => next.delete(id))
      else ids.forEach((id) => next.add(id))
      return next
    })
  }

  async function bulkMoveStage(stage: DealStage) {
    if (selected.size === 0) return
    setMoving(true)
    setMoveError(null)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/property/deals/${id}/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage }),
        })
      )
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) setMoveError(`${failed} deal(s) failed.`)
    setLocalDeals((prev) =>
      prev.map((d) => selected.has(d.id) ? { ...d, deal_stage: stage } : d)
    )
    setSelected(new Set())
    setMoving(false)
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="space-y-3">

      {/* ── Horizontal stage toggle bar ─────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Stages
          </span>
          <button
            onClick={toggleAllOpen}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {allOpen ? 'Hide all' : 'Show all'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {VISIBLE_STAGES.map((stage) => {
            const count = (grouped[stage] ?? []).length
            const isOpen = openStages.has(stage)
            return (
              <button
                key={stage}
                onClick={() => toggleStage(stage)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all',
                  isOpen
                    ? cn(DEAL_STAGE_BADGE_STYLES[stage], 'border-transparent')
                    : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                )}
              >
                {DEAL_STAGE_LABELS[stage]}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                  isOpen ? 'bg-white/30' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Bulk action bar (appears when deals selected) ────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} deal{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {moveError && <span className="text-xs text-destructive">{moveError}</span>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={moving || isPending} className="h-7 gap-1.5 text-xs">
                  {moving
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <ArrowRight className="h-3.5 w-3.5" />}
                  Move to
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {DEAL_STAGES.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => bulkMoveStage(s)} className="text-xs gap-2">
                    <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[s])}>
                      {DEAL_STAGE_LABELS[s]}
                    </Badge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Stage sections ───────────────────────────────────────────── */}
      {VISIBLE_STAGES.filter((s) => openStages.has(s)).map((stage) => {
        const stageDeals = grouped[stage] ?? []
        const stageIds = stageDeals.map((d) => d.id)
        const allStageSelected = stageIds.length > 0 && stageIds.every((id) => selected.has(id))
        const someStageSelected = stageIds.some((id) => selected.has(id)) && !allStageSelected
        const totalValue = stageDeals.reduce((s, d) => s + (d['Asking Price'] ?? 0), 0)

        return (
          <div key={stage} className="rounded-xl border border-border overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b border-border">
              <div onClick={(e) => toggleStageDeals(stage, e)}>
                <Checkbox
                  checked={allStageSelected}
                  data-state={someStageSelected ? 'indeterminate' : allStageSelected ? 'checked' : 'unchecked'}
                  disabled={stageDeals.length === 0}
                  aria-label={`Select all in ${DEAL_STAGE_LABELS[stage]}`}
                />
              </div>
              <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[stage])}>
                {DEAL_STAGE_LABELS[stage]}
              </Badge>
              <span className="text-xs font-semibold text-muted-foreground ml-0.5">
                {stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''}
              </span>
              {totalValue > 0 && (
                <span className="text-xs text-muted-foreground ml-auto">{fmt(totalValue)}</span>
              )}
            </div>

            {/* Deal rows */}
            {stageDeals.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No deals in this stage.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {stageDeals.map((deal) => {
                  const isSelected = selected.has(deal.id)
                  const price = fmt(deal['Asking Price'])
                  return (
                    <li
                      key={deal.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(deal.id)}
                        aria-label={`Select ${deal.address ?? 'deal'}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Link
                        href={`/apps/property/properties/${deal.id}`}
                        className="font-medium hover:underline flex-1 truncate"
                      >
                        {deal.address || 'Untitled'}
                      </Link>
                      <span className="text-xs text-muted-foreground hidden sm:block shrink-0">
                        {[deal.city, deal.type].filter(Boolean).join(' · ') || '—'}
                      </span>
                      {price && (
                        <span className="text-xs font-medium shrink-0">{price}</span>
                      )}
                      <Link
                        href={`/apps/property/properties/${deal.id}`}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Open deal"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}

      {/* No stages open */}
      {openStages.size === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          All stages hidden. Use the controls above to show stages.
        </p>
      )}
    </div>
  )
}

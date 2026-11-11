'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  DEAL_STAGE_BADGE_STYLES,
  ACTIVE_DEAL_STAGES,
} from '@/lib/constants/property-defaults'
import type { DealStage } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, ExternalLink, DollarSign } from 'lucide-react'

interface DealCard {
  id: number
  address: string | null
  city: string | null
  type: string | null
  'Asking Price': number | null
  deal_stage: string
  stage_updated_at: string | null
}

interface DealPipelineBoardProps {
  initialDeals: DealCard[]
  showTerminal?: boolean
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
    : null

export function DealPipelineBoard({ initialDeals, showTerminal = false }: DealPipelineBoardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deals, setDeals] = useState<DealCard[]>(initialDeals)
  const [moving, setMoving] = useState<number | null>(null)

  const visibleStages = showTerminal ? DEAL_STAGES : ACTIVE_DEAL_STAGES

  async function moveStage(dealId: number, stage: DealStage) {
    setMoving(dealId)
    try {
      const res = await fetch(`/api/property/deals/${dealId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      if (res.ok) {
        setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, deal_stage: stage } : d))
        startTransition(() => { router.refresh() })
      }
    } finally {
      setMoving(null)
    }
  }

  const grouped: Record<string, DealCard[]> = {}
  for (const stage of visibleStages) {
    grouped[stage] = deals.filter((d) => d.deal_stage === stage)
  }

  function colValue(stage: string): number {
    return (grouped[stage] ?? []).reduce((s: number, d: DealCard) => s + (d['Asking Price'] ?? 0), 0)
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {visibleStages.map((stage) => {
          const cards = grouped[stage] ?? []
          const total = colValue(stage)
          return (
            <div key={stage} className="w-64 shrink-0 flex flex-col gap-2">
              {/* Column header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[stage as DealStage])}>
                    {DEAL_STAGE_LABELS[stage as DealStage]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{cards.length}</span>
                </div>
                {total > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <DollarSign className="h-3 w-3" />
                    {(total / 1_000_000).toFixed(1)}M
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[120px]">
                {cards.map((deal) => (
                  <DealKanbanCard
                    key={deal.id}
                    deal={deal}
                    currentStage={deal.deal_stage as DealStage}
                    isMoving={moving === deal.id || isPending}
                    onMove={(s) => moveStage(deal.id, s)}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/50 h-20 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">—</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DealKanbanCard({
  deal, currentStage, isMoving, onMove,
}: {
  deal: DealCard
  currentStage: DealStage
  isMoving: boolean
  onMove: (s: DealStage) => void
}) {
  const price = fmt(deal['Asking Price'])

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-3 space-y-2 transition-opacity',
        isMoving && 'opacity-50'
      )}
    >
      {/* Address */}
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/apps/property/properties/${deal.id}`}
          className="text-sm font-medium leading-tight hover:underline flex-1"
        >
          {deal.address || 'Untitled'}
        </Link>
        <Link href={`/apps/property/properties/${deal.id}`} className="shrink-0">
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </Link>
      </div>

      {/* City + type */}
      {(deal.city || deal.type) && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
          {deal.city && <span>{deal.city}</span>}
          {deal.type && <span className="text-muted-foreground/60">· {deal.type}</span>}
        </div>
      )}

      {/* Price */}
      {price && (
        <div className="text-xs font-semibold">{price}</div>
      )}

      {/* Stage mover */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-full justify-between text-xs px-2" disabled={isMoving}>
            Move stage
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {DEAL_STAGES.filter((s) => s !== currentStage).map((s) => (
            <DropdownMenuItem key={s} onClick={() => onMove(s)} className="text-xs">
              <Badge className={cn('text-xs mr-2', DEAL_STAGE_BADGE_STYLES[s])}>
                {DEAL_STAGE_LABELS[s]}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

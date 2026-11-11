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
import { ChevronDown, Loader2 } from 'lucide-react'

interface Deal {
  id: number
  address: string | null
  city: string | null
  type: string | null
  'Asking Price': number | null
  deal_stage: string
  stage_updated_at: string | null
}

interface PipelineListViewProps {
  deals: Deal[]
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
    : '—'

export function PipelineListView({ deals: initialDeals }: PipelineListViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const allSelected = deals.length > 0 && selected.size === deals.length
  const someSelected = selected.size > 0 && !allSelected

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(deals.map((d) => d.id)))
    }
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
    if (failed > 0) setMoveError(`${failed} deal(s) failed to update.`)

    // Optimistically update local state
    setDeals((prev) =>
      prev.map((d) => selected.has(d.id) ? { ...d, deal_stage: stage } : d)
    )
    setSelected(new Set())
    setMoving(false)
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar — only visible when rows are selected */}
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-all',
          selected.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <span className="text-sm font-medium">
          {selected.size} deal{selected.size !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {moveError && (
            <span className="text-xs text-destructive">{moveError}</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={moving || isPending}
                className="gap-1.5"
              >
                {moving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Move to stage
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {DEAL_STAGES.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onSelect={() => bulkMoveStage(stage)}
                  className="text-xs gap-2"
                >
                  <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[stage])}>
                    {DEAL_STAGE_LABELS[stage]}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected}
                  // indeterminate state via data attr
                  data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                  className={cn(someSelected && 'opacity-70')}
                />
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">City</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Stage</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Price</th>
              <th className="w-8 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deals.map((deal) => {
              const isSelected = selected.has(deal.id)
              return (
                <tr
                  key={deal.id}
                  className={cn(
                    'transition-colors',
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(deal.id)}
                      aria-label={`Select ${deal.address ?? 'deal'}`}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/apps/property/properties/${deal.id}`}
                      className="font-medium hover:underline"
                    >
                      {deal.address || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{deal.city ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{deal.type ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      className={cn(
                        'text-xs',
                        DEAL_STAGE_BADGE_STYLES[deal.deal_stage as DealStage] ?? 'bg-muted text-muted-foreground'
                      )}
                    >
                      {DEAL_STAGE_LABELS[deal.deal_stage as DealStage] ?? deal.deal_stage}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {fmt(deal['Asking Price'])}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={`/apps/property/properties/${deal.id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {deals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No deals yet.{' '}
                  <Link href="/apps/property/dashboard" className="underline">
                    Add your first property
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {deals.length > 0 && (
        <p className="text-xs text-muted-foreground text-right px-1">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} total
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>
      )}
    </div>
  )
}

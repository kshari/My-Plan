'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PipelineStageView } from '@/components/property/pipeline-stage-view'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Deal {
  id: number
  address: string | null
  city: string | null
  type: string | null
  'Asking Price': number | null
  deal_stage: string
  stage_updated_at: string | null
}

interface PipelineClientProps {
  allDeals: Deal[]
  initialView: 'board' | 'list'
}

export function PipelineClient({ allDeals }: PipelineClientProps) {
  const [showDead, setShowDead] = useState(false)

  const liveDeals = allDeals.filter((d) => d.deal_stage !== 'dead')
  const deadDeals = allDeals.filter((d) => d.deal_stage === 'dead')
  const visibleDeals = showDead ? allDeals : liveDeals

  const activeCount = liveDeals.filter((d) => d.deal_stage !== 'exit').length
  const exitedCount = liveDeals.filter((d) => d.deal_stage === 'exit').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Deal Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount} active
            {exitedCount > 0 && ` · ${exitedCount} exited`}
            {deadDeals.length > 0 && (
              <span className={cn('ml-1', showDead ? 'text-foreground' : '')}>
                · {deadDeals.length} dead {showDead ? '(showing)' : '(hidden)'}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deadDeals.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDead((v) => !v)}
              className={cn(
                'gap-1.5 text-xs',
                showDead
                  ? 'border-red-400/60 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400'
                  : 'text-muted-foreground'
              )}
            >
              {showDead
                ? <><EyeOff className="h-3.5 w-3.5" /> Hide dead</>
                : <><Eye className="h-3.5 w-3.5" /> Show {deadDeals.length} dead</>}
            </Button>
          )}
          <Link href="/apps/property/properties/new">
            <Button variant="outline" size="sm">Add Deal</Button>
          </Link>
        </div>
      </div>

      {/* Stage-grouped list — remount when dead visibility changes so open-stage state resets cleanly */}
      <PipelineStageView key={showDead ? 'with-dead' : 'live'} deals={visibleDeals} />

      {/* Dead deals callout when hidden */}
      {!showDead && deadDeals.length > 0 && (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">
              {deadDeals.length} dead / passed deal{deadDeals.length !== 1 ? 's' : ''}
            </span>{' '}
            not shown.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 shrink-0"
            onClick={() => setShowDead(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Show for reference
          </Button>
        </div>
      )}
    </div>
  )
}

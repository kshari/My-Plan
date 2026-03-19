'use client'

import Link from 'next/link'
import { Building2, User, Calendar, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { SharedProperty } from '@/lib/types/teams'

interface SharedPropertyListProps {
  teamId: string
  properties: SharedProperty[]
  memberEmailMap: Record<string, string>
  canShare?: boolean
  onShareProperties?: () => void
}

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Sold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Leased: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function fmt$(v: number | null | undefined) {
  if (!v) return '—'
  return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function capRate(prop: SharedProperty) {
  const price = prop['Asking Price'] ?? 0
  const gross = prop['Gross Income'] ?? 0
  const exp = prop['Operating Expenses'] ?? 0
  if (!price) return null
  return (((gross - exp) * 12) / price * 100).toFixed(1)
}

export default function SharedPropertyList({
  teamId, properties, memberEmailMap, canShare, onShareProperties,
}: SharedPropertyListProps) {
  if (!properties.length) {
    return (
      <EmptyState
        icon={Building2}
        message="No shared properties yet"
        description="Share properties from your personal list to collaborate with team members."
        action={canShare ? (
          <Button onClick={onShareProperties}>
            <Copy className="h-4 w-4 mr-2" />
            Share Properties
          </Button>
        ) : undefined}
      />
    )
  }

  return (
    <div className="space-y-2">
      {properties.map(prop => {
        const cr = capRate(prop)
        const sharedByEmail = memberEmailMap[prop.shared_by] ?? `…${prop.shared_by.slice(-6)}`
        const updatedByEmail = prop.last_updated_by
          ? (memberEmailMap[prop.last_updated_by] ?? `…${prop.last_updated_by.slice(-6)}`)
          : null

        return (
          <Link
            key={prop.id}
            href={`/apps/property/teams/${teamId}/properties/${prop.id}`}
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 hover:bg-muted/50 transition-colors group"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{prop.address ?? 'Unnamed Property'}</p>
                {prop.listing_status && (
                  <Badge className={cn('text-xs px-1.5 py-0', STATUS_COLORS[prop.listing_status] ?? 'bg-gray-100 text-gray-600')}>
                    {prop.listing_status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {[prop.city, prop.county, prop.type].filter(Boolean).join(' · ')}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{fmt$(prop['Asking Price'])}</span>
                </span>
                {cr && (
                  <span className="text-xs text-muted-foreground">
                    Cap Rate: <span className="font-medium text-foreground">{cr}%</span>
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Shared by {sharedByEmail}
                </span>
                {updatedByEmail && updatedByEmail !== sharedByEmail && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Updated by {updatedByEmail}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

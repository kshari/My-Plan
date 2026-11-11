'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  DEAL_STAGE_LABELS,
  DEAL_STAGE_BADGE_STYLES,
  DEAL_STAGE_DESCRIPTIONS,
  CONTACT_TYPE_LABELS,
} from '@/lib/constants/property-defaults'
import type { DealStage, DealContact } from '@/lib/types/property-lifecycle'
import { Badge } from '@/components/ui/badge'
import { Building2, DollarSign, Users, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  type: string | null
  'Number of Units'?: number | null
  'Asking Price': number | null
  listing_status?: string | null
  deal_stage?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  notes?: string | null
  source?: string | null
  created_at: string
}

interface OverviewTabProps {
  property: Property
  currentStage: DealStage
}

export function OverviewTab({ property, currentStage }: OverviewTabProps) {
  const supabase = createClient()
  const [dealContacts, setDealContacts] = useState<DealContact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('pi_deal_contacts')
        .select('*, contact:pi_contacts(*)')
        .eq('property_id', property.id)
        .order('created_at', { ascending: true })
      setDealContacts((data as DealContact[]) ?? [])
      setLoading(false)
    }
    load()
  }, [property.id])

  const fmt = (v: number | null | undefined) =>
    v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v) : '—'

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Property details */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Property Details</h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Dt>Type</Dt>        <Dd>{property.type ?? '—'}</Dd>
          <Dt>Units</Dt>       <Dd>{property['Number of Units'] ?? '—'}</Dd>
          <Dt>Bedrooms</Dt>    <Dd>{property.bedrooms ?? '—'}</Dd>
          <Dt>Bathrooms</Dt>   <Dd>{property.bathrooms ?? '—'}</Dd>
          <Dt>Sq Ft</Dt>       <Dd>{property.sqft ? property.sqft.toLocaleString() : '—'}</Dd>
          <Dt>Community</Dt>   <Dd>{property.community ?? '—'}</Dd>
        </dl>
      </div>

      {/* Financials snapshot */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Financials</h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Dt>Asking Price</Dt> <Dd>{fmt(property['Asking Price'])}</Dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          Full underwriting in the{' '}
          <span className="text-foreground font-medium">Underwriting</span> tab.
        </p>
      </div>

      {/* Current stage info */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Badge className={cn('text-xs', DEAL_STAGE_BADGE_STYLES[currentStage])}>
            {DEAL_STAGE_LABELS[currentStage]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{DEAL_STAGE_DESCRIPTIONS[currentStage]}</p>
      </div>

      {/* Team / contacts */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Deal Team</h3>
          </div>
          <Link
            href={`/apps/property/contacts`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage contacts →
          </Link>
        </div>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : dealContacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
        ) : (
          <ul className="space-y-2">
            {dealContacts.map((dc) => (
              <li key={dc.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{dc.contact?.name ?? '—'}</span>
                {dc.contact && (
                  <Badge variant="outline" className="text-xs">
                    {CONTACT_TYPE_LABELS[dc.contact.contact_type]}
                  </Badge>
                )}
                {dc.role && <span className="text-muted-foreground text-xs">· {dc.role}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Notes */}
      {property.notes && (
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Notes</h3>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.notes}</p>
        </div>
      )}
    </div>
  )
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-muted-foreground">{children}</dt>
}
function Dd({ children }: { children: React.ReactNode }) {
  return <dd className="font-medium">{children}</dd>
}

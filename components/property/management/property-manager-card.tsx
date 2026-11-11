'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ContactPicker } from '@/components/property/contacts/contact-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Pencil, Check, X, Loader2, UserRound } from 'lucide-react'
import type { Contact } from '@/lib/types/property-lifecycle'

interface PropertyManagerCardProps {
  propertyId: number
  /** Pre-loaded from server to avoid an extra round-trip. */
  initialPmContact?: Contact | null
  initialFeeType?: 'fixed' | 'percent' | null
  initialFeeAmount?: number | null
}

const fmt = (v: number, type: 'fixed' | 'percent') =>
  type === 'percent' ? `${v}%` : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(v)

export function PropertyManagerCard({
  propertyId,
  initialPmContact,
  initialFeeType,
  initialFeeAmount,
}: PropertyManagerCardProps) {
  const supabase = createClient()

  const [pmContact, setPmContact] = useState<Contact | null>(initialPmContact ?? null)
  const [feeType, setFeeType] = useState<'fixed' | 'percent'>(initialFeeType ?? 'percent')
  const [feeAmount, setFeeAmount] = useState<string>(initialFeeAmount?.toString() ?? '')

  const [editing, setEditing] = useState(!initialPmContact)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Contact picker state
  const [pmId, setPmId] = useState<string | null>(initialPmContact?.id ?? null)
  const [pmName, setPmName] = useState(initialPmContact?.name ?? '')

  async function save() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('pi_properties')
      .update({
        pm_contact_id: pmId ?? null,
        pm_fee_type: feeAmount ? feeType : null,
        pm_fee_amount: feeAmount ? parseFloat(feeAmount) : null,
      })
      .eq('id', propertyId)

    if (err) { setError(err.message); setSaving(false); return }

    // Refresh contact display
    if (pmId) {
      const { data } = await supabase.from('pi_contacts').select('*').eq('id', pmId).single()
      if (data) setPmContact(data as Contact)
    } else {
      setPmContact(null)
    }

    setSaving(false)
    setEditing(false)
  }

  function cancel() {
    setPmId(initialPmContact?.id ?? null)
    setPmName(initialPmContact?.name ?? '')
    setFeeType(initialFeeType ?? 'percent')
    setFeeAmount(initialFeeAmount?.toString() ?? '')
    setEditing(false)
    setError(null)
  }

  const hasFee = feeAmount && parseFloat(feeAmount) > 0

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-blue-500" />
          <h3 className="font-semibold text-sm">Property Manager</h3>
        </div>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-xs text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {pmContact ? 'Edit' : 'Set up'}
          </Button>
        )}
      </div>

      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-3">
            {/* PM contact picker */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Property Manager
              </label>
              <ContactPicker
                filterType="property_manager"
                defaultNewType="property_manager"
                selectedId={pmId}
                selectedName={pmName}
                onSelect={(id, name) => { setPmId(id); setPmName(name) }}
                placeholder="Select or add property manager…"
                className="w-full"
              />
            </div>

            {/* Fee */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Management Fee
              </label>
              <div className="flex gap-2 items-center">
                <Select
                  value={feeType}
                  onValueChange={(v) => setFeeType(v as 'fixed' | 'percent')}
                >
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% of rent</SelectItem>
                    <SelectItem value="fixed">Fixed $/mo</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  {feeType === 'percent' && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  )}
                  {feeType === 'fixed' && (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  )}
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder={feeType === 'percent' ? '8' : '200'}
                    className={`h-8 text-sm ${feeType === 'fixed' ? 'pl-6' : 'pr-6'}`}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave blank if fee is not yet set.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : pmContact ? (
          /* Read-only view */
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm">{pmContact.name}</span>
                {pmContact.company && (
                  <span className="text-xs text-muted-foreground">· {pmContact.company}</span>
                )}
              </div>
              {pmContact.email && (
                <p className="text-xs text-muted-foreground pl-6">{pmContact.email}</p>
              )}
              {pmContact.phone && (
                <p className="text-xs text-muted-foreground pl-6">{pmContact.phone}</p>
              )}
            </div>
            {hasFee && (
              <Badge variant="outline" className="text-xs shrink-0">
                {fmt(parseFloat(feeAmount), feeType)} fee
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No property manager set.{' '}
            <button
              className="text-primary hover:underline text-sm"
              onClick={() => setEditing(true)}
            >
              Add one
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

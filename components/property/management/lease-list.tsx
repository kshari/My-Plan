'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LEASE_STATUSES } from '@/lib/constants/property-defaults'
import type { Lease, LeaseStatus } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Loader2, Home, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { ContactPicker } from '@/components/property/contacts/contact-picker'
import { RentRoll } from '@/components/property/management/rent-roll'
import { format } from 'date-fns'

const STATUS_STYLES: Record<LeaseStatus, string> = {
  upcoming:   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  active:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  expired:    'bg-muted text-muted-foreground',
  terminated: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

interface LeaseListProps {
  propertyId: number
}

export function LeaseList({ propertyId }: LeaseListProps) {
  const supabase = createClient()
  const [leases, setLeases] = useState<Lease[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [unitLabel, setUnitLabel] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [deposit, setDeposit] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<LeaseStatus>('upcoming')
  const [notes, setNotes] = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pi_leases')
      .select('*, tenant:pi_contacts(*)')
      .eq('property_id', propertyId)
      .order('start_date', { ascending: false })
    setLeases((data as Lease[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  async function addLease() {
    if (!startDate || !monthlyRent) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); return }
    const row = {
      property_id: propertyId,
      user_id: authData.user.id,
      unit_label: unitLabel || null,
      tenant_contact_id: tenantId,
      monthly_rent: parseFloat(monthlyRent),
      deposit: deposit ? parseFloat(deposit) : null,
      start_date: startDate,
      end_date: endDate || null,
      status,
      notes: notes || null,
    }
    const { data: inserted } = await supabase
      .from('pi_leases')
      .insert([row])
      .select('*, tenant:pi_contacts(*)')
      .single()
    if (inserted) setLeases((prev) => [inserted as Lease, ...prev])
    setUnitLabel(''); setTenantId(null); setTenantName(''); setMonthlyRent('')
    setDeposit(''); setStartDate(''); setEndDate(''); setStatus('upcoming'); setNotes('')
    setAddOpen(false)
    setSaving(false)
  }

  async function deleteLease(id: string) {
    if (!confirm('Delete this lease and all payment records?')) return
    setLeases((prev) => prev.filter((l) => l.id !== id))
    await supabase.from('pi_leases').delete().eq('id', id)
  }

  const totalMonthly = leases.filter((l) => l.status === 'active').reduce((s, l) => s + l.monthly_rent, 0)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-emerald-500" />
          <h3 className="font-semibold text-sm">Leases</h3>
          {totalMonthly > 0 && (
            <span className="text-xs text-muted-foreground">· {fmt(totalMonthly)}/mo active</span>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3" /> Add lease
        </Button>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : leases.length === 0 && !addOpen ? (
        <p className="text-sm text-muted-foreground p-4">No leases yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {leases.map((lease) => (
            <li key={lease.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  className="flex items-start gap-2 text-left flex-1"
                  onClick={() => setExpandedId(expandedId === lease.id ? null : lease.id)}
                >
                  {expandedId === lease.id
                    ? <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  }
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {lease.unit_label ? `Unit ${lease.unit_label}` : 'Unit'}
                      </span>
                      {lease.tenant && (
                        <span className="text-sm text-muted-foreground">· {lease.tenant.name}</span>
                      )}
                      <Badge className={cn('text-xs', STATUS_STYLES[lease.status])}>
                        {lease.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmt(lease.monthly_rent)}/mo
                      {' · '}
                      {format(new Date(lease.start_date), 'MMM d, yyyy')}
                      {lease.end_date && ` → ${format(new Date(lease.end_date), 'MMM d, yyyy')}`}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => deleteLease(lease.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-0.5 mt-0.5 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {expandedId === lease.id && (
                <div className="mt-3 pl-6">
                  <RentRoll leaseId={lease.id} monthlyRent={lease.monthly_rent} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add form */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lease</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Unit label</label>
                <Input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} className="h-8 text-sm" placeholder="e.g. 1A" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as LeaseStatus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tenant</label>
              <ContactPicker
                filterType="tenant"
                defaultNewType="tenant"
                selectedId={tenantId}
                selectedName={tenantName}
                onSelect={(id, name) => { setTenantId(id); setTenantName(name) }}
                placeholder="Select tenant..."
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Monthly rent $</label>
                <Input type="number" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Deposit $</label>
                <Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start date *</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addLease} disabled={saving || !startDate || !monthlyRent}>
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Add Lease
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

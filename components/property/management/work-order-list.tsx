'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { WORK_ORDER_STATUSES } from '@/lib/constants/property-defaults'
import type { WorkOrder, WorkOrderStatus } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Loader2, Wrench, Trash2 } from 'lucide-react'
import { ContactPicker } from '@/components/property/contacts/contact-picker'
import { format } from 'date-fns'

const STATUS_STYLES: Record<WorkOrderStatus, string> = {
  open:        'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  closed:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
    : '—'

interface WorkOrderListProps {
  propertyId: number
}

export function WorkOrderList({ propertyId }: WorkOrderListProps) {
  const supabase = createClient()
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contractorId, setContractorId] = useState<string | null>(null)
  const [contractorName, setContractorName] = useState('')
  const [cost, setCost] = useState('')
  const [status, setStatus] = useState<WorkOrderStatus>('open')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pi_work_orders')
      .select('*, contractor:pi_contacts(*)')
      .eq('property_id', propertyId)
      .order('opened_at', { ascending: false })
    setOrders((data as WorkOrder[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  async function addOrder() {
    if (!title.trim()) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); return }
    const row = {
      property_id: propertyId,
      user_id: authData.user.id,
      title: title.trim(),
      description: description || null,
      contractor_contact_id: contractorId,
      cost: cost ? parseFloat(cost) : null,
      status,
    }
    const { data: inserted } = await supabase
      .from('pi_work_orders')
      .insert([row])
      .select('*, contractor:pi_contacts(*)')
      .single()
    if (inserted) setOrders((prev) => [inserted as WorkOrder, ...prev])
    setTitle(''); setDescription(''); setContractorId(null); setContractorName(''); setCost(''); setStatus('open'); setAddOpen(false)
    setSaving(false)
  }

  async function updateStatus(id: string, s: WorkOrderStatus) {
    const update: { status: WorkOrderStatus; closed_at?: string | null } = { status: s }
    if (s === 'closed') update.closed_at = new Date().toISOString()
    if (s !== 'closed') update.closed_at = null
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, ...update } : o))
    await supabase.from('pi_work_orders').update(update).eq('id', id)
  }

  async function deleteOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    await supabase.from('pi_work_orders').delete().eq('id', id)
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Work Orders</h3>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3" /> Add work order
        </Button>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4">No work orders yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{order.title}</span>
                  <Select value={order.status} onValueChange={(v) => updateStatus(order.id, v as WorkOrderStatus)}>
                    <SelectTrigger className="h-6 w-28 text-xs p-1">
                      <SelectValue>
                        <Badge className={cn('text-xs', STATUS_STYLES[order.status])}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <Badge className={cn('text-xs', STATUS_STYLES[s])}>{s.replace('_', ' ')}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  {order.contractor && <span>{order.contractor.name}</span>}
                  {order.cost != null && <span>{fmt(order.cost)}</span>}
                  <span>{format(new Date(order.opened_at), 'MMM d, yyyy')}</span>
                  {order.closed_at && <span>· closed {format(new Date(order.closed_at), 'MMM d')}</span>}
                </div>
                {order.description && (
                  <p className="text-xs text-muted-foreground mt-1">{order.description}</p>
                )}
              </div>
              <button
                onClick={() => deleteOrder(order.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5 mt-0.5 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" placeholder="e.g. Fix leaking faucet" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as WorkOrderStatus)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cost $</label>
                <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contractor</label>
              <ContactPicker
                filterType="contractor"
                defaultNewType="contractor"
                selectedId={contractorId}
                selectedName={contractorName}
                onSelect={(id, name) => { setContractorId(id); setContractorName(name) }}
                placeholder="Select contractor..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addOrder} disabled={saving || !title.trim()}>
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

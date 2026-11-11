'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { RENT_PAYMENT_STATUSES } from '@/lib/constants/property-defaults'
import type { RentPayment, RentPaymentStatus } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_STYLES: Record<RentPaymentStatus, string> = {
  due:    'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  paid:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  late:   'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  waived: 'bg-muted text-muted-foreground',
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

interface RentRollProps {
  leaseId: string
  monthlyRent: number
}

export function RentRoll({ leaseId, monthlyRent }: RentRollProps) {
  const supabase = createClient()
  const [payments, setPayments] = useState<RentPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [dueDate, setDueDate] = useState('')
  const [amount, setAmount] = useState(String(monthlyRent))
  const [paidDate, setPaidDate] = useState('')
  const [status, setStatus] = useState<RentPaymentStatus>('due')

  useEffect(() => {
    load()
  }, [leaseId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pi_rent_payments')
      .select('*')
      .eq('lease_id', leaseId)
      .order('due_date', { ascending: false })
    setPayments((data as RentPayment[]) ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, s: RentPaymentStatus) {
    setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: s } : p))
    await supabase.from('pi_rent_payments').update({ status: s }).eq('id', id)
  }

  async function addPayment() {
    if (!dueDate || !amount) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); return }
    const row = {
      lease_id: leaseId,
      user_id: authData.user.id,
      due_date: dueDate,
      amount: parseFloat(amount),
      paid_date: paidDate || null,
      status,
    }
    const { data: inserted } = await supabase.from('pi_rent_payments').insert([row]).select().single()
    if (inserted) setPayments((prev) => [inserted as RentPayment, ...prev])
    setDueDate(''); setAmount(String(monthlyRent)); setPaidDate(''); setStatus('due'); setAddOpen(false)
    setSaving(false)
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rent Roll</h4>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" onClick={() => setAddOpen(!addOpen)}>
          <Plus className="h-3 w-3" /> Add payment
        </Button>
      </div>

      {addOpen && (
        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-7 text-xs w-36" placeholder="Due date" />
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-7 text-xs w-24" placeholder="Amount" />
            <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="h-7 text-xs w-36" placeholder="Paid date" />
            <Select value={status} onValueChange={(v) => setStatus(v as RentPaymentStatus)}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RENT_PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addPayment} disabled={saving || !dueDate}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No payments recorded.</p>
      ) : (
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-20 shrink-0">
                {format(new Date(p.due_date), 'MMM yyyy')}
              </span>
              <span className="font-medium w-16">{fmt(p.amount)}</span>
              <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as RentPaymentStatus)}>
                <SelectTrigger className="h-6 w-20 text-[10px] p-1">
                  <SelectValue>
                    <Badge className={cn('text-[10px] px-1 py-0', STATUS_STYLES[p.status])}>
                      {p.status}
                    </Badge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RENT_PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <Badge className={cn('text-[10px] px-1 py-0', STATUS_STYLES[s])}>{s}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {p.paid_date && (
                <span className="text-muted-foreground">paid {format(new Date(p.paid_date), 'MMM d')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

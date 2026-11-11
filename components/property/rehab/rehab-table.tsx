'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  REHAB_CATEGORIES,
  REHAB_STATUSES,
} from '@/lib/constants/property-defaults'
import type { RehabItem, Contact } from '@/lib/types/property-lifecycle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Trash2, Loader2, Hammer } from 'lucide-react'
import { ContactPicker } from '@/components/property/contacts/contact-picker'

const STATUS_STYLES: Record<string, string> = {
  planned:     'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  done:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
}

const fmt = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
    : '—'

interface RehabTableProps {
  propertyId: number
}

export function RehabTable({ propertyId }: RehabTableProps) {
  const supabase = createClient()
  const [items, setItems] = useState<RehabItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [category, setCategory] = useState(REHAB_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [contractorId, setContractorId] = useState<string | null>(null)
  const [contractorName, setContractorName] = useState('')
  const [status, setStatus] = useState<'planned' | 'in_progress' | 'done'>('planned')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('pi_rehab_items')
      .select('*, contractor:pi_contacts(*)')
      .eq('property_id', propertyId)
      .order('sort_order', { ascending: true })
    setItems((data as RehabItem[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [propertyId])

  async function addItem() {
    if (!description.trim()) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    if (!authData?.user) { setSaving(false); return }
    const row = {
      property_id: propertyId,
      user_id: authData.user.id,
      category,
      description: description.trim(),
      budget_amount: parseFloat(budget) || 0,
      contractor_contact_id: contractorId ?? null,
      status,
      sort_order: items.length,
    }
    const { data: inserted } = await supabase.from('pi_rehab_items').insert([row]).select('*, contractor:pi_contacts(*)').single()
    if (inserted) setItems((prev) => [...prev, inserted as RehabItem])
    setDescription(''); setBudget(''); setContractorId(null); setContractorName(''); setCategory(REHAB_CATEGORIES[0]); setStatus('planned'); setAddOpen(false)
    setSaving(false)
  }

  async function updateActual(id: string, actual: string) {
    const val = parseFloat(actual) || null
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, actual_amount: val } : i))
    await supabase.from('pi_rehab_items').update({ actual_amount: val }).eq('id', id)
  }

  async function updateStatus(id: string, s: 'planned' | 'in_progress' | 'done') {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: s } : i))
    await supabase.from('pi_rehab_items').update({ status: s }).eq('id', id)
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await supabase.from('pi_rehab_items').delete().eq('id', id)
  }

  const totalBudget = items.reduce((s, i) => s + (i.budget_amount ?? 0), 0)
  const totalActual = items.reduce((s, i) => s + (i.actual_amount ?? 0), 0)

  return (
    <div className="rounded-xl border border-border bg-card space-y-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-yellow-500" />
          <h3 className="font-semibold text-sm">Renovation Budget</h3>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3" /> Add item
        </Button>
      </div>

      {loading ? (
        <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Table */}
          {items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                    <TableCell className="text-sm">{item.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.contractor?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {fmt(item.budget_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={item.actual_amount ?? ''}
                        onChange={(e) => updateActual(item.id, e.target.value)}
                        className={cn(
                          'h-7 w-24 text-right text-xs ml-auto',
                          item.actual_amount != null && item.actual_amount > item.budget_amount
                            ? 'text-destructive'
                            : ''
                        )}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.status}
                        onValueChange={(v) => updateStatus(item.id, v as typeof item.status)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue>
                            <Badge className={cn('text-xs', STATUS_STYLES[item.status])}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {REHAB_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              <Badge className={cn('text-xs', STATUS_STYLES[s])}>
                                {s.replace('_', ' ')}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {items.length === 0 && !addOpen && (
            <p className="text-sm text-muted-foreground p-4">No rehab items yet.</p>
          )}

          {/* Add form */}
          {addOpen && (
            <div className="p-4 border-t border-border space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REHAB_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REHAB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Budget $"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="h-8 text-sm w-32"
                />
                <ContactPicker
                  propertyId={propertyId}
                  filterType="contractor"
                  defaultNewType="contractor"
                  selectedId={contractorId}
                  selectedName={contractorName}
                  onSelect={(id, name) => { setContractorId(id); setContractorName(name) }}
                  placeholder="Contractor (optional)"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addItem} disabled={saving || !description.trim()}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <div className="border-t border-border bg-muted/30 px-4 py-2 flex justify-end gap-6 text-sm">
              <span className="text-muted-foreground">Budget: <strong>{fmt(totalBudget)}</strong></span>
              <span className={cn(totalActual > totalBudget ? 'text-destructive' : 'text-muted-foreground')}>
                Actual: <strong>{fmt(totalActual)}</strong>
              </span>
              {totalBudget > 0 && (
                <span className="text-muted-foreground">
                  Variance: <strong className={totalActual > totalBudget ? 'text-destructive' : 'text-emerald-600'}>
                    {fmt(totalActual - totalBudget)}
                  </strong>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

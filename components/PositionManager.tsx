'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTickerInfo } from '@/lib/utils/market-data'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface Position {
  id: string
  quantity: number
  cost_basis: number
  purchase_date: string
  position_type: 'stock' | 'option'
  tickers?: { symbol: string; name?: string }
  options_positions?: Array<{
    strike_price: number
    expiration_date: string
    option_type: string
    premium: number
    contracts: number
  }>
}

interface PositionManagerProps {
  portfolioId: string
  positions: Position[]
  onUpdate: () => void
}

const columns = (onDelete: (id: string) => void): ColumnDef<Position>[] => [
  {
    accessorFn: (row) => row.tickers?.symbol ?? '',
    id: 'symbol',
    header: 'Symbol',
    cell: ({ row }) => (
      <span className="font-mono font-semibold text-sm">
        {row.original.tickers?.symbol ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'position_type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge
        variant={row.original.position_type === 'option' ? 'secondary' : 'default'}
        className="capitalize"
      >
        {row.original.position_type}
      </Badge>
    ),
  },
  {
    accessorKey: 'quantity',
    header: 'Quantity',
    cell: ({ row }) => (
      <span className="tabular-nums">{parseFloat(String(row.original.quantity)).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'cost_basis',
    header: 'Cost Basis',
    cell: ({ row }) => (
      <span className="tabular-nums">
        ${parseFloat(String(row.original.cost_basis)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </span>
    ),
  },
  {
    accessorKey: 'purchase_date',
    header: 'Purchase Date',
    cell: ({ row }) => new Date(row.original.purchase_date).toLocaleDateString(),
  },
  {
    id: 'options_details',
    header: 'Options Details',
    enableSorting: false,
    cell: ({ row }) => {
      const op = row.original.options_positions?.[0]
      if (!op) return <span className="text-muted-foreground">—</span>
      return (
        <div className="text-xs space-y-0.5">
          <div className="font-medium uppercase">{op.option_type} ${op.strike_price}</div>
          <div className="text-muted-foreground">Exp {new Date(op.expiration_date).toLocaleDateString()}</div>
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: '',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete position?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the{' '}
              <strong>{row.original.tickers?.symbol}</strong> position. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(row.original.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  },
]

const defaultForm = {
  symbol: '',
  quantity: '',
  costBasis: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  positionType: 'stock' as 'stock' | 'option',
  strikePrice: '',
  expirationDate: '',
  optionType: 'call' as 'call' | 'put',
  premium: '',
  contracts: '1',
}

export default function PositionManager({ portfolioId, positions, onUpdate }: PositionManagerProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let tickerData: any
      const { data: existingTicker } = await supabase
        .from('pa_tickers')
        .select('*')
        .eq('symbol', formData.symbol.toUpperCase())
        .single()

      if (existingTicker) {
        tickerData = existingTicker
      } else {
        const tickerInfo = await getTickerInfo(formData.symbol.toUpperCase())
        const { data: newTicker, error: tickerError } = await supabase
          .from('pa_tickers')
          .insert({ symbol: formData.symbol.toUpperCase(), name: tickerInfo?.name || formData.symbol.toUpperCase() })
          .select()
          .single()
        if (tickerError) throw tickerError
        tickerData = newTicker
      }

      const { data: position, error: positionError } = await supabase
        .from('pa_positions')
        .insert({
          portfolio_id: portfolioId,
          ticker_id: tickerData.id,
          quantity: parseFloat(formData.quantity),
          cost_basis: parseFloat(formData.costBasis),
          purchase_date: formData.purchaseDate,
          position_type: formData.positionType,
        })
        .select()
        .single()
      if (positionError) throw positionError

      if (formData.positionType === 'option') {
        const { error: optionError } = await supabase.from('pa_options_positions').insert({
          position_id: position.id,
          strike_price: parseFloat(formData.strikePrice),
          expiration_date: formData.expirationDate,
          option_type: formData.optionType,
          premium: parseFloat(formData.premium),
          contracts: parseInt(formData.contracts),
        })
        if (optionError) throw optionError
      }

      toast.success(`${formData.symbol.toUpperCase()} position added`)
      setFormData(defaultForm)
      setShowForm(false)
      onUpdate()
    } catch (error: any) {
      toast.error(`Failed to add position: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePosition = async (positionId: string) => {
    try {
      const { error } = await supabase.from('pa_positions').delete().eq('id', positionId)
      if (error) throw error
      toast.success('Position deleted')
      onUpdate()
    } catch (error: any) {
      toast.error(`Failed to delete: ${error.message}`)
    }
  }

  const f = (key: keyof typeof formData, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Positions</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'Add Position'}
        </Button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="rounded-xl border bg-muted/30 p-5">
          <h3 className="mb-4 font-semibold text-sm">New Position</h3>
          <form onSubmit={handleAddPosition} className="space-y-4">
            {/* Position type */}
            <div className="grid gap-2">
              <Label>Position Type</Label>
              <select
                value={formData.positionType}
                onChange={(e) => f('positionType', e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-[3px] focus:ring-ring/50 focus:border-ring"
              >
                <option value="stock">Stock</option>
                <option value="option">Option</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="grid gap-2">
                <Label>Symbol *</Label>
                <Input
                  value={formData.symbol}
                  onChange={(e) => f('symbol', e.target.value)}
                  placeholder="AAPL"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={formData.quantity}
                  onChange={(e) => f('quantity', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Cost Basis *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.costBasis}
                  onChange={(e) => f('costBasis', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Purchase Date *</Label>
                <Input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => f('purchaseDate', e.target.value)}
                  required
                />
              </div>
            </div>

            {formData.positionType === 'option' && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 border-t pt-4">
                <div className="grid gap-2">
                  <Label>Option Type *</Label>
                  <select
                    value={formData.optionType}
                    onChange={(e) => f('optionType', e.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-[3px] focus:ring-ring/50 focus:border-ring"
                    required
                  >
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Strike Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.strikePrice}
                    onChange={(e) => f('strikePrice', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Expiry *</Label>
                  <Input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => f('expirationDate', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Premium *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.premium}
                    onChange={(e) => f('premium', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Contracts *</Label>
                  <Input
                    type="number"
                    value={formData.contracts}
                    onChange={(e) => f('contracts', e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setFormData(defaultForm) }}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Adding…' : 'Add Position'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Data table */}
      <DataTable
        columns={columns(handleDeletePosition)}
        data={positions}
        searchPlaceholder="Search positions…"
        pageSize={15}
        emptyMessage="No positions yet. Add your first position to get started."
      />
    </div>
  )
}

'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const SECTIONS = [
  { id: 'property-info', label: 'Property Information', desc: 'Address, type, units, asking price' },
  { id: 'scenario-details', label: 'Scenario Details', desc: 'Purchase price, income, expenses for the best scenario' },
  { id: 'financial-metrics', label: 'Financial Metrics', desc: 'Cap rate, DSCR, GRM, LTV, total cash invested' },
  { id: 'first-year', label: 'First Year Financials', desc: 'NOI, cash flow, cash-on-cash return' },
  { id: 'loan-info', label: 'Loan Information', desc: 'Term, rate, monthly payment, down payment' },
  { id: 'pl-table', label: 'Year-by-Year P&L', desc: 'Income, expenses, cash flow, equity, IRR projections' },
]

interface PropertyPdfDialogProps {
  propertyId: number
  scenarioId?: number
  propertyName?: string
}

export function PropertyPdfDialog({ propertyId, scenarioId, propertyName }: PropertyPdfDialogProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SECTIONS.map(s => s.id))
  )

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const generate = () => {
    if (selected.size === 0) return
    const sections = Array.from(selected).join(',')
    const url = `/apps/property/properties/${propertyId}/print?sections=${encodeURIComponent(sections)}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`
    window.open(url, '_blank')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50 flex items-center gap-2 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          Export PDF
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Export Property Summary
          </DialogTitle>
        </DialogHeader>

        {propertyName && (
          <p className="text-sm text-muted-foreground">
            Property: <span className="font-medium text-foreground">{propertyName}</span>
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sections to include</p>
            <button
              onClick={() => {
                if (selected.size === SECTIONS.length) {
                  setSelected(new Set())
                } else {
                  setSelected(new Set(SECTIONS.map(s => s.id)))
                }
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              {selected.size === SECTIONS.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          {SECTIONS.map(section => (
            <label key={section.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.has(section.id)}
                onChange={() => toggle(section.id)}
                className="mt-0.5 h-4 w-4 rounded border-input text-primary cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium group-hover:text-foreground leading-tight">
                  {section.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{section.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground mr-auto">
            {selected.size} section{selected.size !== 1 ? 's' : ''} selected
          </p>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generate} disabled={selected.size === 0}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

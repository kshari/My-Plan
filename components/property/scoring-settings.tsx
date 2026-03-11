'use client'

import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useScoringConfig } from '@/components/property/scoring-context'
import { type ScoringConfig, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'

interface FieldDef {
  key: keyof ScoringConfig
  label: string
  description: string
  min: number
  max: number
  step: number
  unit: string
  isWeight?: boolean
}

const WEIGHT_FIELDS: FieldDef[] = [
  { key: 'capRateWeight',    label: 'Cap Rate',   description: 'Weight for capitalization rate',     min: 0, max: 50, step: 1, unit: 'pts', isWeight: true },
  { key: 'roiWeight',        label: 'ROI / CoCR', description: 'Weight for cash-on-cash return',    min: 0, max: 50, step: 1, unit: 'pts', isWeight: true },
  { key: 'cashFlowWeight',   label: 'Cash Flow',  description: 'Weight for positive cash flow',     min: 0, max: 50, step: 1, unit: 'pts', isWeight: true },
  { key: 'onePercentWeight', label: '1% Rule',    description: 'Weight for rent-to-price ratio',    min: 0, max: 50, step: 1, unit: 'pts', isWeight: true },
  { key: 'grmWeight',        label: 'GRM',        description: 'Weight for gross rent multiplier',  min: 0, max: 50, step: 1, unit: 'pts', isWeight: true },
]

const TARGET_FIELDS: FieldDef[] = [
  { key: 'capRateTarget',    label: 'Cap Rate target',        description: 'Cap rate % for full score',             min: 1, max: 20, step: 0.5, unit: '%' },
  { key: 'roiTarget',        label: 'ROI target',             description: 'CoCR % for full score',                 min: 1, max: 30, step: 0.5, unit: '%' },
  { key: 'onePercentTarget', label: '1% Rule target',         description: 'Rent/price ratio % for full score',     min: 0.5, max: 5, step: 0.1, unit: '%' },
  { key: 'grmFullTarget',    label: 'GRM best (full score)',  description: 'GRM at or below = full score',          min: 1, max: 15, step: 0.5, unit: '×' },
  { key: 'grmZeroTarget',    label: 'GRM worst (zero score)', description: 'GRM at or above = zero score',          min: 5, max: 30, step: 0.5, unit: '×' },
]

export default function ScoringSettings() {
  const { config, setConfig, resetConfig } = useScoringConfig()
  const [draft, setDraft] = useState<ScoringConfig>(config)
  const [open, setOpen] = useState(false)

  function handleOpen(isOpen: boolean) {
    if (isOpen) setDraft(config)
    setOpen(isOpen)
  }

  function handleSave() {
    setConfig(draft)
    setOpen(false)
  }

  function handleReset() {
    setDraft(DEFAULT_SCORING_CONFIG)
  }

  function update(key: keyof ScoringConfig, value: number) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const totalWeight = draft.capRateWeight + draft.roiWeight + draft.cashFlowWeight + draft.onePercentWeight + draft.grmWeight

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          Scoring
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Investment Score Settings</DialogTitle>
          <DialogDescription>
            Customize how properties are scored. Changes apply to all properties.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Weights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Weights</h4>
              <span className="text-xs tabular-nums text-muted-foreground">
                Total: {totalWeight} pts
                {totalWeight !== 100 && <span className="text-amber-600 dark:text-amber-400 ml-1">(scores will be normalized to 100)</span>}
              </span>
            </div>
            <div className="space-y-4">
              {WEIGHT_FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm">{f.label}</label>
                    <span className="text-sm font-medium tabular-nums w-12 text-right">{draft[f.key]} {f.unit}</span>
                  </div>
                  <Slider
                    value={[draft[f.key]]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onValueChange={([v]) => update(f.key, v)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Targets */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Targets</h4>
            <div className="space-y-4">
              {TARGET_FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm">{f.label}</label>
                    <span className="text-sm font-medium tabular-nums w-16 text-right">{draft[f.key]}{f.unit}</span>
                  </div>
                  <Slider
                    value={[draft[f.key]]}
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    onValueChange={([v]) => update(f.key, v)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

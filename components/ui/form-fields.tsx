'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  className?: string
  helpText?: string
}

export function NumField({ label, value, onChange, className }: FieldProps) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-9 text-sm"
      />
    </div>
  )
}

export function CurrencyField({ label, value, onChange, className, helpText }: FieldProps) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-9 text-sm pl-6"
        />
      </div>
      {helpText && <p className="text-[10px] text-muted-foreground/70">{helpText}</p>}
    </div>
  )
}

export function PctField({ label, value, onChange, className }: FieldProps) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="h-9 text-sm pr-7"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

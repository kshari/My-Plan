'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  className?: string
  helpText?: string
}

/**
 * useNumberInput — keeps an internal string so the field can be empty/transitional
 * while the user is editing. Only propagates a parsed number upward on blur (or when
 * a valid, non-empty number is present). Avoids the leading-zero problem where
 * parse("") || 0  immediately forces the field back to "0" mid-edit.
 */
/** Round to at most 10 significant decimal digits to strip floating-point noise (e.g. 7.000000000000001 → 7). */
function cleanNum(n: number): string {
  return String(parseFloat(n.toPrecision(10)))
}

function useNumberInput(
  value: number,
  onChange: (v: number) => void,
  parse: (s: string) => number,
) {
  const [display, setDisplay] = useState(cleanNum(value))

  // Keep display in sync when the parent changes the value (e.g. "Reset to defaults")
  useEffect(() => {
    setDisplay(cleanNum(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setDisplay(raw)
    // Only propagate if non-empty and parseable to a real number
    const parsed = parse(raw)
    if (raw !== '' && !isNaN(parsed)) {
      onChange(parsed)
    }
  }

  function handleBlur() {
    const parsed = parse(display)
    if (display === '' || isNaN(parsed)) {
      // Revert display to the last valid value on blur
      setDisplay(cleanNum(value))
    } else {
      // Normalize display (e.g. strip leading zeros)
      setDisplay(cleanNum(parsed))
      onChange(parsed)
    }
  }

  return { display, handleChange, handleBlur }
}

export function NumField({ label, value, onChange, className }: FieldProps) {
  const { display, handleChange, handleBlur } = useNumberInput(
    value,
    onChange,
    (s) => parseInt(s, 10),
  )
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className="h-9 text-sm"
      />
    </div>
  )
}

export function CurrencyField({ label, value, onChange, className, helpText }: FieldProps) {
  const { display, handleChange, handleBlur } = useNumberInput(
    value,
    onChange,
    parseFloat,
  )
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        <Input
          type="number"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          className="h-9 text-sm pl-6"
        />
      </div>
      {helpText && <p className="text-[10px] text-muted-foreground/70">{helpText}</p>}
    </div>
  )
}

export function PctField({ label, value, onChange, className }: FieldProps) {
  const { display, handleChange, handleBlur } = useNumberInput(
    value,
    onChange,
    parseFloat,
  )
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.1"
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          className="h-9 text-sm pr-7"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </div>
  )
}

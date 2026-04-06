'use client'

import { ALargeSmall, ChevronDown, Plus, Minus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useFontScale, type FontScale } from './font-scale-provider'

export const SCALES: { value: FontScale; label: string }[] = [
  { value: '1',     label: 'Small' },
  { value: '1.125', label: 'Normal' },
  { value: '1.25',  label: 'Large' },
  { value: '1.375', label: 'Extra Large' },
  { value: '1.5',   label: 'Maximum' },
]

interface FontScaleToggleProps {
  /** 'sidebar' uses sidebar color tokens (default); 'inline' uses standard muted colors for page headers */
  variant?: 'sidebar' | 'inline'
}

export function FontScaleToggle({ variant = 'sidebar' }: FontScaleToggleProps) {
  const { fontScale, setFontScale } = useFontScale()

  const idx = SCALES.findIndex((s) => s.value === fontScale)
  const atMin = idx === 0
  const atMax = idx === SCALES.length - 1
  const currentLabel = SCALES[idx]?.label ?? 'Normal'

  /** Clicking the label/icon cycles forward and wraps back to Small at max. */
  function cycleForward() {
    setFontScale(SCALES[(idx + 1) % SCALES.length].value)
  }

  function decrease() {
    if (!atMin) setFontScale(SCALES[idx - 1].value)
  }

  function increase() {
    if (!atMax) setFontScale(SCALES[idx + 1].value)
  }

  const iconCls = variant === 'sidebar'
    ? 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent disabled:opacity-30 disabled:pointer-events-none'
    : 'text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none'

  const labelCls = variant === 'sidebar'
    ? 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
    : 'text-muted-foreground hover:text-foreground'

  const wrapperClass = variant === 'sidebar'
    ? 'flex items-center py-0.5'
    : 'flex items-center'

  const content = (
    <div className={wrapperClass}>
      {/* ALargeSmall icon + label — click cycles through sizes, wraps to Small */}
      <Button
        variant="ghost"
        size="sm"
        onClick={cycleForward}
        className={`justify-start gap-2 px-0 pr-1 ${labelCls}`}
        title="Click to cycle text size"
      >
        <ALargeSmall className="h-4 w-4 shrink-0" />
        <span>Text: {currentLabel}</span>
      </Button>

      {/* − + ⌄ grouped tightly next to the label */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={decrease}
          disabled={atMin}
          className={`px-1 h-7 ${iconCls}`}
          title="Decrease text size"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={increase}
          disabled={atMax}
          className={`px-1 h-7 ${iconCls}`}
          title="Increase text size"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`px-1 h-7 ${iconCls}`}
              title="Choose text size"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {SCALES.map((scale) => (
              <DropdownMenuItem
                key={scale.value}
                onClick={() => setFontScale(scale.value)}
                className="flex items-center justify-between"
              >
                <span>{scale.label}</span>
                {fontScale === scale.value && <Check className="h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return (
      <div className="inline-flex rounded-lg border border-border bg-muted/40 px-2 py-1 shadow-sm" role="group" aria-label="Text size">
        {content}
      </div>
    )
  }
  return content
}

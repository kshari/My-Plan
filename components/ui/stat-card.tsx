import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatPercent, formatNumber } from '@/lib/utils/formatting'

type FormatType = 'currency' | 'currency-short' | 'percent' | 'number' | 'raw'
type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const variantStyles: Record<Variant, string> = {
  default: 'bg-background',
  success: 'bg-emerald-50 dark:bg-emerald-950/30',
  warning: 'bg-amber-50 dark:bg-amber-950/30',
  danger: 'bg-red-50 dark:bg-red-950/30',
  info: 'bg-blue-50 dark:bg-blue-950/30',
}

const variantValueStyles: Record<Variant, string> = {
  default: 'text-foreground',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
  danger: 'text-red-700 dark:text-red-400',
  info: 'text-blue-700 dark:text-blue-400',
}

interface StatCardProps {
  label: string
  value: number | string
  format?: FormatType
  variant?: Variant
  className?: string
  percentDecimals?: number
}

export function StatCard({
  label,
  value,
  format = 'raw',
  variant = 'default',
  className,
  percentDecimals = 1,
}: StatCardProps) {
  const formatted = typeof value === 'string'
    ? value
    : format === 'currency' ? formatCurrency(value)
    : format === 'currency-short' ? formatCurrencyShort(value)
    : format === 'percent' ? formatPercent(value, percentDecimals)
    : format === 'number' ? formatNumber(value)
    : String(value)

  return (
    <div className={cn('rounded-lg border px-3 py-2', variantStyles[variant], className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold', variantValueStyles[variant])}>{formatted}</p>
    </div>
  )
}

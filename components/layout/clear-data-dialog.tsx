'use client'

import { Trash2 } from 'lucide-react'
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
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ClearDataDialogProps {
  /** Called after the user confirms. Put localStorage.removeItem + state resets here. */
  onConfirm: () => void
  /** Optional description shown in the dialog body. */
  description?: string
  /** Optional custom trigger element; defaults to a ghost button matching the sidebar/header style. */
  triggerClassName?: string
  /** 'sidebar' renders the trigger as a full-width sidebar row; 'inline' renders a compact header button. */
  variant?: 'sidebar' | 'inline'
}

export function ClearDataDialog({
  onConfirm,
  description = 'All data saved in this browser will be permanently deleted. This cannot be undone.',
  variant = 'inline',
  triggerClassName,
}: ClearDataDialogProps) {
  const triggerCls =
    variant === 'sidebar'
      ? cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
          'text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors',
          triggerClassName,
        )
      : cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 text-sm font-medium',
          'text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors',
          triggerClassName,
        )

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={triggerCls} title="Clear all data in this browser">
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span className={variant === 'inline' ? 'hidden sm:inline' : undefined}>Clear Data</span>
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear browser data?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(buttonVariants({ variant: 'destructive' }))}
          >
            Clear Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

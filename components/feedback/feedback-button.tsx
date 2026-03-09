'use client'

import { useState } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FeedbackDialog } from './feedback-dialog'

export function FeedbackButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-4 z-50 lg:bottom-6',
          'flex h-11 w-11 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:bg-primary/90 hover:scale-105 active:scale-95',
          'transition-all duration-150',
        )}
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

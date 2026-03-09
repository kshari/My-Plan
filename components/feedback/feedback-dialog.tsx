'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Bug, Lightbulb, MessageCircle, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const TYPES = [
  { value: 'feedback', label: 'Feedback', icon: MessageCircle },
  { value: 'bug', label: 'Bug Report', icon: Bug },
  { value: 'feature_request', label: 'Feature Idea', icon: Lightbulb },
] as const

const TYPE_LABELS: Record<string, string> = {
  feedback: 'Feedback',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
}

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const pathname = usePathname()
  const supabase = createClient()

  const [type, setType] = useState<string>('feedback')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user)
      if (user?.email) setEmail(user.email)
    })
  }, [open, supabase])

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        email: user.email,
        type,
        message: message.trim(),
        page_url: pathname,
      })

      if (error) {
        toast.error('Failed to submit feedback. Please try again.')
      } else {
        toast.success('Thank you! Your feedback has been submitted.')
        setMessage('')
        setType('feedback')
        onOpenChange(false)
      }
    } else {
      const subject = encodeURIComponent(`[${TYPE_LABELS[type] || 'Feedback'}] from My Plan`)
      const body = encodeURIComponent(
        `${message.trim()}\n\n---\nPage: ${pathname}\nEmail: ${email || 'not provided'}`,
      )
      window.open(`mailto:kshari@gmail.com?subject=${subject}&body=${body}`, '_blank')
      toast.success('Opening your email client to send feedback.')
      setMessage('')
      setType('feedback')
      onOpenChange(false)
    }

    setSubmitting(false)
  }, [supabase, type, message, email, pathname, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve. Report a bug, suggest a feature, or share your thoughts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all',
                  type === t.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm min-h-[120px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder={
              type === 'bug'
                ? 'Describe what happened and what you expected...'
                : type === 'feature_request'
                  ? 'Describe the feature you would like to see...'
                  : 'Share your thoughts...'
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {isAuthenticated === false && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="email"
                placeholder="Your email (optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {isAuthenticated === false ? 'Opens your email client' : `Page: ${pathname}`}
            </p>
            <Button
              size="sm"
              disabled={!message.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Sending...' : isAuthenticated === false ? 'Send via Email' : 'Submit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

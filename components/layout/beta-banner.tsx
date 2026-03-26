'use client'

import { useEffect, useState } from 'react'
import { FlaskConical, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface BetaInvitation {
  feature_id: string
  feature_name: string
  feature_description?: string
  status: string
}

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  ai_agent:
    'An AI-powered financial coach that can analyze your portfolio, run retirement projections, compare what-if scenarios, and provide personalized guidance across all your financial data.',
}

export function BetaBanner() {
  const [invitations, setInvitations] = useState<BetaInvitation[]>([])
  const [accepting, setAccepting] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/beta/invitations')
      .then((r) => r.json())
      .then((data) => setInvitations(data.invitations ?? []))
      .catch(() => {})
  }, [])

  async function handleAccept(featureId: string) {
    setAccepting(featureId)
    try {
      const res = await fetch('/api/beta/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInvitations((prev) => prev.filter((i) => i.feature_id !== featureId))
      toast.success('Beta feature enabled! Refresh the page to see it.')
      window.location.reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to accept')
    } finally {
      setAccepting(null)
    }
  }

  const visible = invitations.filter((i) => !dismissed.has(i.feature_id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 p-3">
      {visible.map((inv) => {
        const description =
          inv.feature_description ?? FEATURE_DESCRIPTIONS[inv.feature_id]

        return (
          <div
            key={inv.feature_id}
            className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30"
          >
            <div className="flex items-start gap-3">
              <FlaskConical className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  You&apos;re invited to try <strong>{inv.feature_name}</strong>{' '}
                  <span className="text-amber-600 dark:text-amber-400">(Beta)</span>
                </p>
                {description && (
                  <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50"
                  onClick={() => handleAccept(inv.feature_id)}
                  disabled={accepting === inv.feature_id}
                >
                  {accepting === inv.feature_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Enable'
                  )}
                </Button>
                <button
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(inv.feature_id))
                  }
                  className="text-amber-400 hover:text-amber-600 dark:text-amber-600 dark:hover:text-amber-400"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

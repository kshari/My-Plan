'use client'

import { useState } from 'react'
import { Copy, Check, Mail, Link2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'

interface InviteDialogProps {
  teamId: string
  onClose: () => void
}

export default function InviteDialog({ teamId, onClose }: InviteDialogProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joinLink, setJoinLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create invitation'); return }
      setJoinLink(json.joinLink)
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!joinLink) return
    await navigator.clipboard.writeText(joinLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        {!joinLink ? (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email address <span className="text-muted-foreground text-xs">(optional)</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <p className="text-xs text-muted-foreground">If provided, an invitation email will be sent. You can also copy and share the link manually.</p>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={loading} className="flex-1">
                <Link2 className="h-4 w-4 mr-2" />
                {loading ? 'Generating…' : 'Generate Invite Link'}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                {email ? `Invitation sent to ${email}` : 'Invitation link generated'}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Valid for 7 days</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Invite Link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={joinLink}
                  className="flex-1 rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground truncate"
                />
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setJoinLink(null); setEmail('') }}>
                Generate Another
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

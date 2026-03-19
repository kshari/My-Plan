'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JoinTeamClientProps {
  token: string
  teamName: string
  memberCount: number
  alreadyMember: boolean
}

export default function JoinTeamClient({ token, teamName, memberCount, alreadyMember }: JoinTeamClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(alreadyMember)

  async function handleJoin() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to join team'); return }
      setJoined(true)
      setTimeout(() => router.push(`/apps/property/teams/${json.teamId}`), 1500)
    } catch {
      setError('Unexpected error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-lg p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Users className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {joined ? (
          <>
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold">You&apos;re in!</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve {alreadyMember ? 'already joined' : 'joined'} <strong>{teamName}</strong>. Redirecting…
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold">Join Team</h1>
              <p className="mt-1 text-sm text-muted-foreground">You&apos;ve been invited to join</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{teamName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {memberCount} member{memberCount !== 1 ? 's' : ''} · Property Investment Team
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button className="w-full" onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining…' : 'Accept Invitation & Join Team'}
            </Button>

            <p className="text-xs text-muted-foreground">
              By joining, you will have access to shared properties in this team.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

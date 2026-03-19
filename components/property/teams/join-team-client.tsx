'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JoinTeamClientProps {
  token: string
  teamName: string
  memberCount: number
  alreadyMember: boolean
}

const REDIRECT_SECONDS = 3

export default function JoinTeamClient({ token, teamName, memberCount, alreadyMember }: JoinTeamClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(alreadyMember)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the countdown + redirect whenever joined becomes true
  useEffect(() => {
    if (!joined) return

    setCountdown(REDIRECT_SECONDS)

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [joined])

  // Navigate once countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      const destination = teamId
        ? `/apps/property/teams/${teamId}`
        : '/apps/property/teams'
      router.push(destination)
    }
  }, [countdown, teamId, router])

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
      setTeamId(json.teamId)
      setJoined(true)
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
                You&apos;ve {alreadyMember ? 'already joined' : 'joined'} <strong>{teamName}</strong>.
              </p>
            </div>

            {/* Countdown ring */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex h-14 w-14 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-emerald-100 dark:text-emerald-900/40" />
                  <circle
                    cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * ((countdown ?? REDIRECT_SECONDS) / REDIRECT_SECONDS)}`}
                    strokeLinecap="round"
                    className="text-emerald-500 transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {countdown ?? REDIRECT_SECONDS}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Redirecting to Property Teams…</p>
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FlaskConical, Loader2, CheckCircle2, XCircle, LogIn, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { use } from 'react'

interface LinkInfo {
  feature: { id: string; name: string }
  link: { label: string | null; expires_at: string | null; max_uses: number | null; use_count: number }
}

export default function BetaJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [info, setInfo] = useState<LinkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [alreadyEnabled, setAlreadyEnabled] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      fetch(`/api/beta/join?token=${token}`).then((r) => r.json()),
      supabase.auth.getUser(),
    ])
      .then(([data, { data: { user } }]) => {
        setCurrentUser(user ?? null)
        if (data.error) {
          setError(data.error)
        } else {
          setInfo(data)
        }
      })
      .catch(() => setError('Failed to load invite link.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleJoin() {
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch('/api/beta/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to enable access')
      if (data.already_enabled) {
        setAlreadyEnabled(true)
      } else {
        setJoined(true)
      }
      setTimeout(() => router.push('/'), 2000)
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setJoining(false)
    }
  }

  const loginUrl = `/login?next=${encodeURIComponent(`/beta/join/${token}`)}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold tracking-tight">Beta Access</p>
              <p className="text-xs text-muted-foreground">My Plan</p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-muted-foreground">Checking invite link…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">Link unavailable</h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go to Home</Link>
              </Button>
            </div>
          )}

          {/* Success */}
          {!loading && (joined || alreadyEnabled) && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <div>
                <h2 className="text-lg font-semibold">
                  {alreadyEnabled ? 'Already enabled!' : 'Access granted!'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {alreadyEnabled
                    ? `${info?.feature.name} is already enabled on your account.`
                    : `${info?.feature.name} is now enabled. Redirecting…`}
                </p>
              </div>
            </div>
          )}

          {/* Main CTA */}
          {!loading && !error && !joined && !alreadyEnabled && info && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">You&apos;re invited</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentUser
                    ? 'Enable this beta feature on your account.'
                    : 'Sign in to enable this beta feature.'}
                </p>
              </div>

              {/* Feature card */}
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{info.feature.name}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">Beta feature</p>
                  </div>
                </div>
                {info.link.label && (
                  <p className="text-xs text-muted-foreground pl-7">{info.link.label}</p>
                )}
                {info.link.expires_at && (
                  <p className="text-xs text-muted-foreground pl-7">
                    Expires {new Date(info.link.expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Not logged in */}
              {!currentUser && (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Sign in to enable this feature on your account.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={loginUrl}>
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in to enable
                    </Link>
                  </Button>
                </div>
              )}

              {/* Logged in */}
              {currentUser && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Signed in as <span className="font-medium">{currentUser.email}</span>
                  </p>
                  {joinError && (
                    <p className="text-sm text-destructive text-center">{joinError}</p>
                  )}
                  <Button className="w-full" onClick={handleJoin} disabled={joining}>
                    {joining ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enabling…</>
                    ) : (
                      <><FlaskConical className="mr-2 h-4 w-4" />Enable Beta Access</>
                    )}
                  </Button>
                  <Button asChild variant="ghost" className="w-full text-xs text-muted-foreground">
                    <Link href="/">Not now</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

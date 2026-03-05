'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Target, ArrowLeft, AlertCircle } from 'lucide-react'

function parseHashParams(hash: string): Record<string, string> {
  if (!hash || !hash.startsWith('#')) return {}
  const params: Record<string, string> = {}
  const search = hash.slice(1)
  for (const part of search.split('&')) {
    const [key, value] = part.split('=')
    if (key && value) params[decodeURIComponent(key)] = decodeURIComponent(value)
  }
  return params
}

export default function AuthCodeErrorPage() {
  const [params, setParams] = useState<Record<string, string>>({})
  const [parsed, setParsed] = useState(false)

  useEffect(() => {
    setParams(parseHashParams(window.location.hash))
    setParsed(true)
  }, [])

  const isExpired =
    params.error_code === 'otp_expired' ||
    (params.error === 'access_denied' &&
      (params.error_description?.toLowerCase().includes('expired') ||
        params.error_description?.toLowerCase().includes('invalid')))

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">My Plan</span>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            {!parsed ? (
              <>
                <h1 className="text-lg font-semibold text-foreground">Checking…</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you were sent here from a sign-in or password reset link, we’ll show the next step in a moment.
                </p>
              </>
            ) : isExpired ? (
              <>
                <h1 className="text-lg font-semibold text-foreground">Link expired or already used</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Password reset links are valid for a short time and can only be used once. If the link expired or you already used it, request a new one below.
                </p>
                <Link
                  href="/login/forgot-password"
                  className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Request a new password reset link
                </Link>
              </>
            ) : (
              <>
                <h1 className="text-lg font-semibold text-foreground">Sign-in link problem</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This sign-in or reset link is invalid or has already been used. Try signing in again or request a new password reset if you need one.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Back to sign in
                </Link>
              </>
            )}
          </div>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

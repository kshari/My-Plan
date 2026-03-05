'use client'

import Link from 'next/link'
import { Target, ArrowLeft } from 'lucide-react'

export default function ForgotUsernamePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">My Plan</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forgot username?</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            We use your <strong>email address</strong> to sign in, not a separate username. Use the email address you used when you created your account.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            If you&apos;re not sure which email you used, try the{' '}
            <Link href="/login/forgot-password" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
              Forgot password?
            </Link>{' '}
            flow with any email you might have used — we&apos;ll only send a reset link if that email is on file.
          </p>
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

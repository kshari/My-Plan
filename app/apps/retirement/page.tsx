import { redirectIfAuthenticated } from '@/lib/utils/auth'
import Link from 'next/link'
import { Target, ArrowRight } from 'lucide-react'

export default async function RetirementHomePage() {
  await redirectIfAuthenticated('/apps/retirement/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
            <Target className="h-7 w-7 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retirement Planner</h1>
          <p className="mt-2 text-muted-foreground">Plan your retirement with comprehensive financial modeling</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/try/retirement"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try Without Signing Up <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No account required. Your data stays in your browser.
        </p>
      </div>
    </div>
  )
}

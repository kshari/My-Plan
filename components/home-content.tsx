"use client"

import Link from 'next/link'
import { Building2, Target, Activity, ChevronRight, Shield, ArrowRight, ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/feedback/feedback-button'

const apps = [
  {
    id: 'pulse',
    name: 'Financial Pulse',
    description: 'Interactive personal finance education with benchmarking, What-If scenarios, and monthly reflection.',
    icon: Activity,
    authHref: '/apps/pulse/dashboard',
    tryHref: '/try/pulse',
    accent: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-100 dark:border-orange-900/50',
    badge: 'Education',
    badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    id: 'retirement',
    name: 'Retirement Planner',
    description: 'Comprehensive retirement modeling with Monte Carlo simulation, tax optimization, and withdrawal strategies.',
    icon: Target,
    authHref: '/apps/retirement/dashboard',
    tryHref: '/try/retirement',
    accent: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-100 dark:border-violet-900/50',
    badge: 'Retirement',
    badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  {
    id: 'property',
    name: 'Property Investment',
    description: 'Real estate investment analysis with cap rate, cash-on-cash return, DSCR, IRR projections, scenario comparison, and loan modeling.',
    icon: Building2,
    authHref: '/apps/property/dashboard',
    tryHref: '/try/property',
    accent: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    badge: 'Real Estate',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
]

interface HomeContentProps {
  userEmail: string | null
  isAdmin?: boolean
}

export function HomeContent({ userEmail, isAdmin = false }: HomeContentProps) {
  const isAuthenticated = !!userEmail
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : ''

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">My Plan</span>
          </div>
          <div className="flex items-center gap-2">
              {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link
                    href="/apps/admin"
                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <span className="hidden text-sm text-muted-foreground sm:block">
                  {userEmail}
                </span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary select-none">
                  {initials}
                </div>
                <ThemeToggle />
                <form action="/auth/signout" method="post" className="shrink-0">
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <ThemeToggle />
                <Link href="/login">
                  <Button variant="outline" size="sm">Sign In</Button>
                </Link>
                <Link href="/login?signup=1">
                  <Button size="sm">Create Account</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          {isAuthenticated ? (
            <>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Welcome back
              </h1>
              <p className="mt-4 mx-auto max-w-xl text-lg text-muted-foreground">
                Your unified financial planning platform. Build financial intuition, model real estate investments, and plan for retirement.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                Financial Planning Suite
              </h1>
              <p className="mt-4 mx-auto max-w-xl text-lg text-muted-foreground">
                Build financial intuition, model real estate investments, and plan for retirement — all free, no account required.
              </p>
            </>
          )}
        </div>

        {!isAuthenticated && (
          <div className="mb-8 mx-auto max-w-lg rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-5 py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
            <p className="text-sm text-muted-foreground mb-1">
              Pick any tool below to start exploring — your data stays in your browser.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Create a free account any time to save your work permanently.
            </p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, i) => (
            <div
              key={app.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${(i + 1) * 80}ms`, animationFillMode: 'both' }}
            >
              <Link
                href={isAuthenticated ? app.authHref : app.tryHref}
                className={`group flex flex-col h-full rounded-2xl border p-6 bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${app.border}`}
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${app.bg}`}>
                  <app.icon className={`h-6 w-6 ${app.accent}`} />
                </div>

                <span className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${app.badgeColor}`}>
                  {app.badge}
                </span>

                <h2 className="mb-2 text-lg font-semibold tracking-tight">
                  {app.name}
                </h2>
                <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
                  {app.description}
                </p>

                <div className="mt-5 flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2">
                  {isAuthenticated ? 'Open' : 'Try it free'}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {!isAuthenticated && (
          <div className="mt-10 text-center animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
            <Link href="/login?signup=1">
              <Button size="lg" className="gap-2">
                Create Free Account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">Save your data permanently and unlock unlimited features.</p>
          </div>
        )}

        <p className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <Shield className="h-3 w-3" />
          Your financial data is private and never shared.
        </p>
      </main>

      <FeedbackButton />
    </div>
  )
}

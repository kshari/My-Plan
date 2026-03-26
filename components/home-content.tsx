"use client"

import Link from 'next/link'
import { Building2, Target, Activity, ChevronRight, Shield, ArrowRight, ShieldCheck, Bot, Handshake } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/feedback/feedback-button'
import { BetaBanner } from '@/components/layout/beta-banner'
import { useAgentPanel } from '@/components/agent/agent-panel-context'
import { AgentPanel } from '@/components/agent/agent-panel'
import { cn } from '@/lib/utils'
import type { FeatureFlags } from '@/lib/app-features'

const apps = [
  {
    id: 'pulse',
    name: 'Financial Pulse',
    shortName: 'Pulse',
    description: 'Interactive personal finance education with benchmarking, the Financial Learning Lab, and monthly reflection.',
    shortDesc: 'Finance education, benchmarking & reflection',
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
    shortName: 'Retirement',
    description: 'Comprehensive retirement modeling with Monte Carlo simulation, tax optimization, and withdrawal strategies.',
    shortDesc: 'Monte Carlo projections, tax & withdrawal planning',
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
    shortName: 'Property',
    description: 'Real estate investment analysis with cap rate, cash-on-cash return, DSCR, IRR projections, scenario comparison, and loan modeling.',
    shortDesc: 'Cap rate, IRR, cash-on-cash & loan analysis',
    icon: Building2,
    authHref: '/apps/property/dashboard',
    tryHref: '/try/property',
    accent: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    badge: 'Real Estate',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'partnerships',
    name: 'Partnerships',
    shortName: 'Partnerships',
    description: 'Group investment workspace — create entities, invite members, track investments with workflow stages, cap table, decisions, ledger, and document vault.',
    shortDesc: 'Group investing, cap table & document vault',
    icon: Handshake,
    authHref: '/apps/partnerships',
    tryHref: '/login',
    accent: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-100 dark:border-blue-900/50',
    badge: 'Group Investing',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
]

interface HomeContentProps {
  userEmail: string | null
  isAdmin?: boolean
  features?: FeatureFlags
}

export function HomeContent({ userEmail, isAdmin = false, features }: HomeContentProps) {
  const isAuthenticated = !!userEmail
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : ''
  const { mode: agentMode, open: openAgent } = useAgentPanel()
  const aiAgentEnabled = features?.aiAgent !== false

  const visibleApps = apps.filter((app) => isAuthenticated || app.id !== 'partnerships')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">My Plan</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                <ThemeToggle compact />
                <form action="/auth/signout" method="post" className="shrink-0">
                  <Button type="submit" variant="outline" size="sm">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <ThemeToggle compact />
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

      <div className="flex flex-1 min-h-0 relative">
        <main className={cn(
          "flex-1 overflow-y-auto pb-20 lg:pb-0 min-w-0",
          agentMode === 'fullscreen' && "hidden"
        )}>
          {isAuthenticated ? (
            /* ── Compact authenticated layout ── */
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
              <BetaBanner />

              <div className="mb-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick up where you left off.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {visibleApps.map((app, i) => (
                  <Link
                    key={app.id}
                    href={app.authHref}
                    className={cn(
                      'group flex items-center gap-3.5 rounded-xl border p-3.5 bg-card transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-3 duration-200',
                      app.border
                    )}
                    style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
                  >
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', app.bg)}>
                      <app.icon className={cn('h-5 w-5', app.accent)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-semibold tracking-tight">{app.name}</h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">{app.shortDesc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 shrink-0" />
                  </Link>
                ))}
              </div>

              <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                Your financial data is private and never shared.
              </p>
            </div>
          ) : (
            /* ── Full marketing layout for visitors ── */
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
              <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  Financial Planning Suite
                </h1>
                <p className="mt-4 mx-auto max-w-xl text-lg text-muted-foreground">
                  Build financial intuition, model real estate investments, and plan for retirement — all free, no account required.
                </p>
              </div>

              <div className="mb-8 mx-auto max-w-lg rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-5 py-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
                <p className="text-sm text-muted-foreground mb-1">
                  Pick any tool below to start exploring — your data stays in your browser.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Create a free account any time to save your work permanently.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {visibleApps.map((app, i) => (
                  <div
                    key={app.id}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                    style={{ animationDelay: `${(i + 1) * 80}ms`, animationFillMode: 'both' }}
                  >
                    <Link
                      href={app.tryHref}
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
                        Try it free
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              <div className="mt-10 text-center animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                <Link href="/login?signup=1">
                  <Button size="lg" className="gap-2">
                    Create Free Account <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">Save your data permanently and unlock unlimited features.</p>
              </div>

              <p className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
                <Shield className="h-3 w-3" />
                Your financial data is private and never shared.
              </p>
            </div>
          )}
        </main>

        {isAuthenticated && aiAgentEnabled && agentMode !== 'hidden' && <AgentPanel />}
      </div>

      {isAuthenticated && aiAgentEnabled && agentMode === 'hidden' && (
        <button
          onClick={openAgent}
          className={cn(
            "fixed bottom-32 right-4 z-50 lg:bottom-[4.5rem] lg:right-6",
            "flex h-11 w-11 items-center justify-center rounded-full",
            "bg-sky-500 text-white shadow-lg hover:bg-sky-600 hover:scale-105 active:scale-95",
            "transition-all duration-150"
          )}
          aria-label="Open AI Assistant"
        >
          <Bot className="h-5 w-5" />
        </button>
      )}
      <FeedbackButton />
    </div>
  )
}

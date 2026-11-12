"use client"

import Link from 'next/link'
import { Building2, Target, Activity, ChevronRight, Shield, ArrowRight, ShieldCheck, Bot, Handshake, Heart, BookOpen } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { FontScaleToggle } from '@/components/layout/font-scale-toggle'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/feedback/feedback-button'
import { BetaBanner } from '@/components/layout/beta-banner'
import { HomeAgentCard } from '@/components/agent/home-agent-card'
import { useAgentPanel } from '@/components/agent/agent-panel-context'
import { AgentPanel } from '@/components/agent/agent-panel'
import { PlanHealthStrip } from '@/components/dashboard/plan-health-strip'
import { AppSummaryCard } from '@/components/dashboard/app-summary-card'
import { cn } from '@/lib/utils'
import type { FeatureFlags } from '@/lib/app-features'
import type { AppSummary } from '@/lib/dashboard/types'

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
  {
    id: 'family',
    name: 'Family Activities',
    shortName: 'Family',
    description: 'Plan family activities and trips together — add interests, availability, discover places, get AI-powered recommendations, vote on suggestions, and book travel.',
    shortDesc: 'Activity recommendations, voting & trip planning',
    icon: Heart,
    authHref: '/apps/family',
    tryHref: '/login',
    accent: 'text-rose-500',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-100 dark:border-rose-900/50',
    badge: 'Family',
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
]

interface HomeContentProps {
  userEmail: string | null
  isAdmin?: boolean
  features?: FeatureFlags
  summaries?: AppSummary[]
}

export function HomeContent({ userEmail, isAdmin = false, features, summaries: allSummaries = [] }: HomeContentProps) {
  const isAuthenticated = !!userEmail
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : ''
  const { mode: agentMode, openInline: openAgentInline } = useAgentPanel()
  const aiAgentEnabled = features?.aiAgent !== false
  const familyAppEnabled = features?.familyApp === true

  const visibleApps = apps.filter(
    (app) =>
      (isAuthenticated || app.id !== 'partnerships') &&
      (familyAppEnabled || app.id !== 'family')
  )
  const summaries = allSummaries.filter((s) => familyAppEnabled || s.app !== 'family')

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
                <FontScaleToggle variant="inline" />
                <ThemeToggle compact />
                <form action="/auth/signout" method="post" className="shrink-0">
                  <Button type="submit" variant="outline" size="sm">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <FontScaleToggle variant="inline" />
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
            /* ── Dashboard authenticated layout ── */
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
              <BetaBanner />

              <div className="mb-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h1 className="text-2xl font-bold tracking-tight">My Plan Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your financial plan — all in one place.
                </p>
              </div>

              {aiAgentEnabled && (
                <div className="mb-5 animate-in fade-in slide-in-from-bottom-3 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
                  <HomeAgentCard />
                </div>
              )}

              {summaries.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300" style={{ animationDelay: '80ms', animationFillMode: 'both' }}>
                  <PlanHealthStrip summaries={summaries} />
                </div>
              )}

              <a
                href="/finance"
                className="group mb-5 flex items-center gap-3 rounded-2xl border border-amber-100 dark:border-amber-900/50 bg-card px-4 py-3 transition-all hover:shadow-sm hover:-translate-y-px animate-in fade-in slide-in-from-bottom-3 duration-300"
                style={{ animationDelay: '100ms', animationFillMode: 'both' }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                  <BookOpen className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Personal Finance Library</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Plain-language guides on personal finance for every life stage
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 shrink-0">
                  Browse <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </a>

              <div className="grid gap-4 sm:grid-cols-2">
                {visibleApps.map((app, i) => {
                  const summary = summaries.find((s) => s.app === app.id)
                  if (!summary) {
                    // Fallback: simple link card while summaries load
                    return (
                      <Link
                        key={app.id}
                        href={app.authHref}
                        className={cn(
                          'block rounded-2xl border bg-card transition-colors hover:bg-muted/30 animate-in fade-in slide-in-from-bottom-3 duration-200',
                          app.border,
                        )}
                        style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                      >
                        <div className="flex items-center gap-3 p-4">
                          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', app.bg)}>
                            <app.icon className={cn('h-5 w-5', app.accent)} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{app.name}</p>
                            <p className="text-xs text-muted-foreground">{app.shortDesc}</p>
                          </div>
                        </div>
                      </Link>
                    )
                  }
                  return (
                    <div
                      key={app.id}
                      className="animate-in fade-in slide-in-from-bottom-3 duration-200"
                      style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                    >
                      <AppSummaryCard
                        summary={summary}
                        config={{
                          icon: app.icon,
                          accent: app.accent,
                          bg: app.bg,
                          border: app.border,
                          badge: app.badge,
                          badgeColor: app.badgeColor,
                        }}
                        name={app.name}
                        authHref={app.authHref}
                      />
                    </div>
                  )
                })}
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
                <div
                  className="animate-in fade-in slide-in-from-bottom-4 duration-300"
                  style={{ animationDelay: `${(visibleApps.length + 1) * 80}ms`, animationFillMode: 'both' }}
                >
                  <a
                    href="/finance"
                    className="group flex flex-col h-full rounded-2xl border border-amber-100 dark:border-amber-900/50 p-6 bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/30">
                      <BookOpen className="h-6 w-6 text-amber-600" />
                    </div>
                    <span className="mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      Free Reading
                    </span>
                    <h2 className="mb-2 text-lg font-semibold tracking-tight">
                      Personal Finance Library
                    </h2>
                    <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
                      Plain-language, numbers-first explainers on how financial products actually work — annuities, life insurance, and more topics added over time.
                    </p>
                    <div className="mt-5 flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2">
                      Start reading
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </a>
                </div>
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

        {isAuthenticated && aiAgentEnabled && (agentMode === 'docked' || agentMode === 'fullscreen') && <AgentPanel />}
      </div>

      {isAuthenticated && aiAgentEnabled && agentMode === 'hidden' && (
        <button
          onClick={openAgentInline}
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

"use client"

import Link from 'next/link'
import { TrendingUp, Building2, Target, ChevronRight, LayoutDashboard, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'

const apps = [
  {
    id: 'portfolio',
    name: 'Portfolio Analyzer',
    description: 'Stock and options portfolio tracking with risk metrics, beta, delta, and CAGR analysis.',
    icon: TrendingUp,
    href: '/apps/portfolio',
    accent: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-100 dark:border-blue-900/50',
    badge: 'Stocks & Options',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    id: 'property',
    name: 'Property Investment',
    description: 'Real estate investment analysis with cap rate, cash-on-cash return, DSCR, and loan modeling.',
    icon: Building2,
    href: '/apps/property/dashboard',
    accent: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-100 dark:border-emerald-900/50',
    badge: 'Real Estate',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    id: 'retirement',
    name: 'Retirement Planner',
    description: 'Comprehensive retirement modeling with Monte Carlo simulation, tax optimization, and withdrawal strategies.',
    icon: Target,
    href: '/apps/retirement/dashboard',
    accent: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-100 dark:border-violet-900/50',
    badge: 'Retirement',
    badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
]

interface HomeContentProps {
  userEmail: string
}

export function HomeContent({ userEmail }: HomeContentProps) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'UP'

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Target className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">My Plan</span>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-4 mx-auto max-w-xl text-lg text-muted-foreground">
            Your unified financial planning platform. Analyze portfolios, model real estate investments, and plan for retirement.
          </p>    
        </div>
          <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Financial Planning Suite 
          </h1>
          </div>   
        {/* App cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, i) => (
            <div
              key={app.id}
              className="animate-in fade-in slide-in-from-bottom-4 duration-300"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
            >
              <Link
                href={app.href}
                className={`group flex flex-col h-full rounded-2xl border p-6 bg-card transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${app.border}`}
              >
                {/* Icon */}
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${app.bg}`}>
                  <app.icon className={`h-6 w-6 ${app.accent}`} />
                </div>

                {/* Badge */}
                <span className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${app.badgeColor}`}>
                  {app.badge}
                </span>

                {/* Content */}
                <h2 className="mb-2 text-lg font-semibold tracking-tight">
                  {app.name}
                </h2>
                <p className="flex-1 text-sm text-muted-foreground leading-relaxed">
                  {app.description}
                </p>

                {/* CTA */}
                <div className="mt-5 flex items-center gap-1 text-sm font-medium transition-all group-hover:gap-2">
                  Open
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground animate-in fade-in duration-500" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <Shield className="h-3 w-3" />
          Your financial data is private and never shared.
        </p>
      </main>
    </div>
  )
}

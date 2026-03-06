'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Target, ArrowRight, Shield, Coffee, TrendingUp, PiggyBank, Swords, ShieldCheck, CreditCard, Calculator, ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EMPTY_PROFILE, type DemographicProfile } from '@/lib/demographics'
import { useBenchmarks } from '@/lib/hooks/use-benchmarks'
import { useResilienceScore } from '@/lib/hooks/use-resilience-score'
import { ResilienceScore } from '@/components/pulse/resilience-score'
import { PeerComparisonGrid } from '@/components/pulse/peer-comparison-grid'
import { DidYouKnowCard } from '@/components/pulse/did-you-know-card'
import { ExplorationProgress } from '@/components/pulse/exploration-progress'
import { ProfileForm } from '@/components/pulse/profile-form'
import { SCENARIO_METADATA } from '@/lib/constants/pulse-defaults'
import { FeedbackButton } from '@/components/feedback/feedback-button'

const LOCAL_KEY = 'fp_local_profile'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Coffee, TrendingUp, PiggyBank, Sword: Swords, ShieldCheck, CreditCard, Calculator,
}

export default function TryPulsePage() {
  const [profile, setProfile] = useState<DemographicProfile>(EMPTY_PROFILE)
  const [showProfile, setShowProfile] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY)
      if (saved) setProfile(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  const handleChange = useCallback((p: DemographicProfile) => {
    setProfile(p)
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)) } catch {}
  }, [])

  const comparisons = useBenchmarks(profile.annual_gross_income > 0 ? profile : null)
  const score = useResilienceScore(profile.annual_gross_income > 0 ? profile : null)

  if (!loaded) return null

  const hasData = profile.annual_gross_income > 0

  return (
    <div className="min-h-screen bg-background">
      {/* Banner */}
      <div className="bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800/50 px-4 py-2.5 text-center text-sm">
        <span className="text-muted-foreground">Your data lives in this browser only. </span>
        <Link href="/login?signup=1" className="font-semibold text-orange-600 dark:text-orange-400 hover:underline">
          Create a free account
        </Link>
        <span className="text-muted-foreground"> to save it permanently.</span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="bg-border w-px self-stretch mx-1 hidden sm:block" aria-hidden />
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500">
              <Activity className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold tracking-tight">Financial Pulse</span>
            <span className="rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">Try Mode</span>
          </div>
          <Link href="/login">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {!hasData ? (
          <div className="text-center py-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/30">
              <Activity className="h-7 w-7 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Try Financial Pulse</h1>
            <p className="mx-auto max-w-md text-muted-foreground">
              Enter a few financial details below to see how you compare to peers and explore interactive What-If scenarios.
            </p>
            <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setShowProfile(true)}>
              Get Started
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Financial Pulse</h1>
                <p className="text-sm text-muted-foreground">Know where you stand. See what&apos;s possible.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowProfile(!showProfile)}>
                {showProfile ? 'Hide Profile' : 'Edit Profile'}
              </Button>
            </div>

            <ExplorationProgress explored={profile.explored_scenarios} />
          </>
        )}

        {/* Profile form */}
        {(showProfile || !hasData) && hasData === false && (
          <div className="rounded-xl border bg-card p-4">
            <ProfileForm profile={profile} onChange={handleChange} />
          </div>
        )}
        {showProfile && hasData && (
          <div className="rounded-xl border bg-card p-4">
            <ProfileForm profile={profile} onChange={handleChange} />
          </div>
        )}

        {/* Dashboard content when profile is filled */}
        {hasData && (
          <>
            {score && <ResilienceScore score={score} />}
            <DidYouKnowCard />
            <div>
              <h2 className="text-lg font-semibold mb-3">How You Compare</h2>
              <PeerComparisonGrid comparisons={comparisons} />
            </div>
          </>
        )}

        {/* Scenarios — always shown */}
        <div>
          <h2 className="text-lg font-semibold mb-3">What-If Scenarios</h2>
          <p className="text-sm text-muted-foreground mb-4">Drag sliders, watch charts move, build financial intuition.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SCENARIO_METADATA.map((s) => {
              const Icon = ICONS[s.icon] ?? Calculator
              return (
                <Link
                  key={s.id}
                  href={`/try/pulse/scenarios/${s.id}`}
                  className="group flex flex-col rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{s.name}</h3>
                  <p className="flex-1 text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 transition-all group-hover:gap-2">
                    Try it <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Ready to save your data and track monthly progress?</p>
          <Link href="/login?signup=1">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              Create Free Account <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
      <FeedbackButton />
    </div>
  )
}

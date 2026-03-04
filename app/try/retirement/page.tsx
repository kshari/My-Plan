'use client'

import { useState } from 'react'
import { Target, ArrowRight, LogIn, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import RetirementCalculator from '@/components/retirement/retirement-calculator'
import { ScenarioProvider } from '@/components/retirement/scenario-context'
import SnapshotTab from '@/components/retirement/tabs/snapshot-tab'
import { PlanStructureContent } from '@/components/retirement/plan-structure-content'

export default function TryRetirementPage() {
  const [started, setStarted] = useState(false)
  const [showProjections, setShowProjections] = useState(false)
  const [showPlanStructure, setShowPlanStructure] = useState(false)

  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-8 max-w-lg">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/30">
              <Target className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Retirement Planner</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Plan your retirement with comprehensive financial modeling.
              No account required to get started.
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground text-left space-y-2">
            <p className="font-medium text-foreground">What you get without an account:</p>
            <ul className="space-y-1.5 ml-4 list-disc">
              <li>Quick retirement calculator with instant results</li>
              <li>Quick projections with year-by-year breakdown</li>
              <li>Data saved in your browser automatically</li>
            </ul>
            <p className="font-medium text-foreground pt-2">Create a free account to unlock:</p>
            <ul className="space-y-1.5 ml-4 list-disc">
              <li>Full plan with detailed year-by-year projections</li>
              <li>Multiple scenarios, risk analysis, and tax efficiency</li>
              <li>Print/PDF export and cross-device sync</li>
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => setStarted(true)} className="gap-2">
              Try Without Signing Up <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login" className="gap-2">
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Top banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your data is saved in this browser only.{' '}
            <span className="hidden sm:inline">
              Create a free account to save permanently and unlock{' '}
              <button
                onClick={() => { setShowPlanStructure(true); setShowProjections(false) }}
                className="underline underline-offset-2 font-medium hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
              >
                all features
              </button>.
            </span>
          </p>
          <Button size="sm" variant="outline" asChild className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">
            <Link href="/login?signup=1">Sign Up Free</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Retirement Planner</h1>
              <p className="text-xs text-muted-foreground">Local mode — data stored in this browser</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowPlanStructure(!showPlanStructure); if (!showPlanStructure) setShowProjections(false) }}
              className="gap-1.5 text-muted-foreground"
            >
              <Map className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Plan Structure</span>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Plan Structure view */}
        {showPlanStructure && (
          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Plan Structure</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Overview of all retirement planning features.
                  <span className="text-violet-600 dark:text-violet-400 font-medium"> Create a free account to unlock everything.</span>
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowPlanStructure(false)}>Close</Button>
            </div>
            <PlanStructureContent showOpen={false} />
            <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-center gap-3">
              <p className="text-sm text-muted-foreground">Ready for the full experience?</p>
              <Button asChild>
                <Link href="/login?signup=1">Create Free Account</Link>
              </Button>
            </div>
          </div>
        )}

        {/* Calculator */}
        {!showPlanStructure && (
          <>
            <RetirementCalculator onCalculateProjections={() => setShowProjections(true)} />

            {/* Quick Projections */}
            {showProjections && (
              <ScenarioProvider planId={0}>
                <div className="rounded-xl border bg-card shadow-sm">
                  <div className="p-4 sm:p-6">
                    <SnapshotTab
                      planId={0}
                      onSwitchToAdvanced={() => {
                        setShowPlanStructure(true)
                        setShowProjections(false)
                      }}
                      onSwitchToPlanSetup={() => {
                        setShowPlanStructure(true)
                        setShowProjections(false)
                      }}
                    />
                  </div>
                </div>
              </ScenarioProvider>
            )}
          </>
        )}
      </div>
    </>
  )
}

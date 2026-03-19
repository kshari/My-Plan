'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Activity, Settings, ClipboardCheck, Upload, X, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { EMPTY_PROFILE, type DemographicProfile, type PulseCheck } from '@/lib/demographics'
import { useBenchmarks } from '@/lib/hooks/use-benchmarks'
import { useResilienceScore } from '@/lib/hooks/use-resilience-score'
import { useEducationalTriggers } from '@/lib/hooks/use-educational-triggers'
import { ResilienceScore } from './resilience-score'
import { PeerComparisonGrid } from './peer-comparison-grid'
import { DidYouKnowCard } from './did-you-know-card'
import { EducationalTriggers } from './educational-triggers'
import { ExplorationProgress } from './exploration-progress'
import { NetWorthSparkline } from './pulse-check/net-worth-sparkline'
import { PulseCheckHistory } from './pulse-check/pulse-check-history'

const LOCAL_KEY = 'fp_local_profile'

function getLocalProfile(): DemographicProfile | null {
  try {
    const saved = localStorage.getItem(LOCAL_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Record<string, unknown>
    if (Number(parsed.annual_gross_income) > 0) return parsed as unknown as DemographicProfile
    return null
  } catch {
    return null
  }
}

/** Build fp_profiles row from local or in-memory profile. Handles legacy total_non_retirement_savings and missing new fields. */
function profileToRow(profile: Record<string, unknown>, userId: string) {
  const p = profile as any
  return {
    user_id: userId,
    age: Number(p.age) || 35,
    state: p.state ?? '',
    household_type: p.household_type ?? 'single',
    household_size: Number(p.household_size) || 1,
    annual_gross_income: Number(p.annual_gross_income) || 0,
    filing_status: p.filing_status ?? 'single',
    total_retirement_savings: Number(p.total_retirement_savings) || 0,
    emergency_fund: Number(p.emergency_fund ?? p.total_non_retirement_savings) || 0,
    stock_investments: Number(p.stock_investments) || 0,
    real_estate_investments: Number(p.real_estate_investments) || 0,
    monthly_expenses: Number(p.monthly_expenses) || 0,
    monthly_savings: Number(p.monthly_savings) || 0,
    home_value: p.home_value != null ? Number(p.home_value) : null,
    mortgage_balance: p.mortgage_balance != null ? Number(p.mortgage_balance) : null,
    debts: Array.isArray(p.debts) ? p.debts : [],
    college_529_balance: p.college_529_balance != null ? Number(p.college_529_balance) : null,
    child_ages: Array.isArray(p.child_ages) ? p.child_ages : [],
    subscriptions: Array.isArray(p.subscriptions) ? p.subscriptions : [],
    explored_scenarios: Array.isArray(p.explored_scenarios) ? p.explored_scenarios : [],
    updated_at: new Date().toISOString(),
  }
}

interface PulseDashboardProps {
  userId: string
}

export function PulseDashboard({ userId }: PulseDashboardProps) {
  const [profile, setProfile] = useState<DemographicProfile | null>(null)
  const [lastPulseCheck, setLastPulseCheck] = useState<PulseCheck | null>(null)
  const [pulseChecks, setPulseChecks] = useState<PulseCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [localProfile, setLocalProfile] = useState<DemographicProfile | null>(null)
  const [importing, setImporting] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [profileRes, checksRes] = await Promise.all([
      supabase.from('fp_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('fp_pulse_checks').select('*').eq('user_id', userId).order('check_date', { ascending: false }).limit(24),
    ])
    if (profileRes.data) {
      const d = profileRes.data
      setProfile({
        ...EMPTY_PROFILE,
        ...d,
        debts: Array.isArray(d.debts) ? d.debts : [],
        subscriptions: Array.isArray(d.subscriptions) ? d.subscriptions : [],
        child_ages: Array.isArray(d.child_ages) ? d.child_ages : [],
        explored_scenarios: Array.isArray(d.explored_scenarios) ? d.explored_scenarios : [],
      })
    } else {
      setProfile(null)
    }
    const checks = (checksRes.data ?? []) as PulseCheck[]
    setPulseChecks(checks)
    setLastPulseCheck(checks[0] ?? null)
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    setLocalProfile(getLocalProfile())
  }, [])

  const handleImport = useCallback(async () => {
    if (!localProfile) return
    setImporting(true)
    const row = profileToRow(localProfile as unknown as Record<string, unknown>, userId)
    const { error } = await supabase.from('fp_profiles').upsert(row, { onConflict: 'user_id' })
    if (error) {
      toast.error('Failed to import profile')
    } else {
      toast.success('Profile imported from try mode!')
      try { localStorage.removeItem(LOCAL_KEY) } catch {}
      setLocalProfile(null)
      await loadData()
    }
    setImporting(false)
  }, [localProfile, supabase, userId, loadData])

  const handleDismissImport = useCallback(() => {
    setDismissed(true)
  }, [])

  const comparisons = useBenchmarks(profile)
  const score = useResilienceScore(profile)
  const triggers = useEducationalTriggers(profile, score, lastPulseCheck)

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const showImportBanner = localProfile && !dismissed

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/30">
            <Activity className="h-7 w-7 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Financial Pulse</h1>

          {showImportBanner ? (
            <>
              <p className="mx-auto max-w-md text-muted-foreground">
                We found financial data you saved while trying the app. Import it to get started instantly.
              </p>
              <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-5 max-w-sm mx-auto text-left space-y-3">
                <div className="flex items-start gap-3">
                  <Upload className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Import your try mode data</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Age {localProfile.age}, ${localProfile.annual_gross_income.toLocaleString()}/yr income, {localProfile.explored_scenarios.length} scenarios explored
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={importing}
                    onClick={handleImport}
                    className="bg-orange-600 hover:bg-orange-700 text-white flex-1"
                  >
                    {importing ? 'Importing...' : 'Import & Continue'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDismissImport}
                  >
                    Start Fresh
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mx-auto max-w-md text-muted-foreground">
                Set up your financial profile to unlock personalized benchmarks, the Financial Learning Lab, and monthly reflections.
              </p>
              <Link href="/apps/pulse/profile">
                <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white mt-2">
                  Create Your Profile
                </Button>
              </Link>
            </>
          )}

          <div className="mt-8">
            <DidYouKnowCard />
          </div>
        </div>
      </div>
    )
  }

  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
    : `$${n}`

  const householdLabel = profile.household_type === 'single'
    ? 'Single'
    : profile.household_type === 'married'
      ? `Married${profile.household_size > 2 ? `, ${profile.household_size}` : ''}`
      : `Household ${profile.household_size}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header + Pulse Check */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Pulse</h1>
          <p className="text-sm text-muted-foreground">Know where you stand. See what&apos;s possible.</p>
        </div>
        <Link href="/apps/pulse/pulse-check" className="shrink-0">
          <Button variant="outline" size="sm">
            <ClipboardCheck className="h-4 w-4 mr-1.5" /> Pulse Check
          </Button>
        </Link>
      </div>

      {/* Assumptions banner with Edit Profile inside */}
      <div className="rounded-xl border bg-muted/30 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              <span className="text-muted-foreground">Age</span>
              <span className="font-semibold">{profile.age}</span>
            </div>
            {profile.state && (
              <div>
                <span className="text-muted-foreground">State</span>
                <span className="ml-1.5 font-semibold">{profile.state}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Household</span>
              <span className="ml-1.5 font-semibold">{householdLabel}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Filing</span>
              <span className="ml-1.5 font-semibold">{profile.filing_status.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Income</span>
              <span className="ml-1.5 font-semibold">{profile.annual_gross_income > 0 ? fmt(profile.annual_gross_income) + '/yr' : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retirement</span>
              <span className="ml-1.5 font-semibold">{profile.total_retirement_savings > 0 ? fmt(profile.total_retirement_savings) : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Emergency</span>
              <span className="ml-1.5 font-semibold">{profile.emergency_fund > 0 ? fmt(profile.emergency_fund) : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expenses</span>
              <span className="ml-1.5 font-semibold">{profile.monthly_expenses > 0 ? fmt(profile.monthly_expenses) + '/mo' : '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Savings</span>
              <span className="ml-1.5 font-semibold">{profile.monthly_savings > 0 ? fmt(profile.monthly_savings) + '/mo' : '—'}</span>
            </div>
            {(profile.home_value != null && profile.home_value > 0) && (
              <div>
                <span className="text-muted-foreground">Home equity</span>
                <span className="ml-1.5 font-semibold">
                  {fmt(Math.max(0, (profile.home_value ?? 0) - (profile.mortgage_balance ?? 0)))}
                </span>
              </div>
            )}
            {(profile.debts?.length > 0 && profile.debts.some((d) => d.balance > 0)) && (
              <div>
                <span className="text-muted-foreground">Debt</span>
                <span className="ml-1.5 font-semibold">
                  {fmt(profile.debts.reduce((s, d) => s + (d.balance ?? 0), 0))}
                </span>
              </div>
            )}
            {(profile.stock_investments > 0 || profile.real_estate_investments > 0) && (
              <div>
                <span className="text-muted-foreground">Investments</span>
                <span className="ml-1.5 font-semibold">
                  {[
                    profile.stock_investments > 0 && fmt(profile.stock_investments),
                    profile.real_estate_investments > 0 && fmt(profile.real_estate_investments),
                  ].filter(Boolean).join(' + ')}
                </span>
              </div>
            )}
        </div>
        <Link href="/apps/pulse/profile" className="shrink-0 ml-auto">
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Settings className="h-3.5 w-3.5 mr-1" /> Edit Profile
          </Button>
        </Link>
      </div>

      {/* Import banner for existing users with local data */}
      {showImportBanner && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 p-4 flex items-start gap-3">
          <Upload className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Try mode data found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You have a profile saved from try mode. Import it to overwrite your current profile, or dismiss.
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={importing}
                onClick={handleImport}
                className="text-xs h-7"
              >
                {importing ? 'Importing...' : 'Import try mode data'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismissImport}
                className="text-xs h-7"
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  try { localStorage.removeItem('fp_local_profile') } catch {}
                  handleDismissImport()
                  toast.success('Try mode data cleared.')
                }}
                className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Clear Data
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismissImport}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Exploration progress */}
      <ExplorationProgress explored={profile.explored_scenarios} />

      {/* Triggers */}
      <EducationalTriggers triggers={triggers} />

      {/* Resilience Score */}
      {score && <ResilienceScore score={score} />}

      {/* Fun fact */}
      <DidYouKnowCard />

      {/* Peer Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-3">How You Compare</h2>
        <PeerComparisonGrid comparisons={comparisons} />
      </div>

      {/* Net Worth Sparkline */}
      <NetWorthSparkline checks={pulseChecks} />

      {/* Quick scenario links */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Financial Learning Lab</h2>
        <p className="text-sm text-muted-foreground mb-4">Drag sliders, watch charts move, build intuition.</p>
        <Link href="/apps/pulse/scenarios">
          <Button variant="outline">Explore All Scenarios</Button>
        </Link>
      </div>

      {/* Pulse Check History */}
      <div>
        <PulseCheckHistory
          checks={pulseChecks}
          userId={userId}
          onRefresh={loadData}
        />
      </div>
    </div>
  )
}

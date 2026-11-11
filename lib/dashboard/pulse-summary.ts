import type { SupabaseClient } from '@supabase/supabase-js'
import { computeResilienceScore, computeNetWorth } from '@/lib/utils/pulse-calculations'
import { BENCHMARK_DATA } from '@/lib/constants/benchmark-data'
import { EMPTY_PROFILE, type DemographicProfile } from '@/lib/demographics'
import { SCENARIO_METADATA } from '@/lib/constants/pulse-defaults'
import type { AppSummary, MetricTone } from './types'

const TOTAL_SCENARIOS = SCENARIO_METADATA.length

function profileCompleteness(p: DemographicProfile): number {
  let filled = 0
  const total = 8
  if (p.age > 0) filled++
  if (p.state) filled++
  if (p.annual_gross_income > 0) filled++
  if (p.monthly_expenses > 0) filled++
  if (p.monthly_savings > 0) filled++
  if (p.total_retirement_savings > 0 || p.emergency_fund > 0 || p.stock_investments > 0 || p.real_estate_investments > 0) filled++
  if (p.home_value !== null || p.debts.length > 0) filled++
  if (p.household_type !== 'single' || p.household_size > 1) filled++
  return Math.round((filled / total) * 100)
}

export async function computePulseSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppSummary> {
  const [profileRes, checksRes] = await Promise.all([
    supabase.from('fp_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('fp_pulse_checks')
      .select('resilience_score, net_worth_snapshot, check_date, mood')
      .eq('user_id', userId)
      .order('check_date', { ascending: false })
      .limit(1),
  ])

  const profileData = profileRes.data
  const latestCheck = checksRes.data?.[0] ?? null
  const started = !!profileData || !!latestCheck

  if (!profileData) {
    return {
      app: 'pulse',
      started: false,
      setup: {
        steps: [
          { label: 'Create your profile', done: false },
          { label: 'Explore scenarios (0/' + TOTAL_SCENARIOS + ')', done: false },
          { label: 'Complete a pulse check', done: !!latestCheck },
        ],
        pctComplete: latestCheck ? 33 : 0,
      },
      metrics: [],
      primaryCta: { label: 'Set up your profile', href: '/apps/pulse/profile' },
    }
  }

  const profile: DemographicProfile = {
    ...EMPTY_PROFILE,
    ...profileData,
    debts: Array.isArray(profileData.debts) ? profileData.debts : [],
    subscriptions: Array.isArray(profileData.subscriptions) ? profileData.subscriptions : [],
    child_ages: Array.isArray(profileData.child_ages) ? profileData.child_ages : [],
    explored_scenarios: Array.isArray(profileData.explored_scenarios) ? profileData.explored_scenarios : [],
  }

  const explored = profile.explored_scenarios.length
  const profilePct = profileCompleteness(profile)
  const hasPulseCheck = !!latestCheck
  const resilienceScore = computeResilienceScore(profile, BENCHMARK_DATA).total
  const netWorth = computeNetWorth(profile)

  const steps = [
    { label: `Profile ${profilePct}% complete`, done: profilePct >= 80 },
    { label: `Scenarios explored (${explored}/${TOTAL_SCENARIOS})`, done: explored >= TOTAL_SCENARIOS },
    { label: 'Monthly pulse check', done: hasPulseCheck },
  ]
  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100)

  const metrics = [
    {
      label: 'Resilience Score',
      value: String(resilienceScore),
      tone: (resilienceScore >= 70 ? 'positive' : resilienceScore >= 45 ? 'neutral' : 'warning') as MetricTone,
    },
    {
      label: 'Net Worth',
      value: formatCurrencyShort(netWorth),
      tone: (netWorth >= 0 ? 'positive' : 'negative') as MetricTone,
    },
    ...(hasPulseCheck
      ? [
          {
            label: 'Last Check',
            value: formatDate(latestCheck.check_date),
            tone: 'neutral' as MetricTone,
          },
        ]
      : []),
    ...(explored > 0
      ? [
          {
            label: 'Scenarios',
            value: `${explored}/${TOTAL_SCENARIOS}`,
            tone: (explored >= TOTAL_SCENARIOS ? 'positive' : 'neutral') as MetricTone,
          },
        ]
      : []),
  ]

  const nextHref = !hasPulseCheck
    ? '/apps/pulse/pulse-check'
    : explored < TOTAL_SCENARIOS
    ? '/apps/pulse/scenarios'
    : '/apps/pulse/dashboard'

  const ctaLabel = !hasPulseCheck
    ? 'Do this month\'s pulse check'
    : explored < TOTAL_SCENARIOS
    ? 'Continue Learning Lab'
    : 'View Pulse Dashboard'

  return {
    app: 'pulse',
    started,
    setup: { steps, pctComplete: donePct },
    metrics,
    primaryCta: { label: ctaLabel, href: nextHref },
    netWorth,
  }
}

function formatCurrencyShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import { computeScenarioMetrics } from '@/lib/property/compute-metrics'
import { computeScoreOnly, DEFAULT_SCORING_CONFIG } from '@/lib/property/scoring'
import type { AppSummary, MetricTone } from './types'

export async function computePropertySummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppSummary> {
  const { data: properties } = await supabase
    .from('pi_properties')
    .select('id, address, listing_status, deal_stage, "Asking Price", current_market_value')
    .eq('user_id', userId)

  if (!properties || properties.length === 0) {
    return {
      app: 'property',
      started: false,
      setup: {
        steps: [
          { label: 'Add your first property', done: false },
          { label: 'Set up base scenario', done: false },
        ],
        pctComplete: 0,
      },
      metrics: [],
      primaryCta: { label: 'Add a property', href: '/apps/property/properties/new' },
    }
  }

  const propertyIds = properties.map((p) => p.id)

  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .in('Property ID', propertyIds)
    .eq('is_base', true)

  const hasBaseScenario = scenarios && scenarios.length > 0

  const steps = [
    { label: `${properties.length} propert${properties.length > 1 ? 'ies' : 'y'} added`, done: true },
    { label: 'Base scenario set up', done: !!hasBaseScenario },
  ]
  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100)

  if (!hasBaseScenario) {
    const metrics = [
      { label: 'Properties', value: String(properties.length), tone: 'neutral' as const },
    ]
    return {
      app: 'property',
      started: true,
      setup: { steps, pctComplete: donePct },
      metrics,
      primaryCta: {
        label: 'Set up a base scenario',
        href: `/apps/property/properties/${propertyIds[0]}`,
      },
    }
  }

  // Compute per-scenario metrics
  const computedScenarios = scenarios.map((s) => {
    try {
      const m = computeScenarioMetrics(s as Record<string, unknown>)
      const score = computeScoreOnly(DEFAULT_SCORING_CONFIG, {
        capRate: m.capRate,
        roi: m.cocr,
        annualCashFlow: m.firstYearCF,
        noiForCalcs: m.noi,
        onePercentRatio: m.onePercent,
        grm: m.grm,
      })
      return { metrics: m, score }
    } catch {
      return null
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const totalProperties = properties.length

  // Only count value for properties that have been purchased/closed
  const OWNED_STAGES = ['closing', 'rehab', 'market', 'operate']
  const ownedProperties = properties.filter((p) =>
    OWNED_STAGES.includes(p.deal_stage ?? 'lead')
  )
  const totalPortfolioValue = ownedProperties.reduce((sum, p) => {
    const cmv = (p as Record<string, unknown>).current_market_value as number | null
    const ask = p['Asking Price']
    return sum + (cmv != null && cmv > 0 ? Number(cmv) : ask != null ? Number(ask) : 0)
  }, 0)

  // Cash flow only from owned properties (matched by property id)
  const ownedIds = new Set(ownedProperties.map((p) => p.id))
  const ownedScenarios = computedScenarios.filter((_, i) =>
    ownedIds.has(scenarios[i]?.['Property ID'] as number)
  )
  const totalMonthlyCF = ownedScenarios.reduce((sum, s) => sum + s.metrics.monthlyCF, 0)
  const avgCapRate =
    ownedScenarios.length > 0
      ? ownedScenarios.reduce((sum, s) => sum + s.metrics.capRate, 0) / ownedScenarios.length
      : null
  const bestScore =
    computedScenarios.length > 0
      ? Math.max(...computedScenarios.map((s) => s.score))
      : null

  // Pipeline stage counts
  const underContract = properties.filter((p) =>
    ['contract', 'closing'].includes(p.deal_stage ?? '')
  ).length
  const inPipeline = properties.filter((p) =>
    ['lead', 'analyzing', 'offer'].includes(p.deal_stage ?? 'lead')
  ).length

  const metrics = [
    { label: 'Owned', value: String(ownedProperties.length), tone: 'neutral' as MetricTone },
    ...(inPipeline > 0
      ? [{ label: 'In Pipeline', value: String(inPipeline), tone: 'neutral' as MetricTone }]
      : []),
    ...(underContract > 0
      ? [{ label: 'Under Contract', value: String(underContract), tone: 'positive' as MetricTone }]
      : []),
    ...(totalPortfolioValue > 0
      ? [{ label: 'Portfolio Value', value: formatCurrencyShort(totalPortfolioValue), tone: 'positive' as MetricTone }]
      : []),
    ...(avgCapRate != null
      ? [
          {
            label: 'Avg Cap Rate',
            value: `${avgCapRate.toFixed(1)}%`,
            tone: (avgCapRate >= 6 ? 'positive' : avgCapRate >= 4 ? 'neutral' : 'warning') as MetricTone,
          },
        ]
      : []),
    {
      label: 'Monthly Cash Flow',
      value: formatCurrencyShort(totalMonthlyCF),
      tone: (totalMonthlyCF >= 0 ? 'positive' : 'negative') as MetricTone,
    },
    ...(bestScore != null
      ? [
          {
            label: 'Best Score',
            value: String(bestScore),
            tone: (bestScore >= 65 ? 'positive' : bestScore >= 45 ? 'neutral' : 'warning') as MetricTone,
          },
        ]
      : []),
  ]

  return {
    app: 'property',
    started: true,
    setup: { steps, pctComplete: donePct },
    metrics,
    primaryCta: { label: 'View Pipeline', href: '/apps/property/pipeline' },
    netWorth: totalPortfolioValue > 0 ? totalPortfolioValue : undefined,
  }
}

function formatCurrencyShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

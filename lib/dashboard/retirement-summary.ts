import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppSummary, MetricTone } from './types'

export async function computeRetirementSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppSummary> {
  const { data: plans } = await supabase
    .from('rp_retirement_plans')
    .select('id, plan_name')
    .eq('user_id', userId)

  if (!plans || plans.length === 0) {
    return {
      app: 'retirement',
      started: false,
      setup: {
        steps: [
          { label: 'Create your first plan', done: false },
          { label: 'Run Quick Analysis', done: false },
        ],
        pctComplete: 0,
      },
      metrics: [],
      primaryCta: { label: 'Create your first plan', href: '/apps/retirement/plans/new' },
    }
  }

  const planIds = plans.map((p) => p.id)

  const { data: metricsRows } = await supabase
    .from('rp_plan_metrics')
    .select(
      'plan_id, retirement_score, confidence_score, status, monthly_income, years_money_lasts, networth_at_retirement, retirement_age',
    )
    .in('plan_id', planIds)

  const hasMetrics = metricsRows && metricsRows.length > 0

  const steps = [
    { label: `${plans.length} plan${plans.length > 1 ? 's' : ''} created`, done: true },
    { label: 'Quick Analysis run', done: !!hasMetrics },
  ]
  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100)

  if (!hasMetrics) {
    return {
      app: 'retirement',
      started: true,
      setup: { steps, pctComplete: donePct },
      metrics: [{ label: 'Plans', value: String(plans.length), tone: 'neutral' }],
      primaryCta: {
        label: 'Run Quick Analysis',
        href: `/apps/retirement/plans/${planIds[0]}?tab=quick-analysis`,
      },
    }
  }

  // Pick the best plan: highest retirement score, then highest confidence score
  const best = metricsRows.reduce((prev, cur) => {
    const prevScore = prev.retirement_score ?? prev.confidence_score ?? 0
    const curScore = cur.retirement_score ?? cur.confidence_score ?? 0
    return curScore > prevScore ? cur : prev
  })

  const score = best.retirement_score ?? best.confidence_score
  const scoreTone: MetricTone =
    best.status === 'on-track' ? 'positive' : best.status === 'close' ? 'warning' : 'negative'

  const metrics = [
    { label: 'Plans', value: String(plans.length), tone: 'neutral' as MetricTone },
    ...(score != null
      ? [{ label: 'Retirement Score', value: String(Math.round(score)), tone: scoreTone }]
      : []),
    ...(best.monthly_income != null
      ? [{ label: 'Monthly Income', value: formatCurrencyShort(best.monthly_income), tone: 'neutral' as MetricTone }]
      : []),
    ...(best.years_money_lasts != null
      ? [
          {
            label: 'Longevity',
            value: `${Math.round(best.years_money_lasts)} yrs`,
            tone: (best.years_money_lasts >= 25 ? 'positive' : 'warning') as MetricTone,
          },
        ]
      : []),
  ]

  const bestPlanId = best.plan_id
  const netWorth = best.networth_at_retirement ?? undefined

  return {
    app: 'retirement',
    started: true,
    setup: { steps, pctComplete: donePct },
    metrics,
    primaryCta: {
      label: 'View Retirement Plan',
      href: `/apps/retirement/plans/${bestPlanId}?tab=quick-analysis`,
    },
    netWorth: netWorth ?? undefined,
  }
}

function formatCurrencyShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

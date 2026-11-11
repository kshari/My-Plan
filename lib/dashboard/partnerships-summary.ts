import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppSummary, MetricTone } from './types'

export async function computePartnershipsSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppSummary> {
  const { data: memberships } = await supabase
    .from('pt_members')
    .select('entity_id, role, status')
    .eq('user_id', userId)

  if (!memberships || memberships.length === 0) {
    return {
      app: 'partnerships',
      started: false,
      setup: {
        steps: [
          { label: 'Create an entity', done: false },
          { label: 'Invite members', done: false },
          { label: 'Add an investment', done: false },
        ],
        pctComplete: 0,
      },
      metrics: [],
      primaryCta: { label: 'Create an entity', href: '/apps/partnerships/new' },
    }
  }

  const entityIds = [...new Set(memberships.map((m) => m.entity_id))]

  const [entitiesRes, membersRes, investmentsRes, capitalRes] = await Promise.all([
    supabase
      .from('pt_entities')
      .select('id, name, status, cash_balance')
      .in('id', entityIds),
    supabase
      .from('pt_members')
      .select('entity_id, user_id, status')
      .in('entity_id', entityIds),
    supabase
      .from('pt_investments')
      .select('entity_id, target_amount, num_shares, market_price_per_share, status, current_stage')
      .in('entity_id', entityIds),
    supabase
      .from('pt_capital_events')
      .select('entity_id, event_type, amount')
      .in('entity_id', entityIds)
      .eq('event_type', 'contribution'),
  ])

  const entities = entitiesRes.data ?? []
  const allMembers = membersRes.data ?? []
  const investments = investmentsRes.data ?? []
  const capitalEvents = capitalRes.data ?? []

  const hasInvitations = allMembers.length > 1
  const activeInvestments = investments.filter((i) => i.status === 'active')

  const steps = [
    { label: `${entities.length} entit${entities.length !== 1 ? 'ies' : 'y'}`, done: true },
    { label: 'Members invited', done: hasInvitations },
    { label: 'Investment added', done: investments.length > 0 },
  ]
  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100)

  const totalCapital = capitalEvents.reduce((sum, ev) => sum + Number(ev.amount), 0)
  const totalInvested = investments.reduce((s, i) => s + (i.target_amount ?? 0), 0)
  const totalCurrentValue = investments.reduce((s, i) => {
    if (i.num_shares != null && i.num_shares > 0 && i.market_price_per_share != null) {
      return s + i.num_shares * i.market_price_per_share
    }
    return s + (i.target_amount ?? 0)
  }, 0)
  const totalCash = entities.reduce((s, e) => s + (e.cash_balance ?? 0), 0)
  const portfolioValue = totalCurrentValue + totalCash

  const portfolioReturn = totalCapital > 0 ? ((portfolioValue - totalCapital) / totalCapital) * 100 : null

  const metrics = [
    { label: 'Entities', value: String(entities.length), tone: 'neutral' as MetricTone },
    ...(totalCapital > 0
      ? [{ label: 'Capital Contributed', value: formatCurrencyShort(totalCapital), tone: 'neutral' as MetricTone }]
      : []),
    ...(portfolioValue > 0
      ? [{ label: 'Portfolio Value', value: formatCurrencyShort(portfolioValue), tone: 'positive' as MetricTone }]
      : []),
    ...(portfolioReturn != null
      ? [
          {
            label: 'Return',
            value: `${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(1)}%`,
            tone: (portfolioReturn >= 0 ? 'positive' : 'negative') as MetricTone,
          },
        ]
      : []),
    ...(activeInvestments.length > 0
      ? [{ label: 'Active Investments', value: String(activeInvestments.length), tone: 'positive' as MetricTone }]
      : []),
  ]

  const ctaHref =
    !hasInvitations
      ? `/apps/partnerships/${entityIds[0]}/members`
      : investments.length === 0
      ? `/apps/partnerships/${entityIds[0]}/investments/new`
      : `/apps/partnerships/${entityIds[0]}`

  const ctaLabel =
    !hasInvitations
      ? 'Invite members'
      : investments.length === 0
      ? 'Add an investment'
      : 'View entity dashboard'

  return {
    app: 'partnerships',
    started: true,
    setup: { steps, pctComplete: donePct },
    metrics,
    primaryCta: { label: ctaLabel, href: ctaHref },
    netWorth: portfolioValue > 0 ? portfolioValue : undefined,
  }
}

function formatCurrencyShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

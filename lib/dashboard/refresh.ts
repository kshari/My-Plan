import type { SupabaseClient } from '@supabase/supabase-js'
import { computePulseSummary } from './pulse-summary'
import { computeRetirementSummary } from './retirement-summary'
import { computePropertySummary } from './property-summary'
import { computePartnershipsSummary } from './partnerships-summary'
import { computeFamilySummary } from './family-summary'
import type { AppId, AppSummary, CachedSetupState, CachedMetrics } from './types'

export type { AppId }

async function computeSummary(
  supabase: SupabaseClient,
  userId: string,
  app: AppId,
): Promise<AppSummary> {
  switch (app) {
    case 'pulse':
      return computePulseSummary(supabase, userId)
    case 'retirement':
      return computeRetirementSummary(supabase, userId)
    case 'property':
      return computePropertySummary(supabase, userId)
    case 'partnerships':
      return computePartnershipsSummary(supabase, userId)
    case 'family':
      return computeFamilySummary(supabase, userId)
  }
}

/**
 * Recomputes an app summary and upserts the result into `home_dashboard_metrics`.
 * Fire-and-forget: callers can `void refreshAppSummary(...)` without awaiting.
 */
export async function refreshAppSummary(
  supabase: SupabaseClient,
  userId: string,
  app: AppId,
): Promise<AppSummary> {
  const summary = await computeSummary(supabase, userId, app)

  const setupState: CachedSetupState = summary.setup
  const metricsCache: CachedMetrics = {
    items: summary.metrics,
    netWorth: summary.netWorth,
    started: summary.started,
  }

  await supabase.from('home_dashboard_metrics').upsert(
    {
      user_id: userId,
      app,
      setup_state: setupState,
      metrics: metricsCache,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,app' },
  )

  return summary
}

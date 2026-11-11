import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshAppSummary } from './refresh'
import type { AppId, AppSummary, CachedSetupState, CachedMetrics } from './types'

const ALL_APPS: AppId[] = ['pulse', 'retirement', 'property', 'partnerships', 'family']

/** Cache rows older than this will be recomputed. */
const STALE_MS = 10 * 60 * 1000 // 10 minutes

interface CacheRow {
  user_id: string
  app: string
  setup_state: CachedSetupState
  metrics: CachedMetrics
  updated_at: string
}

function rowToSummary(row: CacheRow): AppSummary {
  const cached = row.metrics as CachedMetrics
  return {
    app: row.app as AppId,
    started: cached.started ?? false,
    setup: row.setup_state as CachedSetupState,
    metrics: cached.items ?? [],
    primaryCta: defaultCta(row.app as AppId),
    netWorth: cached.netWorth,
  }
}

function defaultCta(app: AppId): { label: string; href: string } {
  switch (app) {
    case 'pulse':
      return { label: 'Open Pulse', href: '/apps/pulse/dashboard' }
    case 'retirement':
      return { label: 'Open Retirement', href: '/apps/retirement/dashboard' }
    case 'property':
      return { label: 'Open Property', href: '/apps/property/dashboard' }
    case 'partnerships':
      return { label: 'Open Partnerships', href: '/apps/partnerships' }
    case 'family':
      return { label: 'Plan Activities', href: '/apps/family' }
  }
}

/**
 * Returns summaries for all 4 apps for a given user.
 * - Reads from the `home_dashboard_metrics` cache.
 * - For any missing or stale rows, recomputes and upserts before returning.
 */
export async function getHomeDashboard(
  supabase: SupabaseClient,
  userId: string,
): Promise<AppSummary[]> {
  const { data: rows } = await supabase
    .from('home_dashboard_metrics')
    .select('user_id, app, setup_state, metrics, updated_at')
    .eq('user_id', userId)

  const cacheMap = new Map<AppId, CacheRow>()
  for (const row of rows ?? []) {
    cacheMap.set(row.app as AppId, row as CacheRow)
  }

  const now = Date.now()
  const results: AppSummary[] = []

  await Promise.all(
    ALL_APPS.map(async (app) => {
      const cached = cacheMap.get(app)
      const isStale =
        !cached ||
        now - new Date(cached.updated_at).getTime() > STALE_MS

      if (isStale) {
        const summary = await refreshAppSummary(supabase, userId, app)
        results.push(summary)
      } else {
        results.push(rowToSummary(cached))
      }
    }),
  )

  // Maintain stable order
  return ALL_APPS.map((app) => results.find((s) => s.app === app)!)
}

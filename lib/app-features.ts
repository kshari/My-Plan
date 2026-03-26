import type { SupabaseClient } from '@supabase/supabase-js'

export type AppEnvironment = 'local' | 'staging' | 'production'
export type ReleaseStage = 'beta' | 'ga'

export const APP_ENVIRONMENTS: AppEnvironment[] = ['local', 'staging', 'production']

export type FeatureFlags = {
  aiAgent: boolean
}

export interface BetaInvitation {
  feature_id: string
  feature_name: string
  environment: string
  status: 'invited' | 'accepted' | 'revoked'
  invited_at: string
}

const FEATURE_IDS = ['ai_agent'] as const

/**
 * Current app environment. Set APP_ENV (or NEXT_PUBLIC_APP_ENV) to
 * 'local' | 'staging' | 'production'. Defaults to 'production' if unset.
 */
export function getAppEnvironment(): AppEnvironment {
  const env = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? ''
  const normalized = env.toLowerCase()
  if (normalized === 'local' || normalized === 'staging' || normalized === 'production') {
    return normalized
  }
  return 'production'
}

/**
 * Fetches feature flags for the current environment from the database.
 * When userId is provided, beta features are only enabled if the user
 * has an accepted beta_access row. Without userId, beta features are off.
 */
export async function getFeatureFlags(
  supabase: SupabaseClient,
  userId?: string
): Promise<FeatureFlags> {
  const environment = getAppEnvironment()
  const { data: rows } = await supabase
    .from('app_features')
    .select('id, enabled, release_stage')
    .eq('environment', environment)
    .in('id', [...FEATURE_IDS])

  // For beta features, check if this user has accepted access
  let betaAccepted = new Set<string>()
  if (userId) {
    const betaFeatureIds = (rows ?? [])
      .filter((r) => r.release_stage === 'beta' && r.enabled)
      .map((r) => r.id)

    if (betaFeatureIds.length > 0) {
      const { data: accessRows } = await supabase
        .from('beta_access')
        .select('feature_id')
        .eq('environment', environment)
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .in('feature_id', betaFeatureIds)

      betaAccepted = new Set((accessRows ?? []).map((r) => r.feature_id))
    }
  }

  const map = new Map<string, boolean>()
  for (const row of rows ?? []) {
    if (!row.enabled) {
      map.set(row.id, false)
    } else if (row.release_stage === 'beta') {
      map.set(row.id, betaAccepted.has(row.id))
    } else {
      map.set(row.id, true)
    }
  }

  return {
    aiAgent: map.get('ai_agent') ?? true,
  }
}

/**
 * Returns pending beta invitations for the user (features they've been
 * invited to but haven't accepted yet).
 */
export async function getPendingBetaInvitations(
  supabase: SupabaseClient,
  userId: string
): Promise<BetaInvitation[]> {
  const environment = getAppEnvironment()

  const { data: rows } = await supabase
    .from('beta_access')
    .select('feature_id, status, invited_at')
    .eq('environment', environment)
    .eq('user_id', userId)
    .eq('status', 'invited')

  if (!rows?.length) return []

  const featureIds = rows.map((r) => r.feature_id)
  const { data: features } = await supabase
    .from('app_features')
    .select('id, name')
    .eq('environment', environment)
    .in('id', featureIds)

  const nameMap = new Map((features ?? []).map((f) => [f.id, f.name]))

  return rows.map((r) => ({
    feature_id: r.feature_id,
    feature_name: nameMap.get(r.feature_id) ?? r.feature_id,
    environment,
    status: r.status,
    invited_at: r.invited_at,
  }))
}

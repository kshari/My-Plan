import type { SupabaseClient } from '@supabase/supabase-js'

export type AppEnvironment = 'local' | 'staging' | 'production'

export const APP_ENVIRONMENTS: AppEnvironment[] = ['local', 'staging', 'production']

export type FeatureFlags = {
  aiAgent: boolean
  /** When true, hybrid router uses WebLLM to classify prompts. When false, uses rule-based classifier. */
  routerLlmClassification: boolean
}

const FEATURE_IDS = ['ai_agent', 'router_llm_classification'] as const

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
 * Used by server components/layouts to pass to client shells.
 */
export async function getFeatureFlags(
  supabase: SupabaseClient
): Promise<FeatureFlags> {
  const environment = getAppEnvironment()
  const { data: rows } = await supabase
    .from('app_features')
    .select('id, enabled')
    .eq('environment', environment)
    .in('id', [...FEATURE_IDS])

  const map = new Map<string, boolean>()
  for (const row of rows ?? []) {
    map.set(row.id, row.enabled === true)
  }

  return {
    aiAgent: map.get('ai_agent') ?? true,
    routerLlmClassification: map.get('router_llm_classification') ?? true,
  }
}

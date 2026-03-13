import { withAuth } from '@/lib/utils/route-handler'
import { getFeatureFlags } from '@/lib/app-features'
import { NextResponse } from 'next/server'

/**
 * GET /api/agent/config
 * Returns agent-related feature flags for the current environment.
 * Used by AgentChat to determine the router classification mode.
 */
export const GET = withAuth(async (_request, { supabase }) => {
  const flags = await getFeatureFlags(supabase)
  return NextResponse.json({
    routerLlmClassification: flags.routerLlmClassification,
  })
})

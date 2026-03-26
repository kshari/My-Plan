import { withAuth } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

/**
 * GET /api/agent/config
 * Returns agent-related configuration for the current environment.
 * routerLlmClassification is an env-level option for the hybrid router,
 * not a user-facing feature flag.
 */
export const GET = withAuth(async (_request) => {
  const useLlm = process.env.ROUTER_LLM_CLASSIFICATION !== 'false'
  return NextResponse.json({
    routerLlmClassification: useLlm,
  })
})

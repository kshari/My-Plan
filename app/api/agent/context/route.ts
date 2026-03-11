import { withAuth } from '@/lib/utils/route-handler'
import { buildAgentContext } from '@/lib/agent/context-builder'
import { resolveContextScope } from '@/lib/agent/context-scope'
import { NextResponse } from 'next/server'

export const GET = withAuth(async (request, { user, supabase }) => {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') ?? ''
  const message = searchParams.get('message') ?? ''

  const scope = resolveContextScope(page, message)
  const context = await buildAgentContext(supabase, user.id, scope)

  return NextResponse.json({
    context,
    scope: {
      domains: scope.domains,
      pageDescription: scope.pageDescription,
      focusedPlanId: scope.focusedPlanId,
      focusedPropertyId: scope.focusedPropertyId,
    },
  })
})

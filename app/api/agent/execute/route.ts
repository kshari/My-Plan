import { withAuth } from '@/lib/utils/route-handler'
import { executeAgentAction, parseAgentActions } from '@/lib/agent/actions'
import { NextResponse } from 'next/server'

export const POST = withAuth(async (request, { user, supabase }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const actions = parseAgentActions(body)
  if (!actions || actions.length === 0) {
    return NextResponse.json({ error: 'Missing or invalid actions array' }, { status: 400 })
  }

  const results: { success: boolean; error?: string }[] = []
  for (const action of actions) {
    const result = await executeAgentAction(supabase, user.id, action)
    results.push(result.success ? { success: true } : { success: false, error: result.error })
  }

  const allOk = results.every((r) => r.success)
  return NextResponse.json(
    { results, status: allOk ? 'success' : 'partial' },
    { status: allOk ? 200 : 207 }
  )
})

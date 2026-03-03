import { withAuth, verifyOwnership } from '@/lib/utils/route-handler'
import { calculateAndSaveProjectionsForScenario } from '@/lib/utils/calculate-projections'
import { DEFAULT_MAX_PROJECTION_AGE } from '@/lib/constants/retirement-defaults'
import { NextResponse } from 'next/server'

export const POST = withAuth(async (request, { user, supabase, params }) => {
  const planId = parseInt(params.id, 10)
  if (Number.isNaN(planId)) {
    return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
  }

  const ownership = await verifyOwnership(supabase, 'rp_retirement_plans', planId, user.id)
  if (ownership instanceof NextResponse) return ownership

  let body: { scenarioId: number; lifeExpectancy?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { scenarioId, lifeExpectancy = DEFAULT_MAX_PROJECTION_AGE } = body
  if (typeof scenarioId !== 'number' || Number.isNaN(scenarioId)) {
    return NextResponse.json({ error: 'scenarioId is required and must be a number' }, { status: 400 })
  }

  await calculateAndSaveProjectionsForScenario(planId, scenarioId, lifeExpectancy, supabase)
  return NextResponse.json({ ok: true }, { status: 200 })
})

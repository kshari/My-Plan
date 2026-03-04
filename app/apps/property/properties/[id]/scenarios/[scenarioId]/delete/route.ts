import { withAuth, verifyOwnership } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

export const DELETE = withAuth(async (request, { user, supabase, params }) => {
  const propertyId = parseInt(params.id)
  const scenarioIdNum = parseInt(params.scenarioId)

  if (isNaN(propertyId) || isNaN(scenarioIdNum)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
  }

  const ownership = await verifyOwnership(supabase, 'pi_properties', propertyId, user.id)
  if (ownership instanceof NextResponse) return ownership

  const { data: scenario, error: scenarioError } = await supabase
    .from('pi_financial_scenarios')
    .select('id')
    .eq('id', scenarioIdNum)
    .eq('Property ID', propertyId)
    .single()

  if (scenarioError || !scenario) {
    return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
  }

  const { error: deleteError } = await supabase
    .from('pi_financial_scenarios')
    .delete()
    .eq('id', scenarioIdNum)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

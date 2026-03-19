import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string }> }

// POST /api/teams/[teamId]/share
// Body: { propertyIds: number[] }
// Copies selected personal properties (with their scenarios and loans) into shared tables.
export async function POST(request: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { propertyIds?: number[] }
  try { body = await request.json() } catch { body = {} }

  if (!body.propertyIds?.length) {
    return NextResponse.json({ error: 'propertyIds array is required' }, { status: 400 })
  }

  // Verify team membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Not a team member' }, { status: 403 })

  // Fetch owned properties
  const { data: properties, error: propErr } = await supabase
    .from('pi_properties')
    .select('*')
    .in('id', body.propertyIds)
    .eq('user_id', user.id)

  if (propErr) return NextResponse.json({ error: propErr.message }, { status: 500 })
  if (!properties?.length) return NextResponse.json({ error: 'No matching properties found' }, { status: 404 })

  const results: { propertyId: number; sharedPropertyId?: number; error?: string }[] = []

  for (const prop of properties) {
    const { id: sourceId, user_id: _uid, import_load_id: _lid, ...propFields } = prop

    const { data: sharedProp, error: shareErr } = await supabase
      .from('team_shared_properties')
      .insert({
        ...propFields,
        team_id: teamId,
        shared_by: user.id,
        last_updated_by: user.id,
        source_property_id: sourceId,
      })
      .select('id')
      .single()

    if (shareErr || !sharedProp) {
      results.push({ propertyId: sourceId, error: shareErr?.message ?? 'Share failed' })
      continue
    }

    // Copy scenarios
    const { data: scenarios } = await supabase
      .from('pi_financial_scenarios')
      .select('*')
      .eq('Property ID', sourceId)

    for (const s of scenarios ?? []) {
      const { id: _sid, 'Property ID': _pid, ...scenarioFields } = s

      const { data: sharedScenario } = await supabase
        .from('team_shared_scenarios')
        .insert({
          ...scenarioFields,
          shared_property_id: sharedProp.id,
          shared_by: user.id,
          last_updated_by: user.id,
        })
        .select('id')
        .single()

      if (!sharedScenario) continue

      // Copy loans
      const { data: loans } = await supabase
        .from('pi_loans')
        .select('*')
        .eq('scenario_id', _sid)

      for (const loan of loans ?? []) {
        const { id: _lid2, scenario_id: _scid, ...loanFields } = loan
        await supabase
          .from('team_shared_loans')
          .insert({ ...loanFields, shared_scenario_id: sharedScenario.id })
      }
    }

    results.push({ propertyId: sourceId, sharedPropertyId: sharedProp.id })
  }

  return NextResponse.json({ results })
}

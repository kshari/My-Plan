import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string }> }

// POST /api/teams/[teamId]/copy-to-personal
// Body: { sharedPropertyId: number }
// Copies a shared property (with scenarios and loans) into the user's personal pi_properties.
export async function POST(request: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { sharedPropertyId?: number }
  try { body = await request.json() } catch { body = {} }

  if (!body.sharedPropertyId) {
    return NextResponse.json({ error: 'sharedPropertyId is required' }, { status: 400 })
  }

  // Fetch shared property (RLS ensures team membership)
  const { data: sharedProp, error: spErr } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('id', body.sharedPropertyId)
    .eq('team_id', teamId)
    .single()

  if (spErr || !sharedProp) return NextResponse.json({ error: 'Shared property not found' }, { status: 404 })

  const {
    id: _sid, team_id: _tid, shared_by: _sb, shared_at: _sa,
    last_updated_by: _lub, source_property_id: _spid,
    created_at: _ca, ...propFields
  } = sharedProp

  const { data: newProp, error: insertErr } = await supabase
    .from('pi_properties')
    .insert({ ...propFields, user_id: user.id })
    .select('id')
    .single()

  if (insertErr || !newProp) return NextResponse.json({ error: insertErr?.message ?? 'Copy failed' }, { status: 500 })

  // Copy scenarios
  const { data: sharedScenarios } = await supabase
    .from('team_shared_scenarios')
    .select('*')
    .eq('shared_property_id', body.sharedPropertyId)

  for (const ss of sharedScenarios ?? []) {
    const {
      id: _ssid, shared_property_id: _spid2, shared_by: _sb2,
      last_updated_by: _lub2, created_at: _sca, ...scenarioFields
    } = ss

    const { data: newScenario } = await supabase
      .from('pi_financial_scenarios')
      .insert({ ...scenarioFields, 'Property ID': newProp.id })
      .select('id')
      .single()

    if (!newScenario) continue

    // Copy loans
    const { data: sharedLoans } = await supabase
      .from('team_shared_loans')
      .select('*')
      .eq('shared_scenario_id', _ssid)

    for (const sl of sharedLoans ?? []) {
      const { id: _slid, shared_scenario_id: _scid, created_at: _lca, ...loanFields } = sl
      await supabase
        .from('pi_loans')
        .insert({ ...loanFields, scenario_id: newScenario.id })
    }
  }

  return NextResponse.json({ propertyId: newProp.id })
}

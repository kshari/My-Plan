import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/teams — list all teams the current user belongs to
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role,
      joined_at,
      teams (
        id, name, description, created_by, created_at,
        team_members ( count )
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ teams: data })
}

// POST /api/teams — create a new team (creator becomes owner)
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; description?: string }
  try { body = await request.json() } catch { body = {} }

  const { name, description } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 })

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), description: description?.trim() || null, created_by: user.id })
    .select()
    .single()

  if (teamErr || !team) return NextResponse.json({ error: teamErr?.message ?? 'Failed to create team' }, { status: 500 })

  // Add creator as owner
  const { error: memberErr } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 })

  return NextResponse.json({ team }, { status: 201 })
}

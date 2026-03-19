import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string }> }

// GET /api/teams/[teamId] — get team details
export async function GET(_req: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('teams')
    .select(`*, team_members(id, user_id, role, joined_at)`)
    .eq('id', teamId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const isMember = data.team_members?.some((m: { user_id: string }) => m.user_id === user.id)
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ team: data })
}

// PATCH /api/teams/[teamId] — update name / description
export async function PATCH(request: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { name?: string; description?: string }
  try { body = await request.json() } catch { body = {} }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description?.trim() || null

  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ team: data })
}

// DELETE /api/teams/[teamId] — delete team (owner only via RLS)
export async function DELETE(_req: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

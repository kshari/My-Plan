import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string; memberId: string }> }

// PATCH /api/teams/[teamId]/members/[memberId] — change role
export async function PATCH(request: Request, { params }: Params) {
  const { teamId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { role?: string }
  try { body = await request.json() } catch { body = {} }

  if (!body.role || !['owner', 'admin', 'member'].includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('team_members')
    .update({ role: body.role })
    .eq('id', memberId)
    .eq('team_id', teamId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

// DELETE /api/teams/[teamId]/members/[memberId] — remove member or leave team
export async function DELETE(_req: Request, { params }: Params) {
  const { teamId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Prevent the last owner from leaving
  const { data: member } = await supabase
    .from('team_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('team_id', teamId)
    .single()

  if (member?.role === 'owner') {
    const { count } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('role', 'owner')

    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last owner. Transfer ownership first.' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('team_id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

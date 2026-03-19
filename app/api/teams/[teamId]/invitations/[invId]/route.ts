import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string; invId: string }> }

// DELETE /api/teams/[teamId]/invitations/[invId] — revoke invitation
export async function DELETE(_req: Request, { params }: Params) {
  const { teamId, invId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', invId)
    .eq('team_id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

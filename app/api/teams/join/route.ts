import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST /api/teams/join — accept an invitation by token
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { token?: string }
  try { body = await request.json() } catch { body = {} }

  if (!body.token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

  // Use admin client to look up the invitation — the broad "pending invite" RLS
  // policy has been dropped; only team members can read team_invitations via RLS.
  const admin = createAdminClient()
  const { data: invitation, error: invErr } = await admin
    .from('team_invitations')
    .select('id, team_id, status, expires_at')
    .eq('invite_token', body.token)
    .single()

  if (invErr || !invitation) return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 })
  if (invitation.status !== 'pending') return NextResponse.json({ error: 'Invitation is no longer valid' }, { status: 400 })
  if (new Date(invitation.expires_at) < new Date()) return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })

  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', invitation.team_id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    const { error: memberErr } = await supabase
      .from('team_members')
      .insert({ team_id: invitation.team_id, user_id: user.id, role: 'member' })

    if (memberErr) return NextResponse.json({ error: 'Failed to join team' }, { status: 500 })
  }

  // Mark invitation accepted via admin client
  await admin
    .from('team_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id)

  return NextResponse.json({ teamId: invitation.team_id })
}

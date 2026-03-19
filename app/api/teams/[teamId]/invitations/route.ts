import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ teamId: string }> }

// GET /api/teams/[teamId]/invitations — list active invitations
export async function GET(_req: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('team_invitations')
    .select('id, invite_email, invite_token, status, expires_at, created_at, invited_by')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitations: data })
}

// POST /api/teams/[teamId]/invitations — create an invitation
export async function POST(request: Request, { params }: Params) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { email?: string }
  try { body = await request.json() } catch { body = {} }

  const { data: invitation, error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: teamId,
      invited_by: user.id,
      invite_email: body.email?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error || !invitation) return NextResponse.json({ error: error?.message ?? 'Failed to create invitation' }, { status: 500 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const joinLink = `${siteUrl}/teams/join?token=${invitation.invite_token}`

  // Optional: send email via Resend if email is provided
  if (body.email?.trim() && process.env.RESEND_API_KEY) {
    try {
      const teamResult = await supabase.from('teams').select('name').eq('id', teamId).single()
      const teamName = teamResult.data?.name ?? 'a team'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@my-plan.app',
          to: body.email.trim(),
          subject: `You've been invited to join ${teamName} on My Plan`,
          html: `
            <p>You've been invited to join <strong>${teamName}</strong> on My Plan.</p>
            <p><a href="${joinLink}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">Accept Invitation</a></p>
            <p style="color:#6b7280;font-size:12px;margin-top:16px;">This link expires in 7 days. If you did not expect this invitation, you can ignore this email.</p>
          `,
        }),
      })
    } catch {
      // Email failure is non-fatal — invitation link is still returned
    }
  }

  return NextResponse.json({ invitation, joinLink }, { status: 201 })
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAdmin } from '@/lib/utils/auth'
import { getAppEnvironment } from '@/lib/app-features'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin } = await checkAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const featureId = searchParams.get('featureId')
  const environment = searchParams.get('environment') ?? getAppEnvironment()

  const admin = createAdminClient()

  let query = admin
    .from('beta_access')
    .select('id, feature_id, environment, user_id, status, invited_at, accepted_at')
    .eq('environment', environment)
    .order('invited_at', { ascending: false })

  if (featureId) query = query.eq('feature_id', featureId)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch user emails from auth.users via admin API
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))]
  const userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
    for (const u of users) {
      if (userIds.includes(u.id) && u.email) {
        userMap[u.id] = u.email
      }
    }
  }

  const enriched = (rows ?? []).map((r) => ({
    ...r,
    user_email: userMap[r.user_id] ?? null,
  }))

  return NextResponse.json({ users: enriched })
}

/**
 * POST: Invite a user to beta.
 * Body: { featureId, environment, email }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { featureId?: string; environment?: string; email?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { featureId, environment, email } = body
  if (!featureId || !environment || !email) {
    return NextResponse.json({ error: 'featureId, environment, and email are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Look up user by email via auth.users
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const targetUser = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!targetUser) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 })
  }

  const { data: row, error } = await admin
    .from('beta_access')
    .upsert(
      {
        feature_id: featureId,
        environment,
        user_id: targetUser.id,
        status: 'invited',
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        accepted_at: null,
      },
      { onConflict: 'feature_id,environment,user_id' }
    )
    .select('id, feature_id, environment, user_id, status, invited_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch feature name for the email
  const { data: featureRow } = await admin
    .from('app_features')
    .select('name')
    .eq('id', featureId)
    .eq('environment', environment)
    .single()
  const featureName = featureRow?.name ?? featureId

  // Send invitation email via Resend
  let emailSent = false
  if (targetUser.email && process.env.RESEND_API_KEY) {
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@my-plan.app',
          to: targetUser.email,
          subject: `You're invited to try ${featureName} (Beta)`,
          html: `
            <p>Hi,</p>
            <p>You've been invited to try <strong>${featureName}</strong>, a new beta feature on My Plan.</p>
            <p>To enable it, log in and look for the beta invitation banner at the top of the page, or visit your settings.</p>
            <p><a href="${siteUrl}" style="display:inline-block;padding:10px 20px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Open My Plan</a></p>
            <p style="color:#666;font-size:13px;">If you didn't expect this invitation, you can safely ignore this email.</p>
          `,
        }),
      })
      emailSent = emailRes.ok
      if (!emailRes.ok) {
        const errBody = await emailRes.text()
        console.error('Resend email failed:', emailRes.status, errBody)
      }
    } catch (e) {
      console.error('Failed to send beta invite email:', e)
    }
  }

  return NextResponse.json({ ...row, user_email: targetUser.email, emailSent })
}

/**
 * DELETE: Revoke beta access.
 * Body: { id }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  let body: { id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await admin
    .from('beta_access')
    .delete()
    .eq('id', body.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

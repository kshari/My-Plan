import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/beta/join?token=...
 * Validate a beta invite link and return feature info (no auth required).
 * Looks up by token only — no environment filter — since tokens are globally
 * unique and the link itself carries the correct environment.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: link, error } = await admin
    .from('beta_invite_links')
    .select('id, feature_id, environment, label, expires_at, max_uses, use_count, active')
    .eq('token', token)
    .single()

  if (error || !link) return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 })
  if (!link.active) return NextResponse.json({ error: 'This invite link has been deactivated.' }, { status: 410 })
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired.' }, { status: 410 })
  }
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return NextResponse.json({ error: 'This invite link has reached its maximum number of uses.' }, { status: 410 })
  }

  // Fetch feature name using the environment stored on the link
  const { data: feature } = await admin
    .from('app_features')
    .select('id, name')
    .eq('id', link.feature_id)
    .eq('environment', link.environment)
    .single()

  return NextResponse.json({
    valid: true,
    feature: { id: link.feature_id, name: feature?.name ?? link.feature_id },
    link: { label: link.label, expires_at: link.expires_at, max_uses: link.max_uses, use_count: link.use_count },
  })
}

/**
 * POST /api/beta/join
 * Claim a beta invite link for the authenticated user.
 * Body: { token }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { token?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token } = body
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

  const admin = createAdminClient()

  // Look up by token only — environment is stored on the link itself
  const { data: link, error: linkError } = await admin
    .from('beta_invite_links')
    .select('id, feature_id, environment, expires_at, max_uses, use_count, active')
    .eq('token', token)
    .single()

  if (linkError || !link) return NextResponse.json({ error: 'Invalid or expired invite link.' }, { status: 404 })
  if (!link.active) return NextResponse.json({ error: 'This invite link has been deactivated.' }, { status: 410 })
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite link has expired.' }, { status: 410 })
  }
  if (link.max_uses !== null && link.use_count >= link.max_uses) {
    return NextResponse.json({ error: 'This invite link has reached its maximum number of uses.' }, { status: 410 })
  }

  // Use environment from the link itself (not the server env var) for all DB operations
  const { feature_id, environment } = link

  // Check if user already has access
  const { data: existing } = await admin
    .from('beta_access')
    .select('id, status')
    .eq('feature_id', feature_id)
    .eq('environment', environment)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'accepted') {
    const { data: feature } = await admin
      .from('app_features')
      .select('name')
      .eq('id', feature_id)
      .eq('environment', environment)
      .single()
    return NextResponse.json({ already_enabled: true, feature_id, feature_name: feature?.name })
  }

  // Grant access: upgrade existing (invited/revoked) row or insert a fresh one
  let accessError: { message: string } | null = null
  if (existing) {
    const { error } = await admin
      .from('beta_access')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', existing.id)
    accessError = error
  } else {
    const { error } = await admin
      .from('beta_access')
      .insert({
        feature_id,
        environment,
        user_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
    accessError = error
  }

  if (accessError) return NextResponse.json({ error: accessError.message }, { status: 500 })

  // Increment use_count on the link
  await admin
    .from('beta_invite_links')
    .update({ use_count: link.use_count + 1 })
    .eq('id', link.id)

  const { data: feature } = await admin
    .from('app_features')
    .select('name')
    .eq('id', feature_id)
    .eq('environment', environment)
    .single()

  return NextResponse.json({ success: true, feature_id, feature_name: feature?.name })
}

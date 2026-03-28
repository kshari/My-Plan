import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAdmin } from '@/lib/utils/auth'
import { getAppEnvironment } from '@/lib/app-features'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/beta-invite-links?featureId=...&environment=...
 * List all invite links for a feature. Admin access required.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin } = await checkAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const featureId = searchParams.get('featureId')
  const environment = searchParams.get('environment') ?? getAppEnvironment()

  if (!featureId) return NextResponse.json({ error: 'featureId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('beta_invite_links')
    .select('id, token, label, created_at, expires_at, max_uses, use_count, active')
    .eq('feature_id', featureId)
    .eq('environment', environment)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

/**
 * POST /api/admin/beta-invite-links
 * Create a new invite link for a feature. Super admin required.
 * Body: { featureId, environment?, label?, maxUses?, expiresAt? }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { featureId?: string; environment?: string; label?: string; maxUses?: number; expiresAt?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { featureId, label, maxUses, expiresAt } = body
  const environment = body.environment ?? getAppEnvironment()

  if (!featureId) return NextResponse.json({ error: 'featureId is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('beta_invite_links')
    .insert({
      feature_id: featureId,
      environment,
      label: label?.trim() || null,
      created_by: user.id,
      max_uses: maxUses ?? null,
      expires_at: expiresAt ?? null,
    })
    .select('id, token, label, created_at, expires_at, max_uses, use_count, active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

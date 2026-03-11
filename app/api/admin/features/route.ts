import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/utils/auth'
import { APP_ENVIRONMENTS } from '@/lib/app-features'
import { NextResponse } from 'next/server'

/**
 * GET: List all feature flags grouped by environment. Admin only.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows, error } = await supabase
    .from('app_features')
    .select('id, environment, name, enabled, updated_at')
    .order('environment')
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byEnv: Record<string, Array<{ id: string; name: string; enabled: boolean; updated_at: string | null }>> = {
    local: [],
    staging: [],
    production: [],
  }
  for (const env of APP_ENVIRONMENTS) {
    byEnv[env] = (rows ?? [])
      .filter((r) => r.environment === env)
      .map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        updated_at: r.updated_at,
      }))
  }

  return NextResponse.json({
    featuresByEnvironment: byEnv,
    environments: APP_ENVIRONMENTS,
    canToggle: role === 'super_admin',
  })
}

/**
 * PATCH: Toggle a feature for an environment. Super admin only.
 * Body: { featureId: string, environment: string, enabled: boolean }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { featureId?: string; environment?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { featureId, environment, enabled } = body
  if (
    typeof featureId !== 'string' ||
    typeof environment !== 'string' ||
    typeof enabled !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'featureId (string), environment (string), and enabled (boolean) required' },
      { status: 400 }
    )
  }
  const env = environment.toLowerCase()
  if (env !== 'local' && env !== 'staging' && env !== 'production') {
    return NextResponse.json({ error: 'environment must be local, staging, or production' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('app_features')
    .update({
      enabled,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq('id', featureId)
    .eq('environment', env)
    .select('id, environment, name, enabled')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

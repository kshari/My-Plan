import { withAuth } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

/**
 * GET /api/agent/settings — fetch saved AI provider preferences
 */
export const GET = withAuth(async (_request, { supabase, user }) => {
  const { data } = await supabase
    .from('user_agent_settings')
    .select('provider, auto_cloud_provider')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    provider: data?.provider ?? null,
    autoCloudProvider: data?.auto_cloud_provider ?? null,
  })
})

/**
 * PATCH /api/agent/settings — save AI provider preferences
 * Body: { provider?: string, autoCloudProvider?: string }
 */
export const PATCH = withAuth(async (request, { supabase, user }) => {
  let body: { provider?: string; autoCloudProvider?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  }
  if (body.provider !== undefined) update.provider = body.provider
  if (body.autoCloudProvider !== undefined) update.auto_cloud_provider = body.autoCloudProvider

  const { error } = await supabase
    .from('user_agent_settings')
    .upsert(update, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
})

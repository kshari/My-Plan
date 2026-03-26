import { createClient } from '@/lib/supabase/server'
import { getAppEnvironment } from '@/lib/app-features'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { featureId?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { featureId } = body
  if (!featureId) {
    return NextResponse.json({ error: 'featureId is required' }, { status: 400 })
  }

  const environment = getAppEnvironment()

  const { data, error } = await supabase
    .from('beta_access')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('feature_id', featureId)
    .eq('environment', environment)
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .select('id, feature_id, status')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'No pending invitation found for this feature' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true, ...data })
}

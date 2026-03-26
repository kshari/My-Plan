import { createClient } from '@/lib/supabase/server'
import { getPendingBetaInvitations } from '@/lib/app-features'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const invitations = await getPendingBetaInvitations(supabase, user.id)
  return NextResponse.json({ invitations })
}

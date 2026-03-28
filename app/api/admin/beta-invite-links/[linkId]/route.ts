import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAdmin } from '@/lib/utils/auth'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/admin/beta-invite-links/[linkId]
 * Deactivate (soft-delete) an invite link. Super admin required.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin, role } = await checkAdmin(supabase, user.id)
  if (!isAdmin || role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { linkId } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .from('beta_invite_links')
    .update({ active: false })
    .eq('id', linkId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { withAuth, verifyOwnership } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

export const DELETE = withAuth(async (request, { user, supabase, params }) => {
  const planId = parseInt(params.id)
  if (isNaN(planId)) {
    return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
  }

  const ownership = await verifyOwnership(supabase, 'rp_retirement_plans', planId, user.id)
  if (ownership instanceof NextResponse) return ownership

  // Delete related data (cascade should handle this, but being explicit)
  await supabase.from('rp_calculator_settings').delete().eq('plan_id', planId)
  await supabase.from('rp_accounts').delete().eq('plan_id', planId)
  await supabase.from('rp_expenses').delete().eq('plan_id', planId)
  await supabase.from('rp_other_income').delete().eq('plan_id', planId)
  await supabase.from('rp_projection_details').delete().eq('plan_id', planId)
  await supabase.from('rp_compounding_targets').delete().eq('plan_id', planId)
  await supabase.from('rp_default_settings').delete().eq('plan_id', planId)

  const { error: deleteError } = await supabase
    .from('rp_retirement_plans')
    .delete()
    .eq('id', planId)

  if (deleteError) throw deleteError

  return NextResponse.json({ message: 'Plan deleted successfully' }, { status: 200 })
})

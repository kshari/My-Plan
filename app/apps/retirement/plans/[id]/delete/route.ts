import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planId = parseInt(id)
    if (isNaN(planId)) {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    // Verify the plan belongs to the user
    const { data: plan, error: planError } = await supabase
      .from('rp_retirement_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found or unauthorized' }, { status: 404 })
    }

    // Delete related data (cascade should handle this, but being explicit)
    await supabase.from('rp_calculator_settings').delete().eq('plan_id', planId)
    await supabase.from('rp_accounts').delete().eq('plan_id', planId)
    await supabase.from('rp_expenses').delete().eq('plan_id', planId)
    await supabase.from('rp_other_income').delete().eq('plan_id', planId)
    await supabase.from('rp_projection_details').delete().eq('plan_id', planId)
    await supabase.from('rp_compounding_targets').delete().eq('plan_id', planId)
    await supabase.from('rp_default_settings').delete().eq('plan_id', planId)

    // Delete the plan
    const { error: deleteError } = await supabase
      .from('rp_retirement_plans')
      .delete()
      .eq('id', planId)

    if (deleteError) throw deleteError

    return NextResponse.json({ message: 'Plan deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Error deleting plan:', error.message)
    return NextResponse.json({ error: error.message || 'Failed to delete plan' }, { status: 500 })
  }
}

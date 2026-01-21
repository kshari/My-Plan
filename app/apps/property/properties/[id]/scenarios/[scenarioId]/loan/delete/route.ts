import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> }
) {
  try {
    const { id, scenarioId } = await params
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const propertyId = parseInt(id)
    const scenarioIdNum = parseInt(scenarioId)
    
    if (isNaN(propertyId) || isNaN(scenarioIdNum)) {
      return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
    }

    // Verify the property belongs to the user and the scenario belongs to the property
    const { data: property, error: propertyError } = await supabase
      .from('pi_properties')
      .select('id')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: scenario, error: scenarioError } = await supabase
      .from('pi_financial_scenarios')
      .select('id')
      .eq('id', scenarioIdNum)
      .eq('Property ID', propertyId)
      .single()

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    // Delete the loan
    const { error: deleteError } = await supabase
      .from('pi_loans')
      .delete()
      .eq('scanario', scenarioIdNum)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete loan' }, { status: 500 })
  }
}

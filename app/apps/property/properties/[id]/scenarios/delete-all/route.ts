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

    const propertyId = parseInt(id)
    if (isNaN(propertyId)) {
      return NextResponse.json({ error: 'Invalid property ID' }, { status: 400 })
    }

    // Verify the property belongs to the user
    const { data: property, error: propertyError } = await supabase
      .from('pi_properties')
      .select('id')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Get all scenario IDs for this property
    const { data: scenarios, error: scenariosError } = await supabase
      .from('pi_financial_scenarios')
      .select('id')
      .eq('Property ID', propertyId)

    if (scenariosError) {
      return NextResponse.json({ error: scenariosError.message }, { status: 500 })
    }

    if (!scenarios || scenarios.length === 0) {
      return NextResponse.json({ message: 'No scenarios to delete', count: 0 }, { status: 200 })
    }

    const scenarioIds = scenarios.map(s => s.id)

    // Delete all loans associated with these scenarios
    const { error: deleteLoansError } = await supabase
      .from('pi_loans')
      .delete()
      .in('scanario', scenarioIds)

    if (deleteLoansError) {
      console.error('Error deleting loans:', deleteLoansError)
      // Continue with scenario deletion even if loan deletion fails
    }

    // Delete all scenarios for this property
    const { error: deleteScenariosError } = await supabase
      .from('pi_financial_scenarios')
      .delete()
      .eq('Property ID', propertyId)

    if (deleteScenariosError) {
      return NextResponse.json({ error: deleteScenariosError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${scenarios.length} scenario${scenarios.length > 1 ? 's' : ''}`,
      count: scenarios.length 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete all scenarios' }, { status: 500 })
  }
}

import { withAuth, verifyOwnership } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

export const DELETE = withAuth(async (request, { user, supabase, params }) => {
  const propertyId = parseInt(params.id)
  if (isNaN(propertyId)) {
    return NextResponse.json({ error: 'Invalid property ID' }, { status: 400 })
  }

  const ownership = await verifyOwnership(supabase, 'pi_properties', propertyId, user.id)
  if (ownership instanceof NextResponse) return ownership

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

  const { error: deleteLoansError } = await supabase
    .from('pi_loans')
    .delete()
    .in('scanario', scenarioIds)

  if (deleteLoansError) {
    console.error('Error deleting loans:', deleteLoansError)
  }

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
})

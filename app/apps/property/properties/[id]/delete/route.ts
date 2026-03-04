import { withAuth, verifyOwnership } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'

export const DELETE = withAuth(async (request, { user, supabase, params }) => {
  const propertyId = parseInt(params.id)
  if (isNaN(propertyId)) {
    return NextResponse.json({ error: 'Invalid property ID' }, { status: 400 })
  }

  const ownership = await verifyOwnership(supabase, 'pi_properties', propertyId, user.id)
  if (ownership instanceof NextResponse) return ownership

  const { error: deleteError } = await supabase
    .from('pi_properties')
    .delete()
    .eq('id', propertyId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})

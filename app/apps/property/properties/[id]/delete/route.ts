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

    // Verify the property belongs to the user before deletion
    const { data: property, error: fetchError } = await supabase
      .from('pi_properties')
      .select('id')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Delete the property (cascade will handle related scenarios and loans via foreign keys)
    const { error: deleteError } = await supabase
      .from('pi_properties')
      .delete()
      .eq('id', propertyId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete property' }, { status: 500 })
  }
}

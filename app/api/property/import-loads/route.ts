import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET: List import loads for current user.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pi_import_loads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

/**
 * DELETE: Remove an import load and unlink its properties.
 * ?id=<uuid> — required
 * ?deleteProperties=true — also delete the properties (otherwise just unlinks them)
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const loadId = searchParams.get('id')
  const deleteProperties = searchParams.get('deleteProperties') === 'true'

  if (!loadId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: load } = await supabase
    .from('pi_import_loads')
    .select('id')
    .eq('id', loadId)
    .eq('user_id', user.id)
    .single()

  if (!load) return NextResponse.json({ error: 'Load not found' }, { status: 404 })

  if (deleteProperties) {
    await supabase
      .from('pi_properties')
      .delete()
      .eq('import_load_id', loadId)
      .eq('user_id', user.id)
  }

  const { error } = await supabase
    .from('pi_import_loads')
    .delete()
    .eq('id', loadId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}

import { createClient } from '@/lib/supabase/server'
import { checkAdmin } from '@/lib/utils/auth'
import { NextResponse } from 'next/server'

/**
 * DELETE: Remove agent log(s). Admin only.
 * - ?id=<uuid> — delete single log
 * - ?all=true — delete all logs
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { isAdmin } = await checkAdmin(supabase, user.id)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all') === 'true'

  if (all) {
    const { data: rows } = await supabase
      .from('agent_request_logs')
      .select('id')
      .limit(10_000)
    const ids = (rows ?? []).map((r) => r.id)
    if (ids.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }
    const BATCH = 200
    let deleted = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const { error } = await supabase.from('agent_request_logs').delete().in('id', batch)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      deleted += batch.length
    }
    return NextResponse.json({ deleted })
  }

  if (id) {
    const { error } = await supabase.from('agent_request_logs').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ deleted: 1 })
  }

  return NextResponse.json({ error: 'Provide ?id=<uuid> or ?all=true' }, { status: 400 })
}

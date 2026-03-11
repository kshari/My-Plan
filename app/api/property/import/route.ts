import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const VALID_COLUMNS = new Set([
  'address', 'city', 'county', 'type', 'Number of Units', 'Has HOA', 'swimming_pool', 'Asking Price',
  'Gross Income', 'Operating Expenses', 'listing_status', 'source',
  'mls_number', 'listing_url', 'bedrooms', 'bathrooms', 'sqft',
  'lot_size', 'notes', 'additional_info', 'community', 'plan_name', 'estimated_rent',
  'estimated_cash_flow',
])

export type RowResult = {
  rowIndex: number
  status: 'created' | 'updated' | 'skipped'
  reason?: string
  address?: string
}

/**
 * POST: Bulk import properties from mapped rows.
 * Body: { loadName, fileName, fileType, appendToLoadId?, rows: Record<string, unknown>[] }
 * Returns per-row results so the client can show why rows were skipped.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    loadName?: string
    fileName?: string
    fileType?: string
    appendToLoadId?: string
    rows?: Record<string, unknown>[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { loadName, fileName, fileType, appendToLoadId, rows } = body
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows array is required and must not be empty' }, { status: 400 })
  }

  let loadId: string

  if (appendToLoadId) {
    const { data: existingLoad } = await supabase
      .from('pi_import_loads')
      .select('id')
      .eq('id', appendToLoadId)
      .eq('user_id', user.id)
      .single()

    if (!existingLoad) {
      return NextResponse.json({ error: 'Import load not found' }, { status: 404 })
    }
    loadId = existingLoad.id
  } else {
    if (!loadName) {
      return NextResponse.json({ error: 'loadName is required for new imports' }, { status: 400 })
    }
    const { data: newLoad, error: loadErr } = await supabase
      .from('pi_import_loads')
      .insert({
        user_id: user.id,
        name: loadName,
        file_name: fileName ?? null,
        file_type: fileType ?? null,
        property_count: 0,
        status: 'processing',
      })
      .select('id')
      .single()

    if (loadErr || !newLoad) {
      return NextResponse.json({ error: loadErr?.message ?? 'Failed to create import load' }, { status: 500 })
    }
    loadId = newLoad.id
  }

  const rowResults: RowResult[] = []
  let created = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawRow)) {
      if (VALID_COLUMNS.has(key) && value !== null && value !== undefined && value !== '') {
        sanitized[key] = value
      }
    }

    if (String(sanitized.type ?? '').trim().toLowerCase() === 'single family' && (sanitized['Number of Units'] === undefined || sanitized['Number of Units'] === null || sanitized['Number of Units'] === '')) {
      sanitized['Number of Units'] = 1
    }

    const address = (sanitized.address as string) ?? ''

    if (!address || String(address).trim() === '') {
      rowResults.push({
        rowIndex: i + 1,
        status: 'skipped',
        reason: 'No address (required field missing or empty)',
        address: address || undefined,
      })
      skipped++
      continue
    }

    let existingId: number | null = null

    if (sanitized.mls_number) {
      const { data: byMls } = await supabase
        .from('pi_properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('mls_number', sanitized.mls_number as string)
        .maybeSingle()
      if (byMls) existingId = byMls.id
    }

    if (!existingId) {
      const { data: byAddr } = await supabase
        .from('pi_properties')
        .select('id')
        .eq('user_id', user.id)
        .eq('address', address)
        .maybeSingle()
      if (byAddr) existingId = byAddr.id
    }

    if (existingId) {
      const { error } = await supabase
        .from('pi_properties')
        .update({ ...sanitized, import_load_id: loadId })
        .eq('id', existingId)
      if (!error) {
        rowResults.push({ rowIndex: i + 1, status: 'updated', address })
        updated++
      } else {
        rowResults.push({
          rowIndex: i + 1,
          status: 'skipped',
          reason: `Database error: ${error.message}`,
          address,
        })
        skipped++
      }
    } else {
      const { error } = await supabase
        .from('pi_properties')
        .insert({ ...sanitized, user_id: user.id, import_load_id: loadId })
      if (!error) {
        rowResults.push({ rowIndex: i + 1, status: 'created', address })
        created++
      } else {
        rowResults.push({
          rowIndex: i + 1,
          status: 'skipped',
          reason: `Database error: ${error.message}`,
          address,
        })
        skipped++
      }
    }
  }

  const totalImported = created + updated
  await supabase
    .from('pi_import_loads')
    .update({
      property_count: totalImported,
      status: 'complete',
      updated_at: new Date().toISOString(),
    })
    .eq('id', loadId)

  return NextResponse.json({
    loadId,
    created,
    updated,
    skipped,
    total: rows.length,
    rowResults,
  })
}

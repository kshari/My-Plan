/**
 * Seed/update fp_benchmarks table from the canonical BENCHMARK_DATA.
 *
 * Usage:
 *   npx tsx scripts/seed-benchmarks.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (service role key bypasses RLS so we can write to the admin-only table).
 *
 * This script is idempotent: it deletes all existing rows and re-inserts.
 * Run it whenever lib/constants/benchmark-data.ts is updated.
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { BENCHMARK_DATA } from '../lib/constants/benchmark-data'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
    console.error('Add SUPABASE_SERVICE_ROLE_KEY to .env.local (find it in Supabase Dashboard > Settings > API).')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`Seeding ${BENCHMARK_DATA.length} benchmark rows...`)

  const { error: deleteError } = await supabase
    .from('fp_benchmarks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) {
    console.error('Failed to delete existing benchmarks:', deleteError.message)
    process.exit(1)
  }

  const { error: insertError } = await supabase
    .from('fp_benchmarks')
    .insert(BENCHMARK_DATA)
  if (insertError) {
    console.error('Failed to insert benchmarks:', insertError.message)
    process.exit(1)
  }

  console.log(`Done! Inserted ${BENCHMARK_DATA.length} rows into fp_benchmarks.`)
}

main()

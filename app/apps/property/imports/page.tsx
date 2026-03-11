import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import { ImportLoadsList } from '@/components/property/import-loads-list'

export default async function ImportsPage() {
  const { supabase, user } = await requireAuth()

  const { data: loads } = await supabase
    .from('pi_import_loads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Property Imports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your bulk property imports from CSV and PDF files.
          </p>
        </div>
        <Link
          href="/apps/property/imports/upload"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          + Import File
        </Link>
      </div>
      <ImportLoadsList initialLoads={loads ?? []} />
    </div>
  )
}

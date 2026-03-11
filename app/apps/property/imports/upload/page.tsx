import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import { ImportUpload } from '@/components/property/import-upload'

export default async function ImportUploadPage() {
  const { supabase, user } = await requireAuth()

  const { data: loads } = await supabase
    .from('pi_import_loads')
    .select('id, name, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className={PAGE_CONTAINER}>
      <Link
        href="/apps/property/imports"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Imports
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Import Properties</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Upload a CSV or PDF file to import properties in bulk.
      </p>
      <ImportUpload existingLoads={loads ?? []} />
    </div>
  )
}

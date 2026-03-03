import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import PropertyList from '@/components/property/property-list'

export default async function PropertyDashboardPage() {
  const { supabase, user } = await requireAuth()

  const { data: properties, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and analyze your real estate investments
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive">Error loading properties: {error.message}</p>
          )}
        </div>
        <Link
          href="/apps/property/properties/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          + Add Property
        </Link>
      </div>

      <PropertyList properties={properties || []} />
    </div>
  )
}

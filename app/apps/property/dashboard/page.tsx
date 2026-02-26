import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PropertyList from '@/components/property/property-list'

export default async function PropertyDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: properties, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

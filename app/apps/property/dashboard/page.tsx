import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import PropertyList from '@/components/property/property-list'
import PropertyPortfolioSummary from '@/components/property/portfolio-summary'
import SharePropertiesDialog from '@/components/property/teams/share-properties-dialog'
import { Share2 } from 'lucide-react'

interface DashboardPageProps {
  searchParams: Promise<{ load?: string }>
}

export default async function PropertyDashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const { supabase, user } = await requireAuth()

  const [{ data: properties, error }, { data: loads }, { data: memberships }] = await Promise.all([
    supabase
      .from('pi_properties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('pi_import_loads')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('team_members')
      .select('team_id, teams(id, name)')
      .eq('user_id', user.id),
  ])

  const teams = (memberships ?? [])
    .filter(m => m.teams)
    .map(m => m.teams as unknown as { id: string; name: string })

  const propertySummaries = (properties ?? []).map(p => ({
    id: p.id,
    address: p.address,
    city: p.city,
    type: p.type,
    listing_status: p.listing_status,
    'Asking Price': p['Asking Price'],
  }))

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
        <div className="flex items-center gap-2">
          {teams.length > 0 && propertySummaries.length > 0 && teams.map(team => (
            <SharePropertiesDialog
              key={team.id}
              teamId={team.id}
              properties={propertySummaries}
              trigger={
                <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  <Share2 className="h-4 w-4" />
                  Share to {team.name}
                </button>
              }
            />
          ))}
          <Link
            href="/apps/property/imports/upload"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-xs hover:bg-accent transition-colors"
          >
            Import File
          </Link>
          <Link
            href="/apps/property/properties/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            + Add Property
          </Link>
        </div>
      </div>

      {properties && properties.length > 0 && (
        <PropertyPortfolioSummary properties={properties} />
      )}

      <PropertyList
        properties={properties || []}
        loads={loads ?? []}
        initialLoadFilter={params.load}
      />
    </div>
  )
}

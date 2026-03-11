import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import CityCountyAnalytics from '@/components/property/city-county-analytics'

export default async function PropertyAnalyticsPage() {
  const { supabase, user } = await requireAuth()

  const { data: properties, error } = await supabase
    .from('pi_properties')
    .select('id, address, city, county, listing_status, "Asking Price", "Gross Income", "Operating Expenses", estimated_rent, sqft, created_at')
    .eq('user_id', user.id)

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Market Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Property performance grouped by city and county
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">Error loading data: {error.message}</p>
        )}
      </div>
      <CityCountyAnalytics properties={properties || []} />
    </div>
  )
}

import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import CityCountyAnalytics from '@/components/property/city-county-analytics'
import { PipelineFunnelMetrics } from '@/components/property/analytics/pipeline-funnel-metrics'

export default async function PropertyAnalyticsPage() {
  const { supabase, user } = await requireAuth()

  const [{ data: properties, error }, { data: stageHistory }] = await Promise.all([
    supabase
      .from('pi_properties')
      .select('id, address, city, county, listing_status, deal_stage, stage_updated_at, "Asking Price", "Gross Income", "Operating Expenses", estimated_rent, sqft, created_at')
      .eq('user_id', user.id),
    supabase
      .from('pi_deal_stage_history')
      .select('*')
      .eq('user_id', user.id)
      .order('entered_at', { ascending: true }),
  ])

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline funnel, market performance, and deal metrics
        </p>
        {error && (
          <p className="mt-2 text-sm text-destructive">Error loading data: {error.message}</p>
        )}
      </div>

      {/* Pipeline funnel metrics */}
      <PipelineFunnelMetrics
        properties={properties ?? []}
        stageHistory={stageHistory ?? []}
      />

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Market Breakdown</h2>
        <CityCountyAnalytics properties={properties || []} />
      </div>
    </div>
  )
}

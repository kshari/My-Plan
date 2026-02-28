import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanList from '@/components/retirement/retirement-plan-list'
import RetirementCalculator from '@/components/retirement/retirement-calculator'

export default async function RetirementDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: plans, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch latest computed metrics for each plan
  const planIds = (plans || []).map((p) => p.id)
  const { data: metrics } = planIds.length
    ? await supabase
        .from('rp_plan_metrics')
        .select('*')
        .in('plan_id', planIds)
    : { data: [] }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Calculator first */}
      <RetirementCalculator />

      {/* Saved plans */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Saved Retirement Plans</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your detailed plans with full scenario modeling
            </p>
            {error && (
              <p className="mt-1 text-sm text-destructive">Error loading plans: {error.message}</p>
            )}
          </div>
          <Link
            href="/apps/retirement/plans/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            + New Plan
          </Link>
        </div>

        <RetirementPlanList plans={plans || []} metrics={metrics || []} />
      </div>
    </div>
  )
}

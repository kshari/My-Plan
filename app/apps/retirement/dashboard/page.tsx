import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanList from '@/components/retirement/retirement-plan-list'

export default async function RetirementDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: plans, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retirement Plans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your retirement projections and scenarios
          </p>
          {error && (
            <p className="mt-2 text-sm text-destructive">Error loading plans: {error.message}</p>
          )}
        </div>
        <Link
          href="/apps/retirement/plans/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
        >
          + New Plan
        </Link>
      </div>

      <RetirementPlanList plans={plans || []} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanTabs from '@/components/retirement/retirement-plan-tabs'

interface RetirementPlanDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function RetirementPlanDetailPage({ params, searchParams }: RetirementPlanDetailPageProps) {
  const { id } = await params
  const { tab } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const planId = parseInt(id)
  if (isNaN(planId)) notFound()

  const { data: plan, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/apps/retirement/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retirement Plans
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{plan.plan_name}</h1>
        </div>
        <Link
          href={`/apps/retirement/plans/${planId}/edit`}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          Edit Plan
        </Link>
      </div>

      <RetirementPlanTabs planId={planId} initialTab={tab} />
    </div>
  )
}

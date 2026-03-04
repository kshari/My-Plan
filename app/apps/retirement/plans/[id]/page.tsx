import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanTabs from '@/components/retirement/retirement-plan-tabs'

interface RetirementPlanDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function RetirementPlanDetailPage({ params, searchParams }: RetirementPlanDetailPageProps) {
  const { id } = await params
  const { tab } = await searchParams
  const { supabase, user } = await requireAuth()

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
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/apps/retirement/dashboard"
            className={BACK_LINK}
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

      <RetirementPlanTabs planId={planId} planName={plan.plan_name} initialTab={tab} />
    </div>
  )
}

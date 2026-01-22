import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanTabs from '@/components/retirement/retirement-plan-tabs'

interface RetirementPlanDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function RetirementPlanDetailPage({ params }: RetirementPlanDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const planId = parseInt(id)
  if (isNaN(planId)) {
    notFound()
  }

  // Fetch the plan and verify it belongs to the user
  const { data: plan, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link 
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-gray-700"
            >
              ← My Plan / Retirement Planner
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/apps/retirement/dashboard"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Dashboard
              </Link>
              <span className="text-sm text-gray-600">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href="/apps/retirement/dashboard"
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {plan.plan_name}
          </h1>
          <div className="flex gap-3">
            <Link
              href={`/apps/retirement/plans/${planId}/edit`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Plan Name
            </Link>
          </div>
        </div>

        <RetirementPlanTabs planId={planId} />
      </main>
    </div>
  )
}

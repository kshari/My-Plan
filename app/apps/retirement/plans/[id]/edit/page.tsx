import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RetirementPlanForm from '@/components/retirement/retirement-plan-form'

interface EditRetirementPlanPageProps {
  params: Promise<{ id: string }>
}

export default async function EditRetirementPlanPage({ params }: EditRetirementPlanPageProps) {
  const { id } = await params
  const planId = parseInt(id)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: plan, error } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (error || !plan) {
    redirect('/apps/retirement/dashboard')
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
                href={`/apps/retirement/plans/${planId}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Plan Details
              </Link>
              <Link
                href="/apps/retirement/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/apps/retirement/plans/${planId}`}
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Plan Details
        </Link>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Edit Plan: {plan.plan_name}</h2>
          <RetirementPlanForm planId={planId} initialData={plan} />
        </div>
      </main>
    </div>
  )
}

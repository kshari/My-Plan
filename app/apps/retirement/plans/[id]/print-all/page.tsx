import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import PlanPrintAllView from '@/components/retirement/print/plan-print-all-view'

interface PrintAllPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pages?: string; scenarioId?: string }>
}

export default async function PlanPrintAllPage({ params, searchParams }: PrintAllPageProps) {
  const { id } = await params
  const { pages, scenarioId } = await searchParams
  const { supabase, user } = await requireAuth()

  const planId = parseInt(id)
  if (isNaN(planId)) notFound()

  // Verify ownership
  const { data: plan, error: planError } = await supabase
    .from('rp_retirement_plans')
    .select('id, plan_name')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (planError || !plan) notFound()

  // Parse selected pages — default to all when not specified
  const allPages = [
    'quick-analysis',
    'details',
    'strategy-modeling',
    'scenario-modeling',
    'scenario-modeling-income',
    'monte-carlo',
    'roth-conversion',
    'ssa-analysis',
    'plan-details',
    'other-income',
    'other-tools',
  ]
  const selectedPages = pages
    ? decodeURIComponent(pages).split(',').filter(p => allPages.includes(p))
    : allPages

  const resolvedScenarioId = scenarioId ? parseInt(scenarioId) : null

  return (
    <PlanPrintAllView
      planId={planId}
      planName={plan.plan_name}
      selectedPages={selectedPages}
      initialScenarioId={isNaN(resolvedScenarioId ?? NaN) ? null : resolvedScenarioId}
      generatedAt={new Date().toISOString()}
    />
  )
}

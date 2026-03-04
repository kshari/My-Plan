import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import PlanPrintView from '@/components/retirement/print/plan-print-view'

interface PrintPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sections?: string; scenarioId?: string }>
}

export default async function PlanPrintPage({ params, searchParams }: PrintPageProps) {
  const { id } = await params
  const { sections, scenarioId } = await searchParams
  const { supabase, user } = await requireAuth()

  const planId = parseInt(id)
  if (isNaN(planId)) notFound()

  // Parse selected sections (default to quick set)
  const selectedSections = sections
    ? decodeURIComponent(sections).split(',').filter(Boolean)
    : ['plan-summary', 'assumptions', 'yearly-projections']

  // Verify ownership and fetch plan
  const { data: plan, error: planError } = await supabase
    .from('rp_retirement_plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .single()

  if (planError || !plan) notFound()

  // Resolve scenario ID
  let resolvedScenarioId: number | null = scenarioId ? parseInt(scenarioId) : null
  if (!resolvedScenarioId || isNaN(resolvedScenarioId)) {
    const { data: scenarios } = await supabase
      .from('rp_scenarios')
      .select('id')
      .eq('plan_id', planId)
      .order('id')
      .limit(1)
    resolvedScenarioId = scenarios?.[0]?.id ?? null
  }

  // Fetch all data in parallel
  const [
    settingsResult,
    metricsResult,
    projectionsResult,
    accountsResult,
    expensesResult,
    otherIncomeResult,
    scenariosResult,
  ] = await Promise.all([
    resolvedScenarioId
      ? supabase.from('rp_calculator_settings').select('*').eq('scenario_id', resolvedScenarioId).single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('rp_plan_metrics').select('*').eq('plan_id', planId).single(),
    resolvedScenarioId
      ? supabase.from('rp_projection_details').select('*').eq('scenario_id', resolvedScenarioId).order('year')
      : Promise.resolve({ data: [], error: null }),
    supabase.from('rp_accounts').select('*').eq('plan_id', planId).order('id'),
    supabase.from('rp_expenses').select('*').eq('plan_id', planId).order('id'),
    supabase.from('rp_other_income').select('*').eq('plan_id', planId).order('id'),
    supabase.from('rp_scenarios').select('id, scenario_name').eq('plan_id', planId).order('id'),
  ])

  // For scenario modeling section: fetch settings for each scenario
  let scenariosWithSettings: Array<{ id: number; scenario_name: string; settings: Record<string, unknown> | null }> = []
  if (selectedSections.includes('scenario-modeling') && scenariosResult.data?.length) {
    const settingsPromises = scenariosResult.data.map(s =>
      supabase.from('rp_calculator_settings').select('*').eq('scenario_id', s.id).single()
    )
    const settingsResults = await Promise.all(settingsPromises)
    scenariosWithSettings = scenariosResult.data.map((s, i) => ({
      id: s.id,
      scenario_name: s.scenario_name,
      settings: settingsResults[i].data ?? null,
    }))
  }

  return (
    <PlanPrintView
      plan={plan}
      settings={settingsResult.data ?? null}
      metrics={metricsResult.data ?? null}
      projections={projectionsResult.data ?? []}
      accounts={accountsResult.data ?? []}
      expenses={expensesResult.data ?? []}
      otherIncome={otherIncomeResult.data ?? []}
      scenarios={scenariosResult.data ?? []}
      scenariosWithSettings={scenariosWithSettings}
      selectedSections={selectedSections}
      generatedAt={new Date().toISOString()}
    />
  )
}

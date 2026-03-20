import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ScenarioDetailView from '@/components/property/scenario-detail-view'
import {
  BASE_SCENARIO_SLUG,
  buildBaseScenarioFromProperty,
} from '@/lib/property/build-base-scenario-from-property'

interface TeamScenarioDetailPageProps {
  params: Promise<{ teamId: string; propId: string; scenarioId: string }>
}

export default async function TeamScenarioDetailPage({ params }: TeamScenarioDetailPageProps) {
  const { teamId, propId, scenarioId: scenarioIdParam } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(propId)
  if (isNaN(propertyId)) notFound()

  const { data: membership } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership) notFound()

  const { data: property, error: propertyError } = await supabase
    .from('team_shared_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('team_id', teamId)
    .single()

  if (propertyError || !property) notFound()

  const basePath = `/apps/property/teams/${teamId}/properties/${propertyId}`
  const backHref = basePath

  if (scenarioIdParam === BASE_SCENARIO_SLUG) {
    const { scenario, loan } = buildBaseScenarioFromProperty(property)
    return (
      <ScenarioDetailView
        backHref={backHref}
        address={property.address}
        scenario={scenario}
        loan={loan}
        subtitle="Derived from this shared listing and the same default loan assumptions used in the dashboard analysis. Save a team scenario from Model Scenarios or Add Scenario to customize assumptions."
        actions={
          <>
            <Link
              href={`${basePath}/scenarios/recommended`}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-muted transition-colors"
            >
              Model Scenarios
            </Link>
            <Link
              href={`${basePath}/scenarios/new`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
            >
              Add Scenario
            </Link>
          </>
        }
      />
    )
  }

  const scenarioIdNum = parseInt(scenarioIdParam)
  if (isNaN(scenarioIdNum)) notFound()

  const { data: scenario, error: scenarioError } = await supabase
    .from('team_shared_scenarios')
    .select('*')
    .eq('id', scenarioIdNum)
    .eq('shared_property_id', propertyId)
    .single()

  if (scenarioError || !scenario) notFound()

  const { data: loan } = await supabase
    .from('team_shared_loans')
    .select('*')
    .eq('shared_scenario_id', scenarioIdNum)
    .single()

  return (
    <ScenarioDetailView
      backHref={backHref}
      address={property.address}
      scenario={scenario as Record<string, unknown>}
      loan={(loan ?? null) as Record<string, unknown> | null}
      actions={
        <Link
          href={`${basePath}/scenarios/recommended`}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-xs hover:bg-muted transition-colors"
        >
          Model Scenarios
        </Link>
      }
    />
  )
}

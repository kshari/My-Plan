import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ScenarioDetailView from '@/components/property/scenario-detail-view'
import DeleteScenarioButton from '@/components/property/delete-scenario-button'
import {
  BASE_SCENARIO_SLUG,
  buildBaseScenarioFromProperty,
} from '@/lib/property/build-base-scenario-from-property'

interface ScenarioDetailPageProps {
  params: Promise<{ id: string; scenarioId: string }>
}

export default async function ScenarioDetailPage({ params }: ScenarioDetailPageProps) {
  const { id, scenarioId: scenarioIdParam } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) {
    notFound()
  }

  const { data: property, error: propertyError } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) {
    notFound()
  }

  const basePath = `/apps/property/properties/${propertyId}`
  const backHref = basePath

  if (scenarioIdParam === BASE_SCENARIO_SLUG) {
    const { scenario, loan } = buildBaseScenarioFromProperty(property)
    return (
      <ScenarioDetailView
        backHref={backHref}
        address={property.address}
        scenario={scenario}
        loan={loan}
        subtitle="Derived from your property listing and the same default loan assumptions used in the dashboard analysis (down payment, rate, term, closing costs). Save a named scenario to customize assumptions."
        actions={
          <Link
            href={`${basePath}/scenarios/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Add Scenario
          </Link>
        }
      />
    )
  }

  const scenarioIdNum = parseInt(scenarioIdParam)
  if (isNaN(scenarioIdNum)) {
    notFound()
  }

  const { data: scenario, error: scenarioError } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('id', scenarioIdNum)
    .eq('Property ID', propertyId)
    .single()

  if (scenarioError || !scenario) {
    notFound()
  }

  const { data: loan } = await supabase
    .from('pi_loans')
    .select('*')
    .eq('scenario_id', scenarioIdNum)
    .single()

  return (
    <ScenarioDetailView
      backHref={backHref}
      address={property.address}
      scenario={scenario as Record<string, unknown>}
      loan={(loan ?? null) as Record<string, unknown> | null}
      actions={
        <>
          <Link
            href={`${basePath}/scenarios/${scenarioIdNum}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Edit Scenario
          </Link>
          <DeleteScenarioButton
            propertyId={propertyId}
            scenarioId={scenarioIdNum}
            scenarioName={scenario['Scenario Name'] || undefined}
          />
        </>
      }
      loanMeta={{ propertyId, scenarioId: scenarioIdNum }}
    />
  )
}

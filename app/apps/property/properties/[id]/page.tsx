import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DealWorkspace from '@/components/property/deal-workspace'
import ShareBackButton from '@/components/property/teams/share-back-button'
import DeletePropertyButton from '@/components/property/delete-property-button'
import { buildBaseScenarioSeed } from '@/lib/property/build-base-scenario-from-property'

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ scenario?: string }>
}

export default async function PropertyDetailPage({ params, searchParams }: PropertyDetailPageProps) {
  const { id } = await params
  const { scenario: scenarioParam } = await searchParams
  const initialScenarioId = scenarioParam ? parseInt(scenarioParam) : undefined
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) notFound()

  const { data: property, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (error || !property) notFound()

  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('created_at', { ascending: true })

  // Paranoid: auto-create Base scenario if none exists with is_base=true
  const hasBase = (scenarios ?? []).some(s => s.is_base === true)
  if (!hasBase) {
    const baseSeed = buildBaseScenarioSeed(propertyId, {
      'Asking Price': property['Asking Price'],
      'Gross Income': property['Gross Income'],
      'Operating Expenses': property['Operating Expenses'],
      expense_breakdown: property.expense_breakdown ?? null,
      vacancy_rate: property.vacancy_rate ?? null,
      income_increase: property.income_increase ?? null,
      expenses_increase: property.expenses_increase ?? null,
      property_value_increase: property.property_value_increase ?? null,
    })
    const { data: newBase } = await supabase
      .from('pi_financial_scenarios')
      .insert([baseSeed])
      .select('*')
      .single()
    if (newBase) {
      // Prepend so it appears first
      const arr = scenarios ?? []
      arr.unshift(newBase as (typeof arr)[number])
    }
  }

  const sortedScenarios = (scenarios ?? []).sort((a, b) => {
    // Base always first
    if (a.is_base && !b.is_base) return -1
    if (!a.is_base && b.is_base) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)

  const teams = (memberships ?? [])
    .filter(m => m.teams)
    .map(m => m.teams as unknown as { id: string; name: string })

  return (
    <div className={PAGE_CONTAINER}>
      <div className="flex items-center justify-between mb-4">
        <Link href="/apps/property/dashboard" className={BACK_LINK}>
          ← Back to Properties
        </Link>
        <div className="flex gap-2">
          {teams.length > 0 && (
            <ShareBackButton propertyId={propertyId} teams={teams} />
          )}
          <DeletePropertyButton
            propertyId={propertyId}
            propertyName={property.address || undefined}
          />
        </div>
      </div>

      <DealWorkspace
        property={property}
        initialScenarios={sortedScenarios}
        initialScenarioId={initialScenarioId && !isNaN(initialScenarioId) ? initialScenarioId : undefined}
      />
    </div>
  )
}

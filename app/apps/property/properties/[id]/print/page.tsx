import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import PropertyPrintView from '@/components/property/property-print-view'

interface PrintPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sections?: string; scenarioId?: string }>
}

export default async function PropertyPrintPage({ params, searchParams }: PrintPageProps) {
  const { id } = await params
  const { sections, scenarioId } = await searchParams
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) notFound()

  const selectedSections = sections
    ? decodeURIComponent(sections).split(',').filter(Boolean)
    : ['property-info', 'scenario-details', 'financial-metrics', 'first-year']

  const { data: property, error: propertyError } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (propertyError || !property) notFound()

  const { data: scenarios } = await supabase
    .from('pi_financial_scenarios')
    .select('*')
    .eq('Property ID', propertyId)
    .order('created_at', { ascending: false })

  const scenarioIdNum = scenarioId ? parseInt(scenarioId) : null
  const scenario = scenarioIdNum
    ? scenarios?.find(s => s.id === scenarioIdNum)
    : scenarios?.[0]

  let loan = null
  if (scenario) {
    const { data } = await supabase
      .from('pi_loans')
      .select('*')
      .eq('scenario_id', scenario.id)
      .single()
    loan = data
  }

  return (
    <PropertyPrintView
      property={property}
      scenario={scenario}
      loan={loan}
      sections={selectedSections}
    />
  )
}

import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER, BACK_LINK } from '@/lib/constants/css'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ScenarioComparer from '@/components/property/scenario-comparer'

interface ComparePageProps {
  params: Promise<{ id: string }>
}

export default async function ComparePage({ params }: ComparePageProps) {
  const { id } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) notFound()

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

  if (!scenarios || scenarios.length < 2) {
    return (
      <div className={PAGE_CONTAINER}>
        <Link href={`/apps/property/properties/${propertyId}`} className={BACK_LINK}>
          &larr; Back to Property
        </Link>
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Compare Scenarios</h1>
          <p className="mt-2 text-muted-foreground">
            You need at least 2 scenarios to compare. Currently you have {scenarios?.length || 0}.
          </p>
          <Link
            href={`/apps/property/properties/${propertyId}/scenarios/new`}
            className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add Scenario
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/property/properties/${propertyId}`} className={BACK_LINK}>
        &larr; Back to Property
      </Link>
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Compare Scenarios</h1>
        <p className="mt-1 text-sm text-muted-foreground">{property.address || 'Property'}</p>
      </div>
      <ScenarioComparer scenarios={scenarios} propertyId={propertyId} />
    </div>
  )
}

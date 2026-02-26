import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import PropertyDetails from '@/components/property/property-details'
import FinancialScenariosList from '@/components/property/financial-scenarios-list'
import DeletePropertyButton from '@/components/property/delete-property-button'

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) notFound()

  const { data: property, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (error || !property) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/apps/property/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Properties
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {property.address || 'Property Details'}
        </h1>
        <div className="flex gap-3">
          <Link
            href={`/apps/property/properties/${propertyId}/edit`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            Edit Property
          </Link>
          <DeletePropertyButton
            propertyId={propertyId}
            propertyName={property.address || undefined}
          />
        </div>
      </div>

      <div className="space-y-6">
        <PropertyDetails property={property} />
        <FinancialScenariosList propertyId={propertyId} />
      </div>
    </div>
  )
}

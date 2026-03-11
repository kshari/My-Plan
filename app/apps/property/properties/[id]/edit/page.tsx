import { requireAuth } from '@/lib/utils/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PropertyForm from '@/components/property/property-form'

interface PropertyEditPageProps {
  params: Promise<{ id: string }>
}

export default async function PropertyEditPage({ params }: PropertyEditPageProps) {
  const { id } = await params
  const { supabase, user } = await requireAuth()

  const propertyId = parseInt(id)
  if (isNaN(propertyId)) {
    notFound()
  }

  // Fetch the property and verify it belongs to the user
  const { data: property, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('id', propertyId)
    .eq('user_id', user.id)
    .single()

  if (error || !property) {
    notFound()
  }

  const initialData = {
    address: property.address,
    city: property.city ?? null,
    county: property.county ?? null,
    type: property.type,
    'Number of Units': property['Number of Units'],
    'Has HOA': property['Has HOA'],
    swimming_pool: property.swimming_pool ?? null,
    'Asking Price': property['Asking Price'],
    'Gross Income': property['Gross Income'],
    'Operating Expenses': property['Operating Expenses'],
    listing_status: property.listing_status ?? null,
    source: property.source ?? null,
    mls_number: property.mls_number ?? null,
    listing_url: property.listing_url ?? null,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    sqft: property.sqft ?? null,
    lot_size: property.lot_size ?? null,
    community: property.community ?? null,
    plan_name: property.plan_name ?? null,
    estimated_rent: property.estimated_rent ?? null,
    estimated_cash_flow: property.estimated_cash_flow ?? null,
    notes: property.notes ?? null,
    additional_info: property.additional_info ?? null,
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
              ← My Plan / Property Investment
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/apps/property/dashboard"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href={`/apps/property/properties/${propertyId}`}
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Property
        </Link>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Edit Property</h2>
          <PropertyForm propertyId={propertyId} initialData={initialData} />
        </div>
      </main>
    </div>
  )
}

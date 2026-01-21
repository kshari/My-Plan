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

  if (!user) {
    redirect('/login')
  }

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
              <span className="text-sm text-gray-600">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href="/apps/property/dashboard"
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>

        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {property.address || 'Property Details'}
          </h1>
          <div className="flex gap-3">
            <Link
              href={`/apps/property/properties/${propertyId}/edit`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
      </main>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PropertyList from '@/components/property/property-list'

export default async function PropertyDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: properties, error } = await supabase
    .from('pi_properties')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

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
                href="/"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Switch Apps
              </Link>
              <Link
                href="/apps/property/profile"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Profile
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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your Properties</h2>
            {error && (
              <p className="mt-2 text-sm text-red-600">Error loading properties: {error.message}</p>
            )}
          </div>
          <Link 
            href="/apps/property/properties/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add New Property
          </Link>
        </div>

        <PropertyList properties={properties || []} />
      </main>
    </div>
  )
}

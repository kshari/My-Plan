import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileForm from '@/components/property/profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: { user: userDetails } } = await supabase.auth.getUser()

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

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link 
          href="/apps/property/dashboard"
          className="mb-6 inline-block text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Dashboard
        </Link>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Profile Settings</h2>
          <p className="mb-6 text-sm text-gray-600">Manage your account information and preferences</p>
          <ProfileForm user={userDetails} />
        </div>
      </main>
    </div>
  )
}

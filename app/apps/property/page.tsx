import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/apps/property/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-4xl font-bold text-gray-900">Property Investment</h1>
        <p className="text-xl text-gray-600">Manage your properties, financial scenarios, and loans</p>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-left">
          <p className="text-sm text-blue-800">
            <strong>Part of My Plan:</strong> This app shares authentication with the Portfolio Analyzer app. 
            You can switch between apps after logging in.
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <Link 
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Login
          </Link>
          <Link 
            href="/apps/property/signup"
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Sign Up
          </Link>
        </div>
        <div className="pt-4 border-t">
          <p className="text-sm text-gray-600 mb-2">Or visit:</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            My Plan Home →
          </Link>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirectIfAuthenticated } from '@/lib/utils/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

export default async function RetirementSignupPage() {
  await redirectIfAuthenticated('/apps/retirement/dashboard')

  async function handleSignup(formData: FormData) {
    'use server'
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      redirect(`/apps/retirement/signup?error=${encodeURIComponent(error.message)}`)
    } else {
      redirect('/apps/retirement/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Sign Up</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create an account for Retirement Planner
          </p>
        </div>
        <form action={handleSignup} className="mt-8 space-y-6 rounded-lg bg-white p-6 shadow">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
            >
              Sign up
            </button>
          </div>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>
          <div className="w-full">
            <GoogleSignInButton next="/apps/retirement/dashboard" className="w-full" />
          </div>
          <div className="text-center">
            <Link href="/apps/retirement/login" className="text-sm text-blue-600 hover:text-blue-800">
              Already have an account? Sign in
            </Link>
          </div>
          <div className="text-center">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Back to My Plan
            </Link>
          </div>
          <div className="text-center border-t pt-4">
            <Link href="/try/retirement" className="text-sm text-violet-600 hover:text-violet-800">
              Try without signing up →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

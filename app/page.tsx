import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const apps = [
    {
      id: 'portfolio',
      name: 'Portfolio Analyzer',
      description: 'Stock portfolio analysis with risk metrics, beta, delta, and CAGR',
      icon: '📈',
      href: '/apps/portfolio',
      color: 'bg-blue-500 hover:bg-blue-600',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      id: 'property',
      name: 'Property Investment',
      description: 'Track and analyze your real estate investments',
      icon: '🏠',
      href: '/apps/property',
      color: 'bg-green-500 hover:bg-green-600',
      gradient: 'from-green-500 to-green-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">My Plan</h1>
            <div className="flex items-center gap-4">
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

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Welcome to My Plan
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Your unified investment planning platform. Choose an application to get started.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={app.href}
              className="group relative overflow-hidden rounded-xl bg-white p-8 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-10"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
                  '--tw-gradient-from': app.gradient.split(' ')[1],
                  '--tw-gradient-to': app.gradient.split(' ')[3],
                } as any}
              />
              <div className="relative">
                <div className="mb-4 text-6xl">{app.icon}</div>
                <h3 className="mb-2 text-2xl font-semibold text-gray-900">
                  {app.name}
                </h3>
                <p className="text-gray-600">{app.description}</p>
                <div className={`mt-6 inline-block rounded-lg ${app.color} px-6 py-2 text-sm font-medium text-white transition-colors`}>
                  Open App →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}

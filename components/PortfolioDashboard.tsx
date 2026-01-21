'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PortfolioList from './PortfolioList'
import PortfolioView from './PortfolioView'

interface User {
  id: string
  email?: string
}

interface PortfolioDashboardProps {
  user: User
}

export default function PortfolioDashboard({ user }: PortfolioDashboardProps) {
  const [portfolios, setPortfolios] = useState<any[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchPortfolios()
  }, [])

  const fetchPortfolios = async () => {
    try {
      const { data, error } = await supabase
        .from('pa_portfolios')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPortfolios(data || [])
    } catch (error: any) {
      console.error('Error fetching portfolios:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="text-xl font-bold text-gray-900 hover:text-gray-700">
              ← My Plan / Portfolio Analyzer
            </a>
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Switch Apps
              </a>
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {selectedPortfolio ? (
          <PortfolioView
            portfolioId={selectedPortfolio}
            onBack={() => setSelectedPortfolio(null)}
            onUpdate={fetchPortfolios}
          />
        ) : (
          <PortfolioList
            portfolios={portfolios}
            onSelectPortfolio={setSelectedPortfolio}
            onUpdate={fetchPortfolios}
          />
        )}
      </main>
    </div>
  )
}

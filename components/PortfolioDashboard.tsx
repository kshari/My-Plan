'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading portfolios…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <main>
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

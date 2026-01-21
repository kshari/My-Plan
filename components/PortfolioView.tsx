'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PositionManager from './PositionManager'
import PortfolioAnalysis from './PortfolioAnalysis'
import CSVUpload from './CSVUpload'

interface PortfolioViewProps {
  portfolioId: string
  onBack: () => void
  onUpdate: () => void
}

interface Portfolio {
  id: string
  name: string
  description?: string
}

export default function PortfolioView({ portfolioId, onBack, onUpdate }: PortfolioViewProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'positions' | 'analysis' | 'upload'>('positions')
  const supabase = createClient()

  useEffect(() => {
    fetchPortfolio()
    fetchPositions()
  }, [portfolioId])

  const fetchPortfolio = async () => {
    try {
      const { data, error } = await supabase
        .from('pa_portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single()

      if (error) throw error
      setPortfolio(data)
    } catch (error: any) {
      console.error('Error fetching portfolio:', error.message)
    }
  }

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('pa_positions')
        .select(`
          *,
          tickers (*),
          options_positions (*)
        `)
        .eq('portfolio_id', portfolioId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPositions(data || [])
    } catch (error: any) {
      console.error('Error fetching positions:', error.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-blue-600 hover:text-blue-800"
      >
        ← Back to Portfolios
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{portfolio?.name}</h1>
        {portfolio?.description && (
          <p className="mt-2 text-gray-600">{portfolio.description}</p>
        )}
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('positions')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'positions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            CSV Upload
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Analysis
          </button>
        </nav>
      </div>

      {activeTab === 'positions' && (
        <PositionManager
          portfolioId={portfolioId}
          positions={positions}
          onUpdate={fetchPositions}
        />
      )}

      {activeTab === 'upload' && (
        <CSVUpload
          portfolioId={portfolioId}
          onUploadSuccess={fetchPositions}
        />
      )}

      {activeTab === 'analysis' && (
        <PortfolioAnalysis
          portfolioId={portfolioId}
          positions={positions}
        />
      )}
    </div>
  )
}

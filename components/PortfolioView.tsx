'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, BarChart2, Upload, ListOrdered } from 'lucide-react'
import PositionManager from './PositionManager'
import PortfolioAnalysis from './PortfolioAnalysis'
import CSVUpload from './CSVUpload'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

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
        .select('*, tickers (*), options_positions (*)')
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Back + title */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-3 -ml-2 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All Portfolios
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{portfolio?.name}</h1>
        {portfolio?.description && (
          <p className="mt-1 text-sm text-muted-foreground">{portfolio.description}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="positions">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="positions" className="flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            CSV Upload
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-5">
          <PositionManager portfolioId={portfolioId} positions={positions} onUpdate={fetchPositions} />
        </TabsContent>

        <TabsContent value="upload" className="mt-5">
          <CSVUpload portfolioId={portfolioId} onUploadSuccess={fetchPositions} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-5">
          <PortfolioAnalysis portfolioId={portfolioId} positions={positions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

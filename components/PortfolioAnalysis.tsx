'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  calculatePositionMetrics,
  calculatePortfolioMetrics,
  type PositionData,
  type PortfolioMetrics,
} from '@/lib/utils/portfolio-analysis'
import { getMarketDataBatch, type MarketData } from '@/lib/utils/market-data'

interface PortfolioAnalysisProps {
  portfolioId: string
  positions: any[]
}

export default function PortfolioAnalysis({ portfolioId, positions }: PortfolioAnalysisProps) {
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null)
  const [positionMetricsList, setPositionMetricsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (positions.length === 0) {
      setLoading(false)
      return
    }

    calculateMetrics()
  }, [positions, portfolioId])

  const calculateMetrics = async () => {
    try {
      setLoading(true)
      
      // Collect all unique symbols
      const symbols = positions
        .map(p => p.tickers?.symbol)
        .filter((s): s is string => !!s)
      
      if (symbols.length === 0) {
        setLoading(false)
        return
      }

      // Fetch market data for all symbols in batch
      const marketDataMap = await getMarketDataBatch(symbols)
      
      // Build position data with metrics
      const positionsWithMetrics = await Promise.all(
        positions.map(async (position) => {
          const symbol = position.tickers?.symbol || ''
          
          // Get real market data or fallback to cost basis estimate
          let currentPrice: number
          let beta: number | undefined
          const marketData = marketDataMap.get(symbol) || null
          
          if (marketData) {
            currentPrice = marketData.currentPrice
            beta = marketData.beta
          } else {
            // Fallback: use cost basis per share as estimate if API fails
            const costBasisPerShare = position.cost_basis / position.quantity
            currentPrice = costBasisPerShare
            console.warn(`Could not fetch market data for ${symbol}, using cost basis estimate`)
          }
          
          // For options, we need the underlying stock price
          if (position.position_type === 'option' && position.options_positions?.[0]) {
            const option = position.options_positions[0]
            // For options, currentPrice is the underlying stock price
            // Calculate option intrinsic value (simplified - real pricing requires Black-Scholes)
            const stockPrice = currentPrice
            const strike = parseFloat(option.strike_price)
            
            // Intrinsic value calculation
            if (option.option_type === 'call') {
              // Call option: max(0, stockPrice - strike)
              currentPrice = Math.max(0, stockPrice - strike) / 100 // Price per share (options are per 100 shares)
            } else {
              // Put option: max(0, strike - stockPrice)
              currentPrice = Math.max(0, strike - stockPrice) / 100 // Price per share
            }
          }

          const positionData: PositionData = {
            ticker: symbol,
            quantity: parseFloat(position.quantity),
            costBasis: parseFloat(position.cost_basis),
            currentPrice,
            purchaseDate: position.purchase_date,
            type: position.position_type,
            optionData: position.options_positions?.[0] ? {
              strikePrice: parseFloat(position.options_positions[0].strike_price),
              expirationDate: position.options_positions[0].expiration_date,
              optionType: position.options_positions[0].option_type,
              premium: parseFloat(position.options_positions[0].premium),
              contracts: parseInt(position.options_positions[0].contracts || '1'),
            } : undefined,
          }

          const metrics = calculatePositionMetrics(positionData, {
            beta: beta || 1.0, // Default to 1.0 if beta not available
            currentPrice,
          })

          return {
            ...position,
            positionData,
            metrics,
          }
        })
      )

      // Calculate portfolio-level metrics
      const portfolioMetrics = calculatePortfolioMetrics(positionsWithMetrics)

      // Save metrics to database (optional)
      try {
        await supabase.from('pa_portfolio_metrics').insert({
          portfolio_id: portfolioId,
          total_value: portfolioMetrics.totalValue,
          total_cost_basis: portfolioMetrics.totalCostBasis,
          total_gain_loss: portfolioMetrics.totalGainLoss,
          total_gain_loss_pct: portfolioMetrics.totalGainLossPct,
          portfolio_beta: portfolioMetrics.portfolioBeta,
          portfolio_delta: portfolioMetrics.portfolioDelta,
          portfolio_cagr: portfolioMetrics.portfolioCAGR,
          risk_score: portfolioMetrics.riskScore,
        })
      } catch (error) {
        console.error('Error saving metrics:', error)
      }

      setPositionMetricsList(positionsWithMetrics)
      setPortfolioMetrics(portfolioMetrics)
    } catch (error: any) {
      console.error('Error calculating metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-lg">Calculating metrics...</div>
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <p className="text-gray-500">No positions to analyze. Add positions first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Portfolio-Level Metrics */}
      {portfolioMetrics && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Portfolio Overview</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                ${portfolioMetrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className={`rounded-lg p-4 ${
              portfolioMetrics.totalGainLoss >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <p className="text-sm font-medium text-gray-600">Gain/Loss</p>
              <p className={`mt-1 text-2xl font-bold ${
                portfolioMetrics.totalGainLoss >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                ${portfolioMetrics.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                <span className="ml-2 text-lg">
                  ({portfolioMetrics.totalGainLossPct.toFixed(2)}%)
                </span>
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm font-medium text-gray-600">Portfolio Beta</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {portfolioMetrics.portfolioBeta.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm font-medium text-gray-600">Portfolio CAGR</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {portfolioMetrics.portfolioCAGR.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-indigo-50 p-4">
              <p className="text-sm font-medium text-gray-600">Portfolio Delta</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {portfolioMetrics.portfolioDelta.toFixed(3)}
              </p>
            </div>
            <div className="rounded-lg bg-orange-50 p-4">
              <p className="text-sm font-medium text-gray-600">Risk Score</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {portfolioMetrics.riskScore.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Position-Level Metrics */}
      <div className="rounded-lg bg-white shadow">
        <h2 className="border-b border-gray-200 p-6 text-xl font-semibold text-gray-900">
          Position Analysis
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Symbol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Market Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Beta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Delta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  CAGR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Risk Factor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {positionMetricsList.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {item.positionData.ticker}
                    {item.positionData.type === 'option' && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                        {item.positionData.optionData?.optionType.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    ${item.metrics.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.metrics.beta.toFixed(2)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.metrics.delta.toFixed(3)}
                  </td>
                  <td className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${
                    item.metrics.cagr >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.metrics.cagr.toFixed(2)}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.metrics.riskFactor.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Live Market Data:</strong> Prices are fetched from Yahoo Finance and Alpha Vantage APIs. 
          Data is cached for 5 minutes to optimize performance. Some symbols may show estimated values if market data is unavailable.
        </p>
      </div>
    </div>
  )
}

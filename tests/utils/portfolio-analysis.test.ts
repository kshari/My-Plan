import { describe, it, expect } from 'vitest'
import {
  calculatePortfolioMetrics,
  calculatePositionMetrics,
  type PositionData,
  type PositionMetrics,
} from '@/lib/utils/portfolio-analysis'

describe('calculatePortfolioMetrics', () => {
  // Helper: create a PositionData with computed metrics
  function makePosition(
    ticker: string,
    quantity: number,
    costBasis: number,
    currentPrice: number
  ): PositionData & { metrics: PositionMetrics } {
    const position: PositionData = {
      ticker,
      quantity,
      costBasis,
      currentPrice,
      purchaseDate: '2023-01-01',
      type: 'stock',
    }
    const metrics = calculatePositionMetrics(position, {
      beta: 1.0,
      currentPrice,
    })
    return { ...position, metrics }
  }

  const mockPositions = [
    makePosition('AAPL', 10, 1500, 150.0),
    makePosition('GOOGL', 5, 12500, 2500.0),
    makePosition('MSFT', 8, 2800, 350.0),
  ]

  it('should calculate total portfolio value', () => {
    const metrics = calculatePortfolioMetrics(mockPositions)
    const expectedTotal =
      10 * 150.0 + 5 * 2500.0 + 8 * 350.0
    expect(metrics.totalValue).toBe(expectedTotal)
  })

  it('should calculate position-level metrics', () => {
    const metrics = calculatePortfolioMetrics(mockPositions)
    expect(metrics.totalValue).toBeGreaterThan(0)
    expect(metrics.totalCostBasis).toBeGreaterThan(0)
    expect(typeof metrics.portfolioBeta).toBe('number')
    expect(typeof metrics.portfolioCAGR).toBe('number')
  })

  it('should handle empty positions', () => {
    const metrics = calculatePortfolioMetrics([])
    expect(metrics.totalValue).toBe(0)
    expect(metrics.totalCostBasis).toBe(0)
  })

  it('should handle zero quantity positions', () => {
    const zeroPositions = [makePosition('AAPL', 0, 0, 150.0)]
    const metrics = calculatePortfolioMetrics(zeroPositions)
    expect(metrics.totalValue).toBe(0)
  })
})

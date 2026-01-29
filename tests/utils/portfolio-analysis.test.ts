import { describe, it, expect } from 'vitest'
import { calculatePortfolioMetrics } from '@/lib/utils/portfolio-analysis'

describe('calculatePortfolioMetrics', () => {
  const mockPositions = [
    { symbol: 'AAPL', quantity: 10, price: 150.0 },
    { symbol: 'GOOGL', quantity: 5, price: 2500.0 },
    { symbol: 'MSFT', quantity: 8, price: 350.0 },
  ]

  it('should calculate total portfolio value', () => {
    const metrics = calculatePortfolioMetrics(mockPositions)
    const expectedTotal =
      10 * 150.0 + 5 * 2500.0 + 8 * 350.0
    expect(metrics.totalValue).toBe(expectedTotal)
  })

  it('should calculate position weights', () => {
    const metrics = calculatePortfolioMetrics(mockPositions)
    expect(metrics.positions).toHaveLength(mockPositions.length)
    
    const totalValue = metrics.totalValue
    metrics.positions.forEach((position) => {
      expect(position.weight).toBeGreaterThan(0)
      expect(position.weight).toBeLessThanOrEqual(1)
      expect(position.value / totalValue).toBeCloseTo(position.weight, 2)
    })
  })

  it('should handle empty positions', () => {
    const metrics = calculatePortfolioMetrics([])
    expect(metrics.totalValue).toBe(0)
    expect(metrics.positions).toHaveLength(0)
  })

  it('should handle zero quantity positions', () => {
    const zeroPositions = [
      { symbol: 'AAPL', quantity: 0, price: 150.0 },
    ]
    const metrics = calculatePortfolioMetrics(zeroPositions)
    expect(metrics.totalValue).toBe(0)
  })
})

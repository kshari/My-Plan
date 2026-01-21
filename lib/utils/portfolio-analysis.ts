// Portfolio analysis utilities

export interface PositionData {
  ticker: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  purchaseDate: string;
  type: 'stock' | 'option';
  optionData?: {
    strikePrice: number;
    expirationDate: string;
    optionType: 'call' | 'put';
    premium: number;
    contracts: number;
  };
}

export interface PortfolioMetrics {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPct: number;
  portfolioBeta: number;
  portfolioDelta: number;
  portfolioCAGR: number;
  riskScore: number;
}

export interface PositionMetrics {
  beta: number;
  delta: number;
  cagr: number;
  riskFactor: number;
  currentPrice: number;
  marketValue: number;
}

// Calculate CAGR (Compound Annual Growth Rate)
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number {
  if (years === 0 || beginningValue === 0) return 0;
  return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
}

// Calculate position metrics
export function calculatePositionMetrics(
  position: PositionData,
  marketData: { beta?: number; currentPrice: number }
): PositionMetrics {
  const { quantity, costBasis, currentPrice, purchaseDate, type, optionData } = position;
  
  const purchaseDateObj = new Date(purchaseDate);
  const currentDate = new Date();
  const yearsHeld = (currentDate.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  const marketValue = type === 'option' && optionData
    ? currentPrice * optionData.contracts * 100 // Options are per 100 shares
    : currentPrice * quantity;
  
  const cagr = calculateCAGR(costBasis, marketValue, Math.max(yearsHeld, 0.001));
  
  // Beta calculation (simplified - would need historical data for accurate calculation)
  const beta = marketData.beta || 1.0;
  
  // Delta calculation for options
  let delta = 0;
  if (type === 'option' && optionData) {
    // Simplified delta calculation
    // In reality, this would use Black-Scholes or similar model
    const moneyness = currentPrice / optionData.strikePrice;
    if (optionData.optionType === 'call') {
      delta = Math.max(0, Math.min(1, moneyness - 0.5));
    } else {
      delta = Math.max(-1, Math.min(0, 0.5 - moneyness));
    }
  } else {
    delta = 1.0; // Stocks have delta of 1.0
  }
  
  // Risk factor (simplified - combination of beta and volatility)
  const riskFactor = Math.abs(beta) * Math.abs(delta);
  
  return {
    beta,
    delta,
    cagr,
    riskFactor,
    currentPrice,
    marketValue,
  };
}

// Calculate portfolio-level metrics
export function calculatePortfolioMetrics(
  positions: Array<PositionData & { metrics: PositionMetrics }>
): PortfolioMetrics {
  const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.metrics.marketValue, 0);
  const totalGainLoss = totalValue - totalCostBasis;
  const totalGainLossPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  
  // Weighted portfolio beta
  const portfolioBeta = positions.reduce((sum, p) => {
    const weight = p.costBasis / totalCostBasis;
    return sum + (p.metrics.beta * weight);
  }, 0);
  
  // Portfolio delta (sum of all deltas)
  const portfolioDelta = positions.reduce((sum, p) => sum + (p.metrics.delta * (p.costBasis / totalCostBasis)), 0);
  
  // Weighted portfolio CAGR
  const portfolioCAGR = positions.reduce((sum, p) => {
    const weight = p.costBasis / totalCostBasis;
    return sum + (p.metrics.cagr * weight);
  }, 0);
  
  // Risk score (average of risk factors weighted by position size)
  const riskScore = positions.reduce((sum, p) => {
    const weight = p.costBasis / totalCostBasis;
    return sum + (p.metrics.riskFactor * weight);
  }, 0);
  
  return {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalGainLossPct,
    portfolioBeta,
    portfolioDelta,
    portfolioCAGR,
    riskScore,
  };
}

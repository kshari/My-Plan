// Market data service with support for multiple providers

export interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume?: number
  marketCap?: number
  name?: string
}

export interface MarketData {
  currentPrice: number
  beta?: number
  name?: string
  change?: number
  changePercent?: number
}

// Cache for API responses to avoid rate limits
const priceCache = new Map<string, { data: MarketData; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch stock quote from Yahoo Finance (no API key required)
 */
async function fetchYahooFinanceQuote(symbol: string): Promise<MarketData | null> {
  try {
    // Yahoo Finance API endpoint (using yfinance-like API)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (!data.chart?.result?.[0]?.meta) {
      return null
    }

    const meta = data.chart.result[0].meta
    const regularMarketPrice = meta.regularMarketPrice || meta.previousClose
    
    if (!regularMarketPrice) {
      return null
    }

    return {
      currentPrice: regularMarketPrice,
      name: meta.longName || meta.shortName || symbol,
      change: meta.regularMarketChange,
      changePercent: meta.regularMarketChangePercent,
    }
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch stock quote from Alpha Vantage (requires API key)
 */
async function fetchAlphaVantageQuote(symbol: string, apiKey?: string): Promise<MarketData | null> {
  if (!apiKey) {
    return null
  }

  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`
    
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (data['Error Message'] || data['Note']) {
      // Rate limit or error
      return null
    }

    const quote = data['Global Quote']
    if (!quote || !quote['05. price']) {
      return null
    }

    const price = parseFloat(quote['05. price'])
    const change = parseFloat(quote['09. change'] || '0')
    const changePercent = parseFloat(quote['10. change percent']?.replace('%', '') || '0')

    return {
      currentPrice: price,
      change,
      changePercent,
    }
  } catch (error) {
    console.error(`Error fetching Alpha Vantage data for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch beta from Alpha Vantage (requires API key)
 */
async function fetchBeta(symbol: string, apiKey?: string): Promise<number | null> {
  if (!apiKey) {
    return null
  }

  try {
    // Use TIME_SERIES_DAILY_ADJUSTED to calculate beta
    // For simplicity, we'll use a default beta or fetch from another endpoint
    // Alpha Vantage doesn't directly provide beta, so we'll return null
    // and calculate it from historical data if needed
    return null
  } catch (error) {
    console.error(`Error fetching beta for ${symbol}:`, error)
    return null
  }
}

/**
 * Get market data for a symbol with caching and fallback providers
 */
export async function getMarketData(symbol: string): Promise<MarketData | null> {
  // Check cache first
  const cached = priceCache.get(symbol)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  const apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY

  // Try Alpha Vantage first if API key is available
  let marketData: MarketData | null = null
  
  if (apiKey) {
    marketData = await fetchAlphaVantageQuote(symbol, apiKey)
  }

  // Fallback to Yahoo Finance
  if (!marketData) {
    marketData = await fetchYahooFinanceQuote(symbol)
  }

  // If still no data, return null
  if (!marketData) {
    return null
  }

  // Fetch beta if available (optional)
  if (apiKey) {
    const beta = await fetchBeta(symbol, apiKey)
    if (beta !== null) {
      marketData.beta = beta
    }
  }

  // Cache the result
  priceCache.set(symbol, {
    data: marketData,
    timestamp: Date.now(),
  })

  return marketData
}

/**
 * Get market data for multiple symbols in batch
 */
export async function getMarketDataBatch(symbols: string[]): Promise<Map<string, MarketData>> {
  const results = new Map<string, MarketData>()
  
  // Fetch in parallel with rate limiting (max 5 concurrent requests)
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const promises = batch.map(async (symbol) => {
      const data = await getMarketData(symbol)
      if (data) {
        results.set(symbol, data)
      }
    })
    
    await Promise.all(promises)
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }

  return results
}

/**
 * Clear the price cache
 */
export function clearPriceCache() {
  priceCache.clear()
}

/**
 * Get ticker name/symbol information
 */
export async function getTickerInfo(symbol: string): Promise<{ name: string; symbol: string } | null> {
  const marketData = await getMarketData(symbol)
  
  if (!marketData) {
    return null
  }

  return {
    name: marketData.name || symbol,
    symbol: symbol.toUpperCase(),
  }
}

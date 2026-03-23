import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export interface MarketQuote {
  price: number
  previousClose: number | null
  currency: string
  shortName: string
  exchange: string
}

// GET /api/market-price?symbols=AAPL,MSFT,BTC-USD
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const raw = searchParams.get("symbols") ?? ""
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20) // safety cap

  if (symbols.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const prices: Record<string, MarketQuote> = {}

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url =
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
          `?interval=1d&range=1d&includePrePost=false`
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
          next: { revalidate: 0 },
        })
        if (!res.ok) return
        const json = await res.json()
        const meta = json?.chart?.result?.[0]?.meta
        if (!meta || meta.regularMarketPrice == null) return
        prices[symbol] = {
          price: meta.regularMarketPrice,
          previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
          currency: meta.currency ?? "USD",
          shortName: meta.shortName ?? meta.symbol ?? symbol,
          exchange: meta.exchangeName ?? meta.fullExchangeName ?? "",
        }
      } catch {
        // Skip symbol on error — caller handles missing keys
      }
    })
  )

  return NextResponse.json({ prices })
}

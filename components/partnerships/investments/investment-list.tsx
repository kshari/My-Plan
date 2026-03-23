"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp, Plus, ArrowUpRight, Wallet, Pencil,
  RefreshCw, CloudOff, Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
  INVESTMENT_TYPE_LABELS,
  WORKFLOW_STAGE_LABELS,
} from "@/lib/constants/partnerships"
import type { PartnershipInvestment } from "@/lib/types/partnerships"
import type { MarketQuote } from "@/app/api/market-price/route"
import { cn } from "@/lib/utils"

interface InvestmentListProps {
  entityId: string
  investments: PartnershipInvestment[]
  isAdmin: boolean
  cashBalance: number
  cashBalanceAsOf: string | null
  capitalContributed: number | null
}

const STATUS_STYLES: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-transparent",
  on_hold:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-transparent",
  exited:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-transparent",
  cancelled: "bg-muted text-muted-foreground border-transparent",
}

const STAGE_STYLES: Record<string, string> = {
  ideation: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-transparent",
  due_diligence: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-transparent",
  decision: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-transparent",
  capital_collection: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-transparent",
  execution: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-transparent",
  management: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-transparent",
  exit: "bg-muted text-muted-foreground border-transparent",
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n)
}

function fmt(n: number | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n)
}

function fmtPrice(n: number | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

function fmtShares(n: number | null) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n)
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

function purchasePricePerUnit(inv: PartnershipInvestment): number | null {
  if (inv.target_amount == null || inv.num_shares == null || inv.num_shares === 0) return null
  return inv.target_amount / inv.num_shares
}

function currentValue(inv: PartnershipInvestment, livePrice?: number): { value: number; isMarket: boolean; isLive: boolean } {
  const marketPrice = livePrice ?? inv.market_price_per_share
  if (marketPrice != null && inv.num_shares != null) {
    return { value: marketPrice * inv.num_shares, isMarket: true, isLive: livePrice != null }
  }
  return { value: inv.target_amount ?? 0, isMarket: false, isLive: false }
}

export function InvestmentList({ entityId, investments, isAdmin, cashBalance, cashBalanceAsOf, capitalContributed }: InvestmentListProps) {
  const router = useRouter()
  const active = investments.filter((i) => i.status !== "cancelled")

  // Live prices from Yahoo Finance: ticker → quote
  const [livePrices, setLivePrices] = useState<Record<string, MarketQuote>>({})
  const [fetchingPrices, setFetchingPrices] = useState(false)
  const [pricesFetched, setPricesFetched] = useState(false)
  const [syncingPrices, setSyncingPrices] = useState(false)

  // Collect unique tickers from active investments
  const tickeredInvestments = active.filter((i) => i.ticker)
  const uniqueTickers = [...new Set(tickeredInvestments.map((i) => i.ticker as string))]

  const fetchLivePrices = useCallback(async () => {
    if (uniqueTickers.length === 0) return
    setFetchingPrices(true)
    try {
      const res = await fetch(`/api/market-price?symbols=${uniqueTickers.join(",")}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLivePrices(data.prices ?? {})
      setPricesFetched(true)
    } catch {
      // Silently fail — stored prices will be shown
    } finally {
      setFetchingPrices(false)
    }
  }, [uniqueTickers.join(",")])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch on mount when there are tickered investments
  useEffect(() => {
    fetchLivePrices()
  }, [fetchLivePrices])

  // Save live prices to DB
  async function syncPricesToDB() {
    const toSync = tickeredInvestments.filter((inv) => {
      const quote = livePrices[inv.ticker!]
      return quote && quote.price !== inv.market_price_per_share
    })
    if (toSync.length === 0) {
      toast.info("Prices are already up to date")
      return
    }
    setSyncingPrices(true)
    try {
      await Promise.all(
        toSync.map((inv) =>
          fetch(`/api/partnerships/${entityId}/investments/${inv.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ market_price_per_share: livePrices[inv.ticker!].price }),
          })
        )
      )
      toast.success(`Updated market prices for ${toSync.length} investment${toSync.length !== 1 ? "s" : ""}`)
      router.refresh()
    } catch {
      toast.error("Failed to sync some prices")
    } finally {
      setSyncingPrices(false)
    }
  }

  // Totals
  const totalAmount = active.reduce((sum, i) => sum + (i.target_amount ?? 0), 0)
  const totalShares = active.some((i) => i.num_shares != null)
    ? active.reduce((sum, i) => sum + (i.num_shares ?? 0), 0)
    : null
  const totalCurrentValue = active.reduce((sum, i) => {
    const livePrice = i.ticker ? livePrices[i.ticker]?.price : undefined
    return sum + currentValue(i, livePrice).value
  }, 0)
  const hasAnyMarketPrice = active.some((i) => i.market_price_per_share != null || (i.ticker && livePrices[i.ticker]))

  // Detect any price changes from live data
  const hasPriceChanges = pricesFetched && tickeredInvestments.some((inv) => {
    const quote = livePrices[inv.ticker!]
    return quote && quote.price !== inv.market_price_per_share
  })

  // Cash balance state
  const [cashOpen, setCashOpen] = useState(false)
  const [cashValue, setCashValue] = useState(cashBalance.toString())
  const [asOfValue, setAsOfValue] = useState(cashBalanceAsOf ?? "")
  const [saving, setSaving] = useState(false)

  async function saveCash() {
    setSaving(true)
    try {
      const res = await fetch(`/api/partnerships/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash_balance: cashValue,
          cash_balance_as_of: asOfValue || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Cash balance updated")
      setCashOpen(false)
      router.refresh()
    } catch {
      toast.error("Failed to update cash balance")
    } finally {
      setSaving(false)
    }
  }

  if (active.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-4" />
          <h2 className="text-base font-semibold">No investments yet</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Add your first investment opportunity to start tracking its progress.
          </p>
          {isAdmin && (
            <Button asChild size="sm" variant="outline" className="mt-6">
              <Link href={`/apps/partnerships/${entityId}/investments/new`}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Investment
              </Link>
            </Button>
          )}
        </div>
        <CashBalanceRow
          cashBalance={cashBalance}
          cashBalanceAsOf={cashBalanceAsOf}
          isAdmin={isAdmin}
          onEdit={() => { setCashValue(cashBalance.toString()); setAsOfValue(cashBalanceAsOf ?? ""); setCashOpen(true) }}
        />
        <CashDialog
          open={cashOpen}
          value={cashValue}
          asOfValue={asOfValue}
          saving={saving}
          onChange={setCashValue}
          onAsOfChange={setAsOfValue}
          onSave={saveCash}
          onClose={() => setCashOpen(false)}
        />
      </>
    )
  }

  return (
    <TooltipProvider>
      <>
        {/* Prices toolbar */}
        {uniqueTickers.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              {fetchingPrices ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Fetching live prices…</span>
                </>
              ) : pricesFetched ? (
                <>
                  <Zap className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-foreground font-medium">Live prices loaded</span>
                  <span className="text-muted-foreground hidden sm:inline">
                    · {uniqueTickers.length} ticker{uniqueTickers.length !== 1 ? "s" : ""} via Yahoo Finance
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="h-3.5 w-3.5" />
                  <span>Could not load live prices</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={fetchLivePrices}
                disabled={fetchingPrices}
              >
                <RefreshCw className={cn("h-3 w-3 mr-1", fetchingPrices && "animate-spin")} />
                Refresh
              </Button>
              {hasPriceChanges && isAdmin && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={syncPricesToDB}
                  disabled={syncingPrices}
                >
                  {syncingPrices ? "Syncing…" : "Sync Prices to DB"}
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Investment</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Stage</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Cost</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Shares / Units</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Purchase $/Unit</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Market $/Unit</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Current Value</TableHead>
                <TableHead className="hidden lg:table-cell text-right">P / L</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((inv) => {
                const purchase = purchasePricePerUnit(inv)
                const liveQuote = inv.ticker ? livePrices[inv.ticker] : undefined
                const livePrice = liveQuote?.price
                const cv = currentValue(inv, livePrice)
                const displayMarketPrice = livePrice ?? inv.market_price_per_share
                const priceChanged = livePrice != null && livePrice !== inv.market_price_per_share
                const pricePct = priceChanged && inv.market_price_per_share
                  ? ((livePrice - inv.market_price_per_share) / inv.market_price_per_share) * 100
                  : null
                const pl = cv.isMarket && inv.target_amount != null ? cv.value - inv.target_amount : null
                const plPct = pl != null && inv.target_amount != null && inv.target_amount > 0
                  ? (pl / inv.target_amount) * 100
                  : null

                return (
                  <TableRow
                    key={inv.id}
                    className="group cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() =>
                      window.location.assign(
                        `/apps/partnerships/${entityId}/investments/${inv.id}`
                      )
                    }
                  >
                    {/* Name + ticker badge + mobile meta */}
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium group-hover:text-blue-600 transition-colors leading-tight">
                          {inv.name}
                        </p>
                        {inv.ticker && (
                          <span className="shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {inv.ticker}
                          </span>
                        )}
                      </div>
                      {inv.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {inv.description}
                        </p>
                      )}
                      {/* Mobile-only inline badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5 sm:hidden">
                        <Badge
                          variant="outline"
                          className={cn("text-xs px-1.5 py-0", STAGE_STYLES[inv.current_stage])}
                        >
                          {WORKFLOW_STAGE_LABELS[inv.current_stage]}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                      {INVESTMENT_TYPE_LABELS[inv.investment_type]}
                    </TableCell>

                    {/* Stage */}
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn("text-xs", STAGE_STYLES[inv.current_stage])}>
                        {WORKFLOW_STAGE_LABELS[inv.current_stage]}
                      </Badge>
                    </TableCell>

                    {/* Cost */}
                    <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                      {fmt(inv.target_amount)}
                    </TableCell>

                    {/* Shares */}
                    <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm text-muted-foreground">
                      {fmtShares(inv.num_shares)}
                    </TableCell>

                    {/* Purchase $/unit */}
                    <TableCell className="hidden xl:table-cell text-right tabular-nums text-sm text-muted-foreground">
                      {fmtPrice(purchase)}
                    </TableCell>

                    {/* Market $/unit — live or stored */}
                    <TableCell className="hidden xl:table-cell text-right tabular-nums text-sm">
                      {displayMarketPrice != null ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              <span className={livePrice != null ? "text-foreground" : "text-muted-foreground"}>
                                {fmtPrice(displayMarketPrice)}
                              </span>
                              {livePrice != null && (
                                <span className="ml-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 align-super">
                                  LIVE
                                </span>
                              )}
                              {pricePct != null && (
                                <span className={cn(
                                  "ml-1 text-[10px] font-medium",
                                  pricePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                                )}>
                                  {pricePct >= 0 ? "▲" : "▼"}{Math.abs(pricePct).toFixed(1)}%
                                </span>
                              )}
                            </span>
                          </TooltipTrigger>
                          {liveQuote && (
                            <TooltipContent side="left" className="text-xs">
                              <p className="font-semibold">{liveQuote.shortName}</p>
                              <p>{liveQuote.exchange} · {liveQuote.currency}</p>
                              {liveQuote.previousClose && (
                                <p className="text-muted-foreground">Prev close: {fmtPrice(liveQuote.previousClose)}</p>
                              )}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Current value */}
                    <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                      <span className={cv.isMarket ? "text-foreground" : "text-muted-foreground"}>
                        {fmt(cv.value)}
                      </span>
                      {!cv.isMarket && cv.value > 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground/60">cost</span>
                      )}
                    </TableCell>

                    {/* P/L */}
                    <TableCell className="hidden lg:table-cell text-right tabular-nums text-sm">
                      {pl != null ? (
                        <span className={pl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {pl >= 0 ? "+" : ""}{fmt(pl)}
                          {plPct != null && (
                            <span className="ml-1 text-[10px] font-medium">
                              ({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Arrow */}
                    <TableCell className="pr-4 text-right">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground inline-block group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent font-semibold text-sm">
                <TableCell className="pl-5 py-3">
                  <span className="text-muted-foreground font-normal text-xs mr-2">
                    {active.length} investment{active.length !== 1 ? "s" : ""}
                  </span>
                  Total
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden lg:table-cell text-right tabular-nums">
                  {totalAmount > 0
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalAmount)
                    : "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-right tabular-nums text-muted-foreground">
                  {totalShares != null
                    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(totalShares)
                    : "—"}
                </TableCell>
                <TableCell className="hidden xl:table-cell" />
                <TableCell className="hidden xl:table-cell" />
                <TableCell className="hidden lg:table-cell text-right tabular-nums">
                  <span>{totalCurrentValue > 0
                    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalCurrentValue)
                    : "—"}</span>
                  {!hasAnyMarketPrice && totalCurrentValue > 0 && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground/60">at cost</span>
                  )}
                </TableCell>
                {/* P/L total */}
                <TableCell className="hidden lg:table-cell text-right tabular-nums">
                  {hasAnyMarketPrice && totalAmount > 0 ? (() => {
                    const totalPL = totalCurrentValue - totalAmount
                    const totalPLPct = (totalPL / totalAmount) * 100
                    return (
                      <span className={totalPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                        {totalPL >= 0 ? "+" : ""}{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalPL)}
                        <span className="ml-1 text-[10px] font-normal">
                          ({totalPLPct >= 0 ? "+" : ""}{totalPLPct.toFixed(1)}%)
                        </span>
                      </span>
                    )
                  })() : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Cash balance row */}
        <CashBalanceRow
          cashBalance={cashBalance}
          cashBalanceAsOf={cashBalanceAsOf}
          isAdmin={isAdmin}
          onEdit={() => { setCashValue(cashBalance.toString()); setAsOfValue(cashBalanceAsOf ?? ""); setCashOpen(true) }}
        />

        {/* Portfolio summary */}
        {(totalCurrentValue > 0 || cashBalance > 0 || totalAmount > 0 || (capitalContributed ?? 0) > 0) && (() => {
          const portfolioValue = totalCurrentValue + cashBalance
          const totalCapital = capitalContributed ?? totalAmount
          const totalCapitalLabel = capitalContributed != null ? "Capital Contributed" : "Total Capital"
          const totalCapitalSub = capitalContributed != null ? "From cap table" : "Sum of all investment costs"
          const totalPL = portfolioValue - totalCapital
          const totalPLPct = totalCapital > 0 ? (totalPL / totalCapital) * 100 : null
          const moic = totalCapital > 0 ? portfolioValue / totalCapital : null

          return (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-3 divide-x">
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    {totalCapitalLabel}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {totalCapital > 0 ? fmtCurrency(totalCapital) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{totalCapitalSub}</p>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Portfolio Value
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {fmtCurrency(portfolioValue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Investments{!hasAnyMarketPrice ? " (at cost)" : ""} + cash
                  </p>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Total P / L
                  </p>
                  {totalCapital > 0 && hasAnyMarketPrice ? (
                    <>
                      <p className={cn(
                        "text-lg font-bold tabular-nums",
                        totalPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      )}>
                        {totalPL >= 0 ? "+" : ""}{fmtCurrency(totalPL)}
                      </p>
                      <p className={cn(
                        "text-xs font-medium mt-0.5",
                        totalPL >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      )}>
                        {totalPLPct != null ? (totalPLPct >= 0 ? "+" : "") + totalPLPct.toFixed(1) : ""}% gain/loss · {moic?.toFixed(2)}x MOIC
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Edit cash dialog */}
        <CashDialog
          open={cashOpen}
          value={cashValue}
          asOfValue={asOfValue}
          saving={saving}
          onChange={setCashValue}
          onAsOfChange={setAsOfValue}
          onSave={saveCash}
          onClose={() => setCashOpen(false)}
        />
      </>
    </TooltipProvider>
  )
}

/* ── sub-components ─────────────────────────────────────────────────────── */

function CashBalanceRow({
  cashBalance,
  cashBalanceAsOf,
  isAdmin,
  onEdit,
}: {
  cashBalance: number
  cashBalanceAsOf: string | null
  isAdmin: boolean
  onEdit: () => void
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Wallet className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-sm font-semibold">Cash Balance</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Uninvested cash held by the entity
          </span>
        </div>
        <div className="flex items-center gap-3">
          {cashBalanceAsOf && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              as of {fmtDate(cashBalanceAsOf)}
            </span>
          )}
          <span
            className={cn(
              "tabular-nums font-semibold text-sm",
              cashBalance < 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {fmtCurrency(cashBalance)}
          </span>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function CashDialog({
  open,
  value,
  asOfValue,
  saving,
  onChange,
  onAsOfChange,
  onSave,
  onClose,
}: {
  open: boolean
  value: string
  asOfValue: string
  saving: boolean
  onChange: (v: string) => void
  onAsOfChange: (v: string) => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Cash Balance</DialogTitle>
          <DialogDescription>
            Enter the current uninvested cash balance and the date it was recorded.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="cash_balance">Cash Balance ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                id="cash_balance"
                type="number"
                step="any"
                min={0}
                className="pl-7"
                placeholder="0.00"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !saving && onSave()}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cash_balance_as_of">As of Date</Label>
            <Input
              id="cash_balance_as_of"
              type="date"
              value={asOfValue}
              onChange={(e) => onAsOfChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The date this balance was recorded or last confirmed.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={onSave} disabled={saving || value === ""} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

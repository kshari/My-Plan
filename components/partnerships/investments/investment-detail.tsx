"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Edit, BookOpen, FolderOpen, Vote, ChevronRight, ExternalLink, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { WorkflowStepper } from "@/components/partnerships/investments/workflow-stepper"
import {
  INVESTMENT_TYPE_LABELS,
  WORKFLOW_STAGES,
  WORKFLOW_STAGE_LABELS,
  WORKFLOW_STAGE_DESCRIPTIONS,
} from "@/lib/constants/partnerships"
import type { PartnershipInvestment, InvestmentStage, WorkflowStage } from "@/lib/types/partnerships"
import type { MarketQuote } from "@/app/api/market-price/route"
import { cn } from "@/lib/utils"

interface InvestmentDetailProps {
  entityId: string
  investment: PartnershipInvestment
  stages: InvestmentStage[]
  isAdmin: boolean
}

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(n)
}

export function InvestmentDetail({ entityId, investment, stages, isAdmin }: InvestmentDetailProps) {
  const router = useRouter()
  const base = `/apps/partnerships/${entityId}/investments/${investment.id}`
  const [stageOpen, setStageOpen] = useState(false)
  const [targetStage, setTargetStage] = useState<WorkflowStage | "">("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // Live market price via Yahoo Finance
  const [liveQuote, setLiveQuote] = useState<MarketQuote | null>(null)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const [priceFetched, setPriceFetched] = useState(false)

  async function fetchLivePrice() {
    if (!investment.ticker) return
    setFetchingPrice(true)
    try {
      const res = await fetch(`/api/market-price?symbols=${encodeURIComponent(investment.ticker)}`)
      const data = await res.json()
      const quote: MarketQuote | undefined = data?.prices?.[investment.ticker]
      setLiveQuote(quote ?? null)
      setPriceFetched(true)
    } catch {
      setLiveQuote(null)
    } finally {
      setFetchingPrice(false)
    }
  }

  async function saveMarketPrice(price: number) {
    try {
      const res = await fetch(
        `/api/partnerships/${entityId}/investments/${investment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ market_price_per_share: price }),
        }
      )
      if (!res.ok) throw new Error()
      toast.success("Market price updated")
      router.refresh()
    } catch {
      toast.error("Failed to save price")
    }
  }

  // Auto-fetch on mount when ticker is set
  useEffect(() => {
    if (investment.ticker) fetchLivePrice()
  }, [investment.ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayMarketPrice = liveQuote?.price ?? investment.market_price_per_share
  const priceChangePct =
    liveQuote && investment.market_price_per_share
      ? ((liveQuote.price - investment.market_price_per_share) / investment.market_price_per_share) * 100
      : null

  const currentIndex = WORKFLOW_STAGES.indexOf(investment.current_stage)
  const targetIndex = targetStage ? WORKFLOW_STAGES.indexOf(targetStage) : -1
  // How many stages will be backfilled as "completed"
  const backfillCount = targetIndex > currentIndex + 1 ? targetIndex - currentIndex - 1 : 0

  function openStageDialog() {
    setTargetStage("")
    setNotes("")
    setStageOpen(true)
  }

  async function handleStageChange() {
    if (!targetStage || targetStage === investment.current_stage) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/partnerships/${entityId}/investments/${investment.id}/stages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: targetStage, notes }),
        }
      )
      if (!res.ok) throw new Error("Failed to update stage")
      const { backfilled } = await res.json()
      toast.success(
        backfilled > 0
          ? `Stage set to ${WORKFLOW_STAGE_LABELS[targetStage]} — ${backfilled} prior stage${backfilled > 1 ? "s" : ""} marked completed`
          : `Stage updated to ${WORKFLOW_STAGE_LABELS[targetStage]}`
      )
      setStageOpen(false)
      setNotes("")
      router.refresh()
    } catch {
      toast.error("Failed to update stage")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{investment.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {INVESTMENT_TYPE_LABELS[investment.investment_type]}
            {investment.investment_manager ? ` · ${investment.investment_manager}` : ""}
            {investment.ticker ? (
              <>
                {" · "}
                <a
                  href={`https://finance.yahoo.com/quote/${investment.ticker}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {investment.ticker}
                  <ExternalLink className="h-3 w-3 inline" />
                </a>
              </>
            ) : null}
            {investment.target_amount ? ` · ${fmt(investment.target_amount)} total` : ""}
            {investment.num_shares != null
              ? ` · ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(investment.num_shares)} shares`
              : ""}
          </p>
          {investment.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{investment.description}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/edit`}>
                <Edit className="h-4 w-4 mr-1.5" />
                Edit
              </Link>
            </Button>
            <Button size="sm" onClick={openStageDialog}>
              Change Stage
            </Button>
          </div>
        )}
      </div>

      {/* Workflow stepper */}
      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold mb-4">Investment Workflow</h2>
        <WorkflowStepper currentStage={investment.current_stage} />
        <p className="mt-3 text-sm text-muted-foreground">
          {WORKFLOW_STAGE_DESCRIPTIONS[investment.current_stage]}
        </p>
      </div>

      {/* Key metrics row */}
      {(investment.target_amount != null ||
        investment.num_shares != null ||
        investment.market_price_per_share != null ||
        investment.investment_manager ||
        investment.ticker) && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Investment Details</h2>
            {investment.ticker && (
              <div className="flex items-center gap-2">
                {priceFetched && liveQuote && liveQuote.price !== investment.market_price_per_share && isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => saveMarketPrice(liveQuote.price)}
                  >
                    Save Price
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={fetchLivePrice}
                  disabled={fetchingPrice}
                >
                  {fetchingPrice
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh Price
                </Button>
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 text-sm">
            {investment.investment_manager && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs text-muted-foreground mb-0.5">Investment Manager</dt>
                <dd className="font-medium">{investment.investment_manager}</dd>
              </div>
            )}
            {investment.target_amount != null && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Total Investment</dt>
                <dd className="font-semibold tabular-nums">{fmt(investment.target_amount)}</dd>
              </div>
            )}
            {investment.num_shares != null && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Shares / Units</dt>
                <dd className="font-semibold tabular-nums">
                  {new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
                    investment.num_shares
                  )}
                </dd>
              </div>
            )}
            {investment.target_amount != null &&
              investment.num_shares != null &&
              investment.num_shares > 0 && (
                <div>
                  <dt className="text-xs text-muted-foreground mb-0.5">Purchase Price / Unit</dt>
                  <dd className="font-semibold tabular-nums">
                    {fmtPrice(investment.target_amount / investment.num_shares)}
                  </dd>
                </div>
              )}
            {(displayMarketPrice != null) && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1.5">
                  Market Price / Unit
                  {fetchingPrice && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {liveQuote && !fetchingPrice && (
                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.5 rounded">
                      LIVE
                    </span>
                  )}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {fmtPrice(displayMarketPrice)}
                </dd>
                {priceChangePct != null && (
                  <p className={cn(
                    "text-xs font-medium mt-0.5",
                    priceChangePct >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}>
                    {priceChangePct >= 0 ? "▲" : "▼"} {Math.abs(priceChangePct).toFixed(2)}% vs purchase
                  </p>
                )}
                {liveQuote && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {liveQuote.shortName} · {liveQuote.exchange}
                  </p>
                )}
              </div>
            )}
            {/* Current total value */}
            {displayMarketPrice != null && investment.num_shares != null && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Current Total Value</dt>
                <dd className="font-semibold tabular-nums">
                  {fmt(displayMarketPrice * investment.num_shares)}
                </dd>
                {investment.target_amount != null && displayMarketPrice * investment.num_shares !== investment.target_amount && (
                  <p className={cn(
                    "text-xs font-medium mt-0.5",
                    displayMarketPrice * investment.num_shares >= investment.target_amount
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}>
                    {displayMarketPrice * investment.num_shares >= investment.target_amount ? "+" : ""}
                    {fmt(displayMarketPrice * investment.num_shares - investment.target_amount)} vs cost
                  </p>
                )}
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Details grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stage history */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Stage History</h2>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div className="space-y-3">
              {stages.map((s) => (
                <div key={s.id} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <ChevronRight className="h-3 w-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{WORKFLOW_STAGE_LABELS[s.stage]}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.entered_at).toLocaleDateString()}
                    </p>
                    {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-base font-semibold mb-4">Investment Resources</h2>
          <div className="space-y-2">
            {[
              { href: `${base}/ledger`, icon: BookOpen, label: "Transaction Ledger", desc: "Income, expenses, and cash flows" },
              { href: `${base}/decisions`, icon: Vote, label: "Decisions & Votes", desc: "Investment-specific votes" },
              { href: `${base}/documents`, icon: FolderOpen, label: "Documents", desc: "Contracts, statements, and more" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors group"
              >
                <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Change stage dialog */}
      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Investment Stage</DialogTitle>
            <DialogDescription>
              Select any stage — stages skipped forward will be automatically marked as completed in the history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
              <span className="text-muted-foreground">Current:</span>
              <span className="font-medium">{WORKFLOW_STAGE_LABELS[investment.current_stage]}</span>
            </div>

            <div className="space-y-2">
              <Label>Set Stage To</Label>
              <Select
                value={targetStage}
                onValueChange={(v) => setTargetStage(v as WorkflowStage)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage…" />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_STAGES.filter((s) => s !== investment.current_stage).map((s) => {
                    const idx = WORKFLOW_STAGES.indexOf(s)
                    const isPast = idx < currentIndex
                    return (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          {WORKFLOW_STAGE_LABELS[s]}
                          {isPast && (
                            <span className="text-xs text-muted-foreground">(revert)</span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {backfillCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">
                  {backfillCount} stage{backfillCount > 1 ? "s" : ""} will be marked completed:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {WORKFLOW_STAGES.slice(currentIndex + 1, targetIndex).map((s) => (
                    <li key={s}>{WORKFLOW_STAGE_LABELS[s]}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="stage_notes">Notes</Label>
              <Textarea
                id="stage_notes"
                placeholder="Describe the reason for this stage change…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleStageChange}
                disabled={saving || !targetStage || targetStage === investment.current_stage}
                className="flex-1"
              >
                {saving ? "Saving…" : "Update Stage"}
              </Button>
              <Button variant="outline" onClick={() => setStageOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

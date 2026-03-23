"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { INVESTMENT_TYPES, WORKFLOW_STAGES, WORKFLOW_STAGE_LABELS } from "@/lib/constants/partnerships"
import type { InvestmentType, PartnershipInvestment, WorkflowStage } from "@/lib/types/partnerships"
import type { MarketQuote } from "@/app/api/market-price/route"

interface InvestmentFormProps {
  entityId: string
  investment?: PartnershipInvestment
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

export function InvestmentForm({ entityId, investment }: InvestmentFormProps) {
  const router = useRouter()
  const isEdit = !!investment
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: investment?.name ?? "",
    investment_type: (investment?.investment_type ?? "other") as InvestmentType,
    investment_manager: investment?.investment_manager ?? "",
    ticker: investment?.ticker ?? "",
    current_stage: (investment?.current_stage ?? "ideation") as WorkflowStage,
    description: investment?.description ?? "",
    target_amount: investment?.target_amount?.toString() ?? "",
    num_shares: investment?.num_shares?.toString() ?? "",
    market_price_per_share: investment?.market_price_per_share?.toString() ?? "",
  })

  // Ticker lookup state
  const [tickerLookup, setTickerLookup] = useState<{
    status: "idle" | "loading" | "found" | "error"
    quote?: MarketQuote
  }>({ status: "idle" })

  async function lookupTicker() {
    const symbol = form.ticker.trim().toUpperCase()
    if (!symbol) return
    setTickerLookup({ status: "loading" })
    try {
      const res = await fetch(`/api/market-price?symbols=${encodeURIComponent(symbol)}`)
      const data = await res.json()
      const quote: MarketQuote | undefined = data?.prices?.[symbol]
      if (!quote) {
        setTickerLookup({ status: "error" })
        return
      }
      setTickerLookup({ status: "found", quote })
      setForm((f) => ({ ...f, market_price_per_share: quote.price.toString() }))
    } catch {
      setTickerLookup({ status: "error" })
    }
  }

  // Stages that will be auto-backfilled as "completed" on create
  const stageIndex = WORKFLOW_STAGES.indexOf(form.current_stage)
  const backfillStages = !isEdit && stageIndex > 0 ? WORKFLOW_STAGES.slice(0, stageIndex) : []

  // Derived: purchase price per share = target_amount / num_shares
  const purchasePricePerShare =
    form.target_amount && form.num_shares && Number(form.num_shares) > 0
      ? Number(form.target_amount) / Number(form.num_shares)
      : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    setLoading(true)
    try {
      const url = isEdit
        ? `/api/partnerships/${entityId}/investments/${investment.id}`
        : `/api/partnerships/${entityId}/investments`
      const method = isEdit ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticker: form.ticker.trim().toUpperCase() || null,
          investment_manager: form.investment_manager.trim() || null,
          target_amount: form.target_amount ? Number(form.target_amount) : null,
          num_shares: form.num_shares ? Number(form.num_shares) : null,
          market_price_per_share: form.market_price_per_share
            ? Number(form.market_price_per_share)
            : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save investment")
      const data = await res.json()
      toast.success(isEdit ? "Investment updated" : "Investment created")
      router.push(`/apps/partnerships/${entityId}/investments/${data.investment.id}`)
    } catch {
      toast.error("Failed to save investment")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Investment Name *</Label>
        <Input
          id="name"
          placeholder="e.g. 123 Main St Duplex"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      {/* Type + Manager */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Investment Type *</Label>
          <Select
            value={form.investment_type}
            onValueChange={(v) => setForm({ ...form, investment_type: v as InvestmentType })}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="investment_manager">Investment Manager</Label>
          <Input
            id="investment_manager"
            placeholder="e.g. Vanguard, Blackstone, Self-managed"
            value={form.investment_manager}
            onChange={(e) => setForm({ ...form, investment_manager: e.target.value })}
          />
        </div>
      </div>

      {/* Ticker */}
      <div className="space-y-2">
        <Label htmlFor="ticker">Ticker / Symbol</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="ticker"
              placeholder="e.g. AAPL, MSFT, BTC-USD"
              value={form.ticker}
              onChange={(e) => {
                setForm({ ...form, ticker: e.target.value.toUpperCase() })
                setTickerLookup({ status: "idle" })
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); lookupTicker() }
              }}
              className="uppercase pr-8 font-mono"
            />
            {tickerLookup.status === "found" && (
              <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
            )}
            {tickerLookup.status === "error" && (
              <AlertCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive pointer-events-none" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={lookupTicker}
            disabled={!form.ticker.trim() || tickerLookup.status === "loading"}
            className="shrink-0"
          >
            {tickerLookup.status === "loading"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Search className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Look up</span>
          </Button>
        </div>
        {tickerLookup.status === "found" && tickerLookup.quote && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {tickerLookup.quote.shortName}
            {tickerLookup.quote.exchange ? ` · ${tickerLookup.quote.exchange}` : ""}
            {" · "}{tickerLookup.quote.currency} {fmtPrice(tickerLookup.quote.price)}
            {" "}— market price pre-filled below
          </p>
        )}
        {tickerLookup.status === "error" && (
          <p className="text-xs text-destructive">
            Symbol not found on Yahoo Finance. Check the ticker and try again.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Optional. When set, market prices are fetched automatically from Yahoo Finance.
        </p>
      </div>

      {/* Current Stage */}
      <div className="space-y-2">
        <Label htmlFor="current_stage">
          {isEdit ? "Current Stage" : "Starting Stage"}
        </Label>
        <Select
          value={form.current_stage}
          onValueChange={(v) => setForm({ ...form, current_stage: v as WorkflowStage })}
        >
          <SelectTrigger id="current_stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WORKFLOW_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {WORKFLOW_STAGE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {backfillStages.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Prior stages will be recorded as completed:{" "}
            {backfillStages.map((s) => WORKFLOW_STAGE_LABELS[s]).join(" → ")}
          </p>
        )}
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Changing the stage here will record it in the history. Prior skipped stages are not
            auto-backfilled on edit — use "Change Stage" on the detail page for full backfill.
          </p>
        )}
      </div>

      {/* Amount + Shares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="target_amount">Total Investment Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="target_amount"
              type="number"
              min={0}
              step="any"
              placeholder="500000"
              value={form.target_amount}
              onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
              className="pl-7"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="num_shares">Number of Shares / Units</Label>
          <Input
            id="num_shares"
            type="number"
            min={0}
            step="any"
            placeholder="e.g. 1000"
            value={form.num_shares}
            onChange={(e) => setForm({ ...form, num_shares: e.target.value })}
          />
        </div>
      </div>

      {/* Computed purchase price + market price */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Purchase Price per Share</Label>
          <div className="flex items-center h-9 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {purchasePricePerShare != null
              ? fmtPrice(purchasePricePerShare)
              : "— (enter total amount and shares)"}
          </div>
          <p className="text-xs text-muted-foreground">Calculated: Total Amount ÷ Shares</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="market_price_per_share">Current Market Price per Share</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="market_price_per_share"
              type="number"
              min={0}
              step="any"
              placeholder="0.00"
              value={form.market_price_per_share}
              onChange={(e) => setForm({ ...form, market_price_per_share: e.target.value })}
              className="pl-7"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {form.ticker.trim()
              ? "Auto-populated from Yahoo Finance. Edit to override."
              : "Optional — update as prices change, or set a ticker to auto-fetch."}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe the investment opportunity..."
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Investment"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

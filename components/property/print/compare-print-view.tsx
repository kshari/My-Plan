'use client'

/**
 * Focused print view for the Deal Workspace compare mode.
 *
 * Renders the same content that's currently on screen — property header,
 * scenario hero strip, and the full ScenarioComparisonTable — using the same
 * screen-variant styling so the printout mirrors the on-screen comparison.
 *
 * Implementation mirrors PropertyPrintView: a portal-mounted overlay with a
 * scoped print stylesheet that hides every other body child so only this
 * comparison view ends up on paper. The wide comparison table forces
 * landscape orientation, matching the year-by-year P&L print pages.
 */

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X, Clock } from 'lucide-react'
import { fmtDollar } from '@/lib/property/compute-metrics'
import {
  ScenarioComparisonTable,
  type ScenarioComparisonItemInput,
} from '@/components/property/shared/scenario-comparison-table'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyHeader {
  address: string | null
  city?: string | null
  county?: string | null
  type?: string | null
}

export interface CompareScenarioItem {
  scenario: Record<string, unknown> & { id: number }
  /** Pre-computed metrics so the hero strip stays identical to the on-screen
   *  version (same numbers, same color coding). */
  metrics: {
    monthlyCF: number
    cocr: number
    capRate: number
    noi: number
  }
  color: string
  label: string
  isBase: boolean
}

export interface ComparePrintViewProps {
  property: PropertyHeader
  items: CompareScenarioItem[]
  onClose: () => void
}

// ─── Small helpers (kept in-sync with the on-screen Stat helper) ──────────────

function Stat({ label, val, pos }: { label: string; val: string; pos?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          pos === true && 'text-emerald-600',
          pos === false && 'text-destructive',
        )}
      >
        {val}
      </span>
    </div>
  )
}

const AUTO_PRINT_DELAY_MS = 3_000

// ─── Component ────────────────────────────────────────────────────────────────

export default function ComparePrintView({ property, items, onClose }: ComparePrintViewProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [countdown, setCountdown] = useState<number | null>(
    Math.ceil(AUTO_PRINT_DELAY_MS / 1000),
  )
  const cancelledRef = useRef(false)

  // Mount a portal node as a direct child of <body> so it sits outside the
  // AppShell's overflow:hidden wrapper. This is the same approach used by
  // PropertyPrintView for the full report.
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'compare-print-portal-root'
    document.body.appendChild(el)
    setPortalTarget(el)
    return () => { el.remove() }
  }, [])

  // Auto-print countdown. Skippable via the Cancel button — useful when the
  // user wants to review the printout layout before sending it to paper.
  useEffect(() => {
    let remaining = AUTO_PRINT_DELAY_MS / 1000
    const interval = setInterval(() => {
      if (cancelledRef.current) { clearInterval(interval); return }
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setCountdown(null)
        window.print()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const cancelCountdown = () => {
    cancelledRef.current = true
    setCountdown(null)
  }

  const propertyName = [property.address, property.city].filter(Boolean).join(', ') || 'Property Comparison'
  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const comparisonItems: ScenarioComparisonItemInput[] = items.map(it => ({
    scenario: it.scenario,
    label: it.label,
    color: it.color,
    isBase: it.isBase,
    id: `sc-${it.scenario.id}`,
  }))

  const content = (
    <>
      <style>{`
        /* ── Screen ─────────────────────────────────────────────────────── */
        @media screen {
          #compare-print-portal-root {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }
          .compare-print-only { display: none; }
        }

        /* ── Print ──────────────────────────────────────────────────────── */
        @media print {
          html, body {
            display: block !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Hide every other top-level node so only this overlay prints. */
          body > *:not(#compare-print-portal-root) {
            display: none !important;
          }

          #compare-print-portal-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            z-index: auto !important;
          }

          .no-print { display: none !important; }
          .compare-print-only { display: block !important; }

          /* Allow content to flow naturally without clipping */
          .compare-print-area,
          .compare-print-area * {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Comparison tables can be wide with 2–3 scenarios; landscape gives
             us the horizontal room without horizontal-scroll clipping. */
          @page { size: letter landscape; margin: 1cm; }

          tr { page-break-inside: avoid; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 pb-12">
        {/* ── Screen-only controls ── */}
        <div className="no-print rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 my-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{propertyName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Comparing {items.length} scenario{items.length !== 1 ? 's' : ''} ·{' '}
              {countdown != null
                ? `Auto-printing in ${countdown}s…`
                : 'Click Print to send to printer'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {countdown != null && (
              <button
                onClick={cancelCountdown}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Clock className="h-3.5 w-3.5" /> Cancel auto-print
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Printer className="h-3.5 w-3.5" /> Print now
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700"
              title="Close print view"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Document header (visible on both screen preview and printed page) ── */}
        <div className="pt-2 pb-3 mb-4 border-b-2 border-gray-800">
          <h2 className="text-xl font-bold text-gray-900">{propertyName}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Scenario Comparison &nbsp;·&nbsp; {generatedAt}
          </p>
        </div>

        {/* ── The printable area — mirrors the on-screen compare layout ── */}
        <div className="compare-print-area space-y-4">
          {/* Scenario hero strip — identical Stat layout to the deal workspace */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {items.map(it => (
              <div
                key={it.scenario.id}
                className="rounded-xl border bg-white px-4 py-2.5 min-w-48 flex-1"
                style={{ borderTopWidth: 3, borderTopColor: it.color, borderTopStyle: 'solid' }}
              >
                <p className="text-xs font-semibold truncate mb-2" style={{ color: it.color }}>
                  {it.label}
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <Stat label="Cash/mo" val={fmtDollar(it.metrics.monthlyCF)} pos={it.metrics.monthlyCF >= 0} />
                  <Stat label="Cash-on-Cash" val={`${it.metrics.cocr.toFixed(1)}%`} pos={it.metrics.cocr >= 0} />
                  <Stat label="Cap Rate" val={`${it.metrics.capRate.toFixed(2)}%`} />
                  <Stat label="Net Op. Income/yr" val={fmtDollar(it.metrics.noi)} pos={it.metrics.noi >= 0} />
                </div>
              </div>
            ))}
          </div>

          {/* The comparison table — uses the screen variant so the printout
              renders the same colors, ★ best-value markers, and groupings
              the user just looked at. */}
          {items.length >= 2 && (
            <ScenarioComparisonTable variant="screen" items={comparisonItems} />
          )}
        </div>
      </div>
    </>
  )

  if (!portalTarget) return null
  return createPortal(content, portalTarget)
}

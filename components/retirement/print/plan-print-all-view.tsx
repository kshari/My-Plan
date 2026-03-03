'use client'

import { useEffect, useState, useRef } from 'react'
import { Printer, Clock, CheckCircle } from 'lucide-react'
import { ScenarioProvider } from '@/components/retirement/scenario-context'
import SnapshotTab from '@/components/retirement/tabs/snapshot-tab'
import DetailsTab from '@/components/retirement/tabs/details-tab'
import ScenarioModelingTab from '@/components/retirement/tabs/scenario-modeling-tab'
import AnalysisTab from '@/components/retirement/tabs/analysis-tab'
import TaxEfficiencyTab from '@/components/retirement/tabs/tax-efficiency-tab'
import PlanDetailsTab from '@/components/retirement/tabs/plan-details-tab'
import OtherIncomeTab from '@/components/retirement/tabs/other-income-tab'
import OtherToolsTab from '@/components/retirement/tabs/other-tools-tab'
import SSAWithdrawalAnalysisTab from '@/components/retirement/tabs/ssa-withdrawal-analysis-tab'

// ─── Page definitions ────────────────────────────────────────────────────────

const PAGE_META: Record<string, { label: string; description: string }> = {
  'quick-analysis':          { label: 'Quick Projections',                   description: 'Confidence score, income estimate, yearly projections' },
  'details':                 { label: 'Projections — Default Columns',       description: 'Year-by-year projections with standard columns' },
  'strategy-modeling':       { label: 'Withdrawal Strategy Modeling',        description: 'Strategy modeler, comparison table, and parameter controls' },
  'scenario-modeling':       { label: 'Scenario Modeling — Net Worth',       description: 'How different growth rates affect ending net worth' },
  'scenario-modeling-income':{ label: 'Monthly Income Scenario Modeling',    description: 'How different growth rates affect monthly retirement income' },
  'monte-carlo':             { label: 'Market Risk & Monte Carlo Analysis',                description: 'Market risk analysis and Monte Carlo simulation results' },
  'roth-conversion':         { label: 'Tax Efficiency & Roth Conversion Savings Details',     description: 'Roth conversion strategy, optimal amounts, and year-by-year table' },
  'ssa-analysis':            { label: 'Social Security Withdrawal Analysis', description: 'Break-even analysis for SSA start age and lifetime benefit comparison' },
  'plan-details':            { label: 'Plan Setup',                          description: 'Accounts, expenses, and calculator assumptions' },
  'other-income':            { label: 'Other Income',                        description: 'Pensions, rental, and other recurring income' },
  'other-tools':             { label: 'Other Tools',                         description: 'Compounding calculator and additional planning tools' },
}

// ─── Section divider ─────────────────────────────────────────────────────────

function SectionDivider({ label, description, index }: { label: string; description: string; index: number }) {
  return (
    <div className={`print-section-header ${index > 0 ? 'page-break-before' : ''}`}>
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-mono text-gray-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{label}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Static print controls bar (not sticky) ──────────────────────────────────

function PrintControls({
  planName,
  pagesToRender,
  generatedAt,
  countdown,
  onPrint,
  onDismissCountdown,
  position,
}: {
  planName: string
  pagesToRender: string[]
  generatedAt: string
  countdown: number | null
  onPrint: () => void
  onDismissCountdown: () => void
  position: 'top' | 'bottom'
}) {
  return (
    <div className="no-print rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 my-4">
      {position === 'top' && (
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">{planName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {pagesToRender.length} page{pagesToRender.length !== 1 ? 's' : ''} selected
            &nbsp;·&nbsp;
            Generated {new Date(generatedAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {countdown !== null && countdown > 0 ? (
            <>
              <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Pages are loading — auto-printing in{' '}
                  <span className="font-bold text-amber-600">{countdown}s</span>
                </p>
                <p className="text-xs text-gray-500">
                  Scroll down to verify all data has loaded before printing.
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-gray-800">
                Ready — verify data looks correct, then print.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {countdown !== null && countdown > 0 && (
            <button
              onClick={onDismissCountdown}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Cancel auto-print
            </button>
          )}
          <button
            onClick={onPrint}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-md border px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {position === 'bottom' && (
        <p className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400 italic">
          This report is for informational and planning purposes only. Projections are estimates based on
          the assumptions entered and do not constitute financial advice. Consult a licensed financial
          advisor before making investment decisions.
        </p>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface PlanPrintAllViewProps {
  planId: number
  planName: string
  selectedPages: string[]
  initialScenarioId: number | null
  generatedAt: string
}

// How long to wait (ms) before auto-printing to let all components load
const AUTO_PRINT_DELAY_MS = 12_000

export default function PlanPrintAllView({
  planId,
  planName,
  selectedPages,
  initialScenarioId,
  generatedAt,
}: PlanPrintAllViewProps) {
  const [countdown, setCountdown] = useState<number | null>(Math.ceil(AUTO_PRINT_DELAY_MS / 1000))
  const cancelledRef = useRef(false)
  const hasPrintedRef = useRef(false)

  const doPrint = () => {
    if (hasPrintedRef.current) return
    hasPrintedRef.current = true
    window.print()
  }

  const cancelAutoprint = () => {
    cancelledRef.current = true
    setCountdown(null)
  }

  useEffect(() => {
    let remaining = AUTO_PRINT_DELAY_MS / 1000
    const interval = setInterval(() => {
      if (cancelledRef.current) {
        clearInterval(interval)
        return
      }
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setCountdown(null)
        doPrint()
      }
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ordered list of pages to render (canonical order matches the app nav)
  const pageOrder: string[] = [
    'quick-analysis',
    'details',
    'strategy-modeling',
    'scenario-modeling',
    'scenario-modeling-income',
    'monte-carlo',
    'roth-conversion',
    'ssa-analysis',
    'plan-details',
    'other-income',
    'other-tools',
  ]
  const pagesToRender = pageOrder.filter(id => selectedPages.includes(id))

  return (
    <>
      {/* Print + screen CSS */}
      <style>{`
        /* ── Screen: full-screen overlay covering sidebar ───────────── */
        @media screen {
          #print-all-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }

          /* On screen the tab wrapper looks like a card */
          .print-tab-content {
            border-radius: 0.75rem;
            border: 1px solid var(--border, #e5e7eb);
            background: var(--card, white);
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            padding: 1.5rem;
          }

          /* Document header and opening disclaimer are print-only — hide on screen */
          .print-header,
          .print-disclaimer:first-of-type { display: none; }
        }

        /* ── Print: hide everything except our overlay ────────────── */
        @media print {
          /* Make <html> the containing block for the absolute overlay */
          html { position: relative !important; }

          /* 1. Blank the entire page */
          body * { visibility: hidden !important; }

          /* 2. Make only our overlay (and all its children) visible */
          #print-all-overlay,
          #print-all-overlay * { visibility: visible !important; }

          /* 3. But keep the screen-only controls hidden */
          .no-print,
          .no-print * { visibility: hidden !important; display: none !important; }

          /* Ensure the document header and disclaimer ARE visible in print */
          .print-header,
          .print-disclaimer {
            visibility: visible !important;
            display: block !important;
          }

          /* 4. Stretch the overlay to fill the full page width,
                bypassing the flex sidebar layout */
          #print-all-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 5. Remove card frames from each tab section */
          .print-tab-content {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }

          /* 6. Let all inner content expand — remove overflow & height clipping */
          .print-tab-content,
          .print-tab-content * {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Hide position:fixed overlays (e.g. TaxEfficiencyTab disclaimer banner).
             Fixed elements repeat on every print page — we don't want that. */
          .fixed { display: none !important; visibility: hidden !important; }

          /* 7. Page breaks between sections */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .print-section-header { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }

          /* Withdrawal strategy comparison table: scale to fit PDF page width */
          .print-strategy-comparison-table {
            width: 100% !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .print-strategy-comparison-table .overflow-x-auto {
            overflow: visible !important;
            max-width: 100% !important;
          }
          .print-strategy-comparison-table table {
            min-width: 0 !important;
            width: 100% !important;
            table-layout: fixed !important;
            font-size: 0.7rem !important;
          }
          .print-strategy-comparison-table th,
          .print-strategy-comparison-table td {
            padding: 0.25rem 0.35rem !important;
            font-size: inherit !important;
          }

          /* SSA Cumulative Benefits chart: force new page so chart is not split */
          .print-ssa-cumulative-chart {
            page-break-before: always;
            padding-top: 1.5rem;
          }

          /* 8. Page margins */
          @page { margin: 1.5cm; }

          /* 9. Print colour accuracy */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div id="print-all-overlay">
        <div className="max-w-5xl mx-auto px-6 pb-12">

          {/* ── Static controls at the TOP (screen only) ── */}
          <PrintControls
            planName={planName}
            pagesToRender={pagesToRender}
            generatedAt={generatedAt}
            countdown={countdown}
            onPrint={doPrint}
            onDismissCountdown={cancelAutoprint}
            position="top"
          />

          {/* ── Print-only document header ── */}
          <div className="print-header pt-6 pb-3 mb-4 border-b-2 border-gray-800">
            <h1 className="text-2xl font-bold text-gray-900">{planName}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Retirement Plan Report &nbsp;·&nbsp;
              {new Date(generatedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {pagesToRender.length} section{pagesToRender.length !== 1 ? 's' : ''}: {pagesToRender.map(id => PAGE_META[id]?.label).filter(Boolean).join(' · ')}
            </p>
          </div>

          {/* ── Print-only opening disclaimer ── */}
          <div className="print-disclaimer mb-6 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-600 italic">
              <strong>Disclaimer:</strong> This report is for informational and planning purposes only.
              Projections are estimates based on the assumptions entered and do not constitute financial advice.
              Past performance does not guarantee future results. Consult a licensed financial advisor before
              making investment decisions.
            </p>
          </div>

          {/* ── All selected pages rendered in order ── */}
          <ScenarioProvider planId={planId}>
            {pagesToRender.map((pageId, index) => {
              const meta = PAGE_META[pageId]
              if (!meta) return null

              return (
                <div key={pageId} className="print-page-section">
                  <SectionDivider
                    label={meta.label}
                    description={meta.description}
                    index={index}
                  />

                  {/* Tab content rendered exactly as in the app */}
                  <div className="mt-4 print-tab-content">
                    {pageId === 'quick-analysis' && (
                      <SnapshotTab
                        planId={planId}
                        onSwitchToAdvanced={() => {/* no-op in print context */}}
                        onSwitchToPlanSetup={() => {/* no-op in print context */}}
                      />
                    )}
                    {/* Projections — default columns, table view */}
                    {pageId === 'details' && (
                      <DetailsTab planId={planId} initialSubTab="projections" initialAllColumns initialViewMode="table" />
                    )}
                    {/* Withdrawal Strategy Modeling sub-tab */}
                    {pageId === 'strategy-modeling' && (
                      <DetailsTab planId={planId} initialSubTab="strategy-modeling" />
                    )}
                    {/* Scenario Modeling — net worth view */}
                    {pageId === 'scenario-modeling' && (
                      <ScenarioModelingTab planId={planId} initialModelType="networth" />
                    )}
                    {/* Scenario Modeling — monthly income view */}
                    {pageId === 'scenario-modeling-income' && (
                      <ScenarioModelingTab planId={planId} initialModelType="monthly_income" />
                    )}
                    {/* Monte Carlo — auto-runs the simulation once analysis is loaded */}
                    {pageId === 'monte-carlo' && <AnalysisTab planId={planId} autoRunMonteCarlo />}
                    {/* Roth Conversion — pre-expands the Total Net Savings details section */}
                    {pageId === 'roth-conversion' && <TaxEfficiencyTab planId={planId} initialShowRothDetails />}
                    {/* SSA Withdrawal Analysis standalone */}
                    {pageId === 'ssa-analysis' && <SSAWithdrawalAnalysisTab planId={planId} />}
                    {pageId === 'plan-details' && <PlanDetailsTab planId={planId} />}
                    {pageId === 'other-income' && <OtherIncomeTab planId={planId} />}
                    {pageId === 'other-tools' && <OtherToolsTab planId={planId} />}
                  </div>
                </div>
              )
            })}
          </ScenarioProvider>

          {/* ── Closing disclaimer (print + screen) ── */}
          <div className="mt-8 pt-4 border-t border-gray-200 print-disclaimer">
            <p className="text-xs text-gray-400 italic">
              <strong>Disclaimer:</strong> This report is for informational and planning purposes only.
              Projections are estimates based on the assumptions entered and do not constitute financial advice.
              Past performance does not guarantee future results. Consult a licensed financial advisor before
              making investment decisions.
            </p>
          </div>

          {/* ── Static controls at the BOTTOM (screen only) ── */}
          <PrintControls
            planName={planName}
            pagesToRender={pagesToRender}
            generatedAt={generatedAt}
            countdown={countdown}
            onPrint={doPrint}
            onDismissCountdown={cancelAutoprint}
            position="bottom"
          />
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  'scenario-modeling':       { label: 'Scenario Modeling — Net Worth',       description: 'Net worth across retirement ages and growth rates (table view)' },
  'scenario-modeling-income':{ label: 'Monthly Income Scenario Modeling',    description: 'Monthly retirement income across retirement ages and growth rates (table view)' },
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
const AUTO_PRINT_DELAY_MS = 20_000

export default function PlanPrintAllView({
  planId,
  planName,
  selectedPages,
  initialScenarioId,
  generatedAt,
}: PlanPrintAllViewProps) {
  const [countdown, setCountdown] = useState<number | null>(Math.ceil(AUTO_PRINT_DELAY_MS / 1000))
  const cancelledRef = useRef(false)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  // Create a dedicated container as a direct child of <body> so the portal
  // lives outside the AppShell's overflow:hidden / h-screen wrappers.
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'print-all-portal-root'
    document.body.appendChild(el)
    setPortalTarget(el)
    return () => { el.remove() }
  }, [])

  // While this component is mounted, add a class to <body> so the print
  // stylesheet can hide the app shell and reset layout constraints.
  useEffect(() => {
    document.body.classList.add('print-all-active')
    return () => document.body.classList.remove('print-all-active')
  }, [])

  const doPrint = () => {
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
        window.print()
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

  const content = (
    <>
      {/* Print + screen CSS */}
      <style>{`
        /* ── Screen ──────────────────────────────────────────────────── */
        @media screen {
          /* Portal root covers the full viewport on screen */
          #print-all-portal-root {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }

          /* Card appearance for each tab */
          .print-tab-content {
            border-radius: 0.75rem;
            border: 1px solid var(--border, #e5e7eb);
            background: var(--card, white);
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            padding: 1.5rem;
          }

          /* Print-only elements hidden on screen */
          .print-header,
          .print-disclaimer:first-of-type { display: none; }
        }

        /* ── Print ──────────────────────────────────────────────────── */
        @media print {
          /* Reset html/body so nothing clips content height */
          html, body {
            display: block !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /* Hide every direct child of body EXCEPT our portal root */
          body > *:not(#print-all-portal-root) {
            display: none !important;
          }

          /* Our portal root takes normal static flow */
          #print-all-portal-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            z-index: auto !important;
          }

          /* Screen-only controls */
          .no-print { display: none !important; }

          /* Print-only header and disclaimer */
          .print-header,
          .print-disclaimer {
            display: block !important;
          }

          /* Remove card frames */
          .print-tab-content {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            max-height: none !important;
          }

          /* Let block-level descendants expand — but leave SVG/canvas alone */
          .print-tab-content div:not(.recharts-wrapper):not(.recharts-responsive-container),
          .print-tab-content section,
          .print-tab-content article,
          .print-tab-content ul,
          .print-tab-content ol,
          .print-tab-content p {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Recharts charts: keep explicit height for the container but allow SVG overflow */
          .print-tab-content .recharts-responsive-container {
            overflow: visible !important;
          }
          .print-tab-content .recharts-wrapper {
            overflow: visible !important;
          }
          /* Force SVG to fill container width in case Recharts measured 0 at mount time */
          .print-tab-content .recharts-wrapper svg {
            overflow: visible !important;
            width: 100% !important;
          }
          /* Preserve Tailwind fixed-height wrappers so ResponsiveContainer gets a parent height */
          .print-tab-content .h-\[300px\] { height: 300px !important; }
          .print-tab-content .h-\[400px\] { height: 400px !important; }
          .print-tab-content .h-\[500px\] { height: 500px !important; }
          .print-tab-content .h-\[600px\] { height: 600px !important; }

          /* Kill ALL position:fixed elements (disclaimers, navs, FABs, banners).
             Fixed elements either repeat on every page or consume a full page. */
          [style*="position: fixed"],
          [style*="position:fixed"],
          .fixed {
            display: none !important;
          }

          /* Page breaks between sections */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .print-section-header { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }

          /* Withdrawal strategy comparison table */
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

          /* SSA Cumulative Benefits chart: start on a new page */
          .print-ssa-cumulative-chart {
            page-break-before: always;
            padding-top: 1.5rem;
          }

          @page { margin: 1.5cm; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

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

                <div className="mt-4 print-tab-content">
                  {pageId === 'quick-analysis' && (
                    <SnapshotTab
                      planId={planId}
                      onSwitchToAdvanced={() => {}}
                      onSwitchToPlanSetup={() => {}}
                    />
                  )}
                  {pageId === 'details' && (
                    <DetailsTab planId={planId} initialSubTab="projections" initialAllColumns initialViewMode="table" />
                  )}
                  {pageId === 'strategy-modeling' && (
                    <DetailsTab planId={planId} initialSubTab="strategy-modeling" />
                  )}
                  {pageId === 'scenario-modeling' && (
                    <ScenarioModelingTab planId={planId} initialModelType="networth" initialViewMode="table" />
                  )}
                  {pageId === 'scenario-modeling-income' && (
                    <ScenarioModelingTab planId={planId} initialModelType="monthly_income" initialViewMode="table" />
                  )}
                  {pageId === 'monte-carlo' && <AnalysisTab planId={planId} autoRunMonteCarlo initialRmdDetailsExpanded />}
                  {pageId === 'roth-conversion' && <TaxEfficiencyTab planId={planId} initialShowRothDetails />}
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
    </>
  )

  if (!portalTarget) return null
  return createPortal(content, portalTarget)
}

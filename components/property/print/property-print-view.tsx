'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Clock, CheckCircle, X } from 'lucide-react'
import {
  computeScenarioMetrics, fmtDollar,
} from '@/lib/property/compute-metrics'
import PLTable from '@/components/property/pl-table'
import AmortizationTable from '@/components/property/amortization-table'
import { SensitivityHeatmap } from '@/components/property/shared/sensitivity-heatmap'
import {
  ScenarioComparisonTable,
  type ScenarioComparisonItemInput,
} from '@/components/property/shared/scenario-comparison-table'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Property {
  id: number
  address: string | null
  city?: string | null
  county?: string | null
  type: string | null
  'Number of Units'?: number | null
  'Has HOA'?: boolean | null
  swimming_pool?: boolean | null
  'Asking Price': number | null
  listing_status?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  sqft?: number | null
  community?: string | null
  plan_name?: string | null
  notes?: string | null
  source?: string | null
  mls_number?: string | null
  created_at: string
}

type ScenarioRow = Record<string, unknown> & { id: number; created_at: string }

export interface PropertyPrintViewProps {
  property: Property
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'property-info',  label: 'Property Information',      desc: 'Address, specs, listing details, defaults, notes' },
  { id: 'scenarios',      label: 'Scenario Details',           desc: 'Assumptions & key metrics for every scenario' },
  { id: 'projections',    label: 'Year-by-Year Projections',   desc: 'Income, expenses, cash flow, equity, IRR — all scenarios' },
  { id: 'amortization',   label: 'Amortization Schedules',     desc: 'Loan payment breakdown (for financed scenarios)' },
  { id: 'sensitivity',    label: 'What-If Sensitivity',        desc: 'Heatmap showing cash flow across variable changes' },
]

const AUTO_PRINT_DELAY_MS = 20_000

// ─── Small helpers ────────────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn('text-xs font-medium text-gray-900 text-right ml-2', highlight && 'text-blue-700 font-semibold')}>{value}</span>
    </div>
  )
}

function SectionDivider({ label, desc, index }: { label: string; desc: string; index: number }) {
  return (
    <div className={`print-section-header ${index > 0 ? 'page-break-before' : ''}`}>
      <div className="flex items-baseline gap-3 pb-3 mb-4 border-b-2 border-gray-800">
        <span className="text-xs font-mono text-gray-400 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">{label}</h2>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Property Information ───────────────────────────────────────────

function PropertyInfoSection({ property }: { property: Property }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">{property.address || 'Unknown Address'}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {property.city && <span className="text-sm text-gray-600">{property.city}</span>}
          {property.county && <span className="text-sm text-gray-600">{property.county} County</span>}
          {property.type && <span className="text-sm text-gray-600">{property.type}</span>}
          {property.community && <span className="text-sm text-gray-600">{property.community}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Property Specs */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Property Specs</h4>
          {property.bedrooms != null && <Row label="Bedrooms" value={String(property.bedrooms)} />}
          {property.bathrooms != null && <Row label="Bathrooms" value={String(property.bathrooms)} />}
          {property.sqft != null && <Row label="Square Feet" value={property.sqft.toLocaleString()} />}
          {property['Number of Units'] != null && <Row label="Units" value={String(property['Number of Units'])} />}
          {property['Has HOA'] != null && <Row label="HOA" value={property['Has HOA'] ? 'Yes' : 'No'} />}
          {property.swimming_pool != null && <Row label="Pool" value={property.swimming_pool ? 'Yes' : 'No'} />}
          {property.listing_status && <Row label="Status" value={property.listing_status} />}
          {property.source && <Row label="Source" value={property.source} />}
          {property.mls_number && <Row label="MLS #" value={property.mls_number} />}
          {property.plan_name && <Row label="Plan/Model" value={property.plan_name} />}
        </div>

        {/* Listing Price */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Listing</h4>
          <Row label="Asking Price" value={property['Asking Price'] != null ? fmtDollar(property['Asking Price']) : '—'} highlight />
          {property.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-gray-700 whitespace-pre-line">{property.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section: Scenario Details (comparative table) ────────────────────────────

function orderedScenarioList(
  baseScenario: Record<string, unknown>,
  scenarios: ScenarioRow[],
): ScenarioComparisonItemInput[] {
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
  // Dedupe: scenarios already contains the base row; drop any base from `scenarios`
  const nonBase = scenarios.filter(s => !s.is_base)
  // Use the real base row if present; otherwise fall back to the passed-in baseScenario
  const realBase = scenarios.find(s => s.is_base)
  const base = realBase ?? baseScenario
  const baseId = realBase ? `sc-${(realBase as ScenarioRow).id}` : 'base'
  return [
    { scenario: base, label: 'Base', color: '#6b7280', isBase: true, id: baseId },
    ...nonBase.map((s, i) => ({
      scenario: s,
      label: String(s['Scenario Name'] || `Scenario #${s.id}`),
      color: COLORS[i % COLORS.length],
      isBase: false,
      id: `sc-${s.id}`,
    })),
  ]
}

function ScenariosSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  return (
    <ScenarioComparisonTable
      variant="print"
      items={orderedScenarioList(baseScenario, scenarios)}
    />
  )
}

// ─── Section: Projections ─────────────────────────────────────────────────────

function ProjectionsSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  const allScenarios = orderedScenarioList(baseScenario, scenarios)

  return (
    <div className="space-y-8">
      {allScenarios.map(({ scenario, label }, idx) => (
        // `print-pl-landscape` on the OUTER wrapper ensures the scenario
        // heading and the PL table share the same landscape page instead
        // of the heading being orphaned on a portrait page before the
        // orientation-switching table.
        <div
          key={idx}
          className={`print-pl-landscape ${idx > 0 ? 'page-break-before' : ''}`}
        >
          <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
            {label}
          </h4>
          <div className="print-pl-table">
            <PLTable scenario={scenario} years={30} variant="print" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section: Amortization ────────────────────────────────────────────────────

function AmortizationSection({
  baseScenario,
  scenarios,
}: {
  baseScenario: Record<string, unknown>
  scenarios: ScenarioRow[]
}) {
  const allScenarios = orderedScenarioList(baseScenario, scenarios)

  const financed = allScenarios.filter(({ scenario }) => {
    const m = computeScenarioMetrics(scenario)
    return m.hasLoan && m.principal > 0 && m.rate > 0 && m.term > 0
  })

  if (financed.length === 0) {
    return <p className="text-sm text-gray-500 italic">No financed scenarios found.</p>
  }

  return (
    <div className="space-y-8">
      {financed.map(({ scenario, label }, idx) => {
        const m = computeScenarioMetrics(scenario)
        return (
          <div key={idx} className={idx > 0 ? 'page-break-before' : ''}>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">
              {label}
            </h4>
            <AmortizationTable
              loanTerm={m.term}
              principal={m.principal}
              interestRate={m.rate}
              monthlyPayment={m.monthlyMortgage}
              variant="print"
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Section: Sensitivity Heatmap ─────────────────────────────────────────────

function SensitivitySection({ scenario }: { scenario: Record<string, unknown> }) {
  return (
    <SensitivityHeatmap
      scenario={scenario}
      variant="print"
      note={
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Sensitivity analysis is run against the <strong>Base scenario</strong> only.
            It stresses the listing-level assumptions to show how cash flow responds to changes, and is not tied to
            any specific scenario above.
          </p>
        </div>
      }
    />
  )
}

// ─── Print Controls ───────────────────────────────────────────────────────────

function PrintControls({
  propertyName,
  selectedSections,
  onToggleSection,
  countdown,
  onPrint,
  onCancelCountdown,
  onClose,
  position,
}: {
  propertyName: string
  selectedSections: Set<string>
  onToggleSection: (id: string) => void
  countdown: number | null
  onPrint: () => void
  onCancelCountdown: () => void
  onClose: () => void
  position: 'top' | 'bottom'
}) {
  return (
    <div className="no-print rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 my-4">
      {position === 'top' && (
        <div className="mb-4 pb-3 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{propertyName}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors mt-0.5"
            title="Close print view"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-6 items-start justify-between">
        {/* Section checkboxes */}
        {position === 'top' && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SECTIONS.map(sec => (
              <label key={sec.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSections.has(sec.id)}
                  onChange={() => onToggleSection(sec.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700">{sec.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          {countdown !== null && countdown > 0 ? (
            <>
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm font-medium text-gray-800">
                Auto-printing in <span className="font-bold text-amber-600">{countdown}s</span>
              </p>
              <button
                onClick={onCancelCountdown}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-gray-800">Ready to print</p>
            </>
          )}
          <button
            onClick={onPrint}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
          {position === 'top' && (
            <button
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {position === 'bottom' && (
        <p className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400 italic">
          This report is for informational purposes only. Projections are estimates based on the assumptions
          entered and do not constitute financial advice. Consult a licensed professional before making
          investment decisions.
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PropertyPrintView({
  property,
  baseScenario,
  scenarios,
  onClose,
}: PropertyPrintViewProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(
    new Set(SECTIONS.map(s => s.id))
  )
  const [countdown, setCountdown] = useState<number | null>(Math.ceil(AUTO_PRINT_DELAY_MS / 1000))
  const cancelledRef = useRef(false)

  // Build the portal root (direct child of <body>) so it lives outside the
  // AppShell's overflow:hidden / h-screen wrappers
  useEffect(() => {
    const el = document.createElement('div')
    el.id = 'property-print-portal-root'
    document.body.appendChild(el)
    setPortalTarget(el)
    return () => { el.remove() }
  }, [])

  // Add body class so the print stylesheet can hide everything else
  useEffect(() => {
    document.body.classList.add('property-print-active')
    return () => document.body.classList.remove('property-print-active')
  }, [])

  // Countdown then auto-print
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

  const toggleSection = (id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cancelCountdown = () => {
    cancelledRef.current = true
    setCountdown(null)
  }

  // Ordered section list to render
  const sectionsToRender = SECTIONS.filter(s => selectedSections.has(s.id))

  // Sensitivity always uses the Base scenario (it's a listing-level analysis, not scenario-specific)
  const realBase = scenarios.find(s => s.is_base)
  const sensitivityScenario = realBase ?? baseScenario

  const propertyName = [property.address, property.city].filter(Boolean).join(', ') || 'Property Report'
  const generatedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const content = (
    <>
      {/* ── Inline styles: screen overlay + print CSS ── */}
      <style>{`
        /* ── Screen ─────────────────────────────────────────────────────── */
        @media screen {
          #property-print-portal-root {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: white;
            overflow-y: auto;
          }
          .print-section-content {
            border-radius: 0.75rem;
            border: 1px solid #e5e7eb;
            background: white;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            padding: 1.5rem;
          }
          .print-only-header { display: none; }
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

          body > *:not(#property-print-portal-root) {
            display: none !important;
          }

          #property-print-portal-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            z-index: auto !important;
          }

          .no-print { display: none !important; }
          .print-only-header { display: block !important; }

          .print-section-content {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            overflow: visible !important;
            max-height: none !important;
          }

          /* Allow content to expand */
          .print-section-content div,
          .print-section-content section,
          .print-section-content table {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Kill fixed elements */
          [style*="position: fixed"],
          [style*="position:fixed"],
          .fixed { display: none !important; }

          /* Page breaks */
          .page-break-before {
            page-break-before: always;
            break-before: page;
          }
          .print-section-header { page-break-inside: avoid; }
          tr { page-break-inside: avoid; }

          /* Projection tables */
          .print-pl-table table {
            font-size: 0.65rem !important;
            width: 100% !important;
          }
          .print-pl-table th,
          .print-pl-table td {
            padding: 0.15rem 0.25rem !important;
          }
          .print-pl-table .overflow-x-auto {
            overflow: visible !important;
          }

          /* The PL table has many columns and full-precision dollars;
             force landscape orientation so the full table fits without
             horizontal clipping (IRR / Loan Left columns were getting cut). */
          .print-pl-landscape { page: pl; }
          @page pl { size: letter landscape; margin: 1.2cm; }

          /* Amortization schedule: ensure all 360 rows print and break naturally */
          .print-amort-table { page-break-inside: auto; }
          .print-amort-table table { width: 100% !important; }
          .print-amort-table thead { display: table-header-group; }
          .print-amort-table tr { page-break-inside: avoid; }

          @page { margin: 1.5cm; }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto px-6 pb-12">
        {/* ── Top controls (screen only) ── */}
        <PrintControls
          propertyName={propertyName}
          selectedSections={selectedSections}
          onToggleSection={toggleSection}
          countdown={countdown}
          onPrint={() => window.print()}
          onCancelCountdown={cancelCountdown}
          onClose={onClose}
          position="top"
        />

        {/* ── Print-only document header ── */}
        <div className="print-only-header pt-6 pb-3 mb-4 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold text-gray-900">{propertyName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Property Investment Analysis &nbsp;·&nbsp; {generatedAt}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {sectionsToRender.length} section{sectionsToRender.length !== 1 ? 's' : ''}:&nbsp;
            {sectionsToRender.map(s => s.label).join(' · ')}
          </p>
        </div>

        {/* ── Sections ── */}
        {sectionsToRender.map((sec, idx) => (
          <div key={sec.id}>
            <SectionDivider label={sec.label} desc={sec.desc} index={idx} />
            <div className="print-section-content mb-6">
              {sec.id === 'property-info' && (
                <PropertyInfoSection property={property} />
              )}
              {sec.id === 'scenarios' && (
                <ScenariosSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'projections' && (
                <ProjectionsSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'amortization' && (
                <AmortizationSection baseScenario={baseScenario} scenarios={scenarios} />
              )}
              {sec.id === 'sensitivity' && (
                <SensitivitySection scenario={sensitivityScenario} />
              )}
            </div>
          </div>
        ))}

        {/* ── Bottom controls (screen only) ── */}
        <PrintControls
          propertyName={propertyName}
          selectedSections={selectedSections}
          onToggleSection={toggleSection}
          countdown={countdown}
          onPrint={() => window.print()}
          onCancelCountdown={cancelCountdown}
          onClose={onClose}
          position="bottom"
        />
      </div>
    </>
  )

  if (!portalTarget) return null
  return createPortal(content, portalTarget)
}

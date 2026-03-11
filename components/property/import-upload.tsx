'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertCircle, Loader2, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { parseCSV } from '@/lib/property/csv-parser'
import type { ParseResult, ParsedRow } from '@/lib/property/csv-parser'
import {
  autoDetectMappings,
  mapRowToProperty,
  PROPERTY_FIELDS,
  REQUIRED_IMPORT_FIELDS,
  type ColumnMapping,
  type PropertyField,
} from '@/lib/property/column-mapper'
import { PROPERTY_STATUSES } from '@/lib/constants/property-defaults'

interface ExistingLoad {
  id: string
  name: string
  created_at: string
}

interface ImportUploadProps {
  existingLoads: ExistingLoad[]
}

type Step = 'upload' | 'mapping' | 'preview' | 'fill_required' | 'importing' | 'done'

export function ImportUpload({ existingLoads }: ImportUploadProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [loadMode, setLoadMode] = useState<'new' | 'append'>('new')
  const [loadName, setLoadName] = useState('')
  const [appendLoadId, setAppendLoadId] = useState<string>('')
  /** Property status for all imported rows (required, no default). */
  const [importStatus, setImportStatus] = useState<string>('')
  const [importResult, setImportResult] = useState<{
    created: number
    updated: number
    skipped: number
    rowResults: Array<{ rowIndex: number; status: 'created' | 'updated' | 'skipped'; reason?: string; address?: string }>
  } | null>(null)
  const [importing, setImporting] = useState(false)
  /** When step is fill_required: which required fields have missing rows (row index 0-based) */
  const [requiredGaps, setRequiredGaps] = useState<Array<{ dbColumn: string; label: string; rowIndices: number[] }>>([])
  /** Default value to use for all empty rows per required field */
  const [defaultValues, setDefaultValues] = useState<Record<string, string>>({})
  /** Per-row override: field -> rowIndex -> value */
  const [perRowValues, setPerRowValues] = useState<Record<string, Record<number, string>>>({})
  /** Snapshot of mapped rows when we transition to fill_required (so we can merge and import) */
  const [mappedRowsSnapshot, setMappedRowsSnapshot] = useState<Record<string, unknown>[] | null>(null)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setParseError(null)

    const ext = f.name.split('.').pop()?.toLowerCase()
    try {
      let result: ParseResult

      if (ext === 'csv') {
        result = await parseCSV(f)
      } else if (ext === 'pdf') {
        const { parsePDF } = await import('@/lib/property/pdf-parser')
        result = await parsePDF(f)
      } else {
        setParseError('Unsupported file type. Please upload a CSV or PDF file.')
        return
      }

      setParseResult(result)
      const detected = autoDetectMappings(result.columns)
      setMappings(detected)
      setLoadName(f.name.replace(/\.(csv|pdf)$/i, ''))
      setStep('mapping')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }, [handleFile])

  const updateMapping = (csvColumn: string, field: PropertyField) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, field } : m))
    )
  }

  const hasAddressMapping = mappings.some((m) => m.field === 'address')

  const previewRows = parseResult?.rows.slice(0, 10) ?? []
  const activeMappings = mappings.filter((m) => m.field !== 'ignore')

  const doImport = async (rowsToSend: Record<string, unknown>[]) => {
    setImporting(true)
    setStep('importing')
    try {
      const res = await fetch('/api/property/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadName: loadMode === 'new' ? loadName : undefined,
          fileName: file?.name,
          fileType: file?.name.split('.').pop()?.toLowerCase(),
          appendToLoadId: loadMode === 'append' ? appendLoadId : undefined,
          rows: rowsToSend,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Import failed')
      }
      const result = await res.json()
      setImportResult({
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        rowResults: result.rowResults ?? [],
      })
      setStep('done')
      toast.success(`Imported ${result.created + result.updated} properties`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
      setStep('preview')
    } finally {
      setImporting(false)
    }
  }

  const startImport = () => {
    if (!parseResult) return
    if (!importStatus || !PROPERTY_STATUSES.includes(importStatus as any)) {
      toast.error('Please select a property status (Available, Sold, or Leased) for the import.')
      return
    }
    const mappedRows = parseResult.rows.map((row) => {
      const mapped = mapRowToProperty(row, mappings)
      const additional: Record<string, string> = {}
      for (const m of mappings) {
        if (m.field === 'ignore') {
          const v = row[m.csvColumn]
          if (v != null && String(v).trim() !== '') additional[m.csvColumn] = String(v).trim()
        }
      }
      if (Object.keys(additional).length > 0) {
        mapped.additional_info = JSON.stringify(additional, null, 2)
      }
      return mapped
    })
    mappedRows.forEach((row) => { row.listing_status = importStatus })
    const gaps: Array<{ dbColumn: string; label: string; rowIndices: number[] }> = []
    for (const { dbColumn, label } of REQUIRED_IMPORT_FIELDS) {
      const rowIndices: number[] = []
      mappedRows.forEach((row, i) => {
        const v = row[dbColumn]
        if (v === undefined || v === null || String(v).trim() === '') rowIndices.push(i)
      })
      if (rowIndices.length > 0) gaps.push({ dbColumn, label, rowIndices })
    }
    if (gaps.length > 0) {
      setRequiredGaps(gaps)
      setDefaultValues({})
      setPerRowValues({})
      setMappedRowsSnapshot(mappedRows)
      setStep('fill_required')
    } else {
      doImport(mappedRows)
    }
  }

  const submitFillRequired = () => {
    if (!mappedRowsSnapshot) return
    const merged = mappedRowsSnapshot.map((row, rowIndex) => ({ ...row }))
    let hasEmpty = false
    for (const { dbColumn, rowIndices } of requiredGaps) {
      const defaultVal = defaultValues[dbColumn]?.trim()
      for (const i of rowIndices) {
        const perRow = perRowValues[dbColumn]?.[i]?.trim()
        const value = perRow ?? defaultVal
        if (value) merged[i][dbColumn] = value
        else hasEmpty = true
      }
    }
    if (hasEmpty) {
      toast.error('Please provide a value for all required fields (use "for all" or fill each row).')
      return
    }
    setMappedRowsSnapshot(null)
    setRequiredGaps([])
    doImport(merged)
  }

  const setDefaultForField = (dbColumn: string, value: string) => {
    setDefaultValues((prev) => ({ ...prev, [dbColumn]: value }))
  }
  const setPerRowForField = (dbColumn: string, rowIndex: number, value: string) => {
    setPerRowValues((prev) => ({
      ...prev,
      [dbColumn]: { ...(prev[dbColumn] ?? {}), [rowIndex]: value },
    }))
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          )}
        >
          <Upload className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Drop a file here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">CSV or PDF files supported</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </div>
      )}

      {parseError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Parse Error</p>
            <p className="text-sm text-muted-foreground mt-0.5">{parseError}</p>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && parseResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Map Columns</h2>
              <p className="text-sm text-muted-foreground">
                {parseResult.totalRows} rows found in{' '}
                <span className="font-medium">{file?.name}</span>.
                Map each column to a property field.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStep('upload'); setFile(null); setParseResult(null) }}>
              <X className="h-4 w-4 mr-1" /> Change File
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="divide-y">
              {mappings.map((m) => (
                <div key={m.csvColumn} className="flex items-center gap-4 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.csvColumn}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      e.g. &quot;{parseResult.rows[0]?.[m.csvColumn] ?? ''}&quot;
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">→</span>
                  <select
                    value={m.field}
                    onChange={(e) => updateMapping(m.csvColumn, e.target.value as PropertyField)}
                    className={cn(
                      'w-48 rounded-md border border-input bg-background px-3 py-1.5 text-sm',
                      m.field === 'ignore' && 'text-muted-foreground'
                    )}
                  >
                    <option value="ignore">— Skip —</option>
                    {PROPERTY_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {!hasAddressMapping && (
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Address mapping is required. Rows without an address will be skipped.
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={() => setStep('preview')} disabled={!hasAddressMapping}>
              Preview Import
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Preview & Confirm</h2>
            <p className="text-sm text-muted-foreground">
              Showing first {previewRows.length} of {parseResult.totalRows} rows.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {activeMappings.map((m) => {
                    const fieldDef = PROPERTY_FIELDS.find((f) => f.key === m.field)
                    return (
                      <th key={m.csvColumn} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                        {fieldDef?.label ?? m.field}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewRows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {activeMappings.map((m) => (
                      <td key={m.csvColumn} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                        {row[m.csvColumn] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Property status (required for all rows) */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <h3 className="text-sm font-semibold">Property status</h3>
            <p className="text-sm text-muted-foreground">Select the status for all properties in this import (required).</p>
            <select
              value={importStatus}
              onChange={(e) => setImportStatus(e.target.value)}
              className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select status</option>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Load options */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold">Import Options</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="loadMode"
                  checked={loadMode === 'new'}
                  onChange={() => setLoadMode('new')}
                  className="accent-primary"
                />
                Create new load
              </label>
              {existingLoads.length > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="loadMode"
                    checked={loadMode === 'append'}
                    onChange={() => setLoadMode('append')}
                    className="accent-primary"
                  />
                  Append to existing load
                </label>
              )}
            </div>

            {loadMode === 'new' && (
              <div>
                <label className="block text-sm font-medium mb-1">Load Name</label>
                <input
                  type="text"
                  value={loadName}
                  onChange={(e) => setLoadName(e.target.value)}
                  placeholder="e.g. Realtor leads March 2026"
                  className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            )}

            {loadMode === 'append' && (
              <div>
                <label className="block text-sm font-medium mb-1">Select Load</label>
                <select
                  value={appendLoadId}
                  onChange={(e) => setAppendLoadId(e.target.value)}
                  className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Choose a load...</option>
                  {existingLoads.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.name} ({new Date(load.created_at).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep('mapping')}>
              ← Back to Mapping
            </Button>
            <Button
              onClick={startImport}
              disabled={
                importing ||
                !importStatus ||
                (loadMode === 'new' && !loadName.trim()) ||
                (loadMode === 'append' && !appendLoadId)
              }
            >
              Import {parseResult.totalRows} Properties
            </Button>
          </div>
        </div>
      )}

      {/* Step 3b: Fill required values (when required DB fields are missing in some rows) */}
      {step === 'fill_required' && mappedRowsSnapshot && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Required fields missing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Some rows are missing values for fields that cannot be empty in the database.
              Provide a value for all rows at once, or set a value for each row.
            </p>
          </div>

          {requiredGaps.map(({ dbColumn, label, rowIndices }) => (
            <div key={dbColumn} className="rounded-lg border bg-card p-4 space-y-4">
              <h3 className="text-sm font-semibold">
                {label} — {rowIndices.length} row{rowIndices.length !== 1 ? 's' : ''} with no value
              </h3>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Use this value for all empty rows
                </label>
                <input
                  type="text"
                  value={defaultValues[dbColumn] ?? ''}
                  onChange={(e) => setDefaultForField(dbColumn, e.target.value)}
                  placeholder={`e.g. value for ${label}`}
                  className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-2">
                  Or set per row
                </label>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-1.5 font-medium w-16">Row</th>
                        <th className="px-3 py-1.5 font-medium">Preview</th>
                        <th className="px-3 py-1.5 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rowIndices.map((idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-1.5 tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">
                            {String((mappedRowsSnapshot[idx] as Record<string, unknown>)?.address ?? (mappedRowsSnapshot[idx] as Record<string, unknown>)?.mls_number ?? `Row ${idx + 1}`)}
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={perRowValues[dbColumn]?.[idx] ?? ''}
                              onChange={(e) => setPerRowForField(dbColumn, idx, e.target.value)}
                              placeholder={defaultValues[dbColumn] ? `Default: ${defaultValues[dbColumn]}` : 'Enter value'}
                              className="w-full min-w-[120px] rounded border border-input bg-background px-2 py-1 text-sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => { setStep('preview'); setMappedRowsSnapshot(null); setRequiredGaps([]) }}>
              ← Back to Preview
            </Button>
            <Button onClick={submitFillRequired} disabled={importing}>
              Import {mappedRowsSnapshot.length} Properties
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="font-medium">Importing properties...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment for large files.</p>
        </div>
      )}

      {/* Step 5: Done — Import Results View */}
      {step === 'done' && importResult && (
        <div className="space-y-6">
          <div className="flex flex-col items-center py-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Import Complete</h2>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground mb-6">
              <span><strong className="text-foreground">{importResult.created}</strong> created</span>
              <span><strong className="text-foreground">{importResult.updated}</strong> updated</span>
              {importResult.skipped > 0 && (
                <span><strong className="text-foreground">{importResult.skipped}</strong> skipped</span>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push('/apps/property/imports')}>
                View Imports
              </Button>
              <Button onClick={() => router.push('/apps/property/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>

          {/* Row-by-row results */}
          {importResult.rowResults.length > 0 && (
            <div className="rounded-lg border bg-card">
              <h3 className="px-4 py-3 text-sm font-semibold border-b">Import results by row</h3>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-4 py-2 font-medium w-16">Row</th>
                      <th className="px-4 py-2 font-medium">Address</th>
                      <th className="px-4 py-2 font-medium w-28">Status</th>
                      <th className="px-4 py-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importResult.rowResults.map((r) => (
                      <tr key={r.rowIndex} className={r.status === 'skipped' ? 'bg-destructive/5' : ''}>
                        <td className="px-4 py-2 tabular-nums">{r.rowIndex}</td>
                        <td className="px-4 py-2 font-medium truncate max-w-[240px]" title={r.address}>
                          {r.address || '—'}
                        </td>
                        <td className="px-4 py-2">
                          {r.status === 'created' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle className="h-3.5 w-3.5" /> Created
                            </span>
                          )}
                          {r.status === 'updated' && (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <RefreshCw className="h-3.5 w-3.5" /> Updated
                            </span>
                          )}
                          {r.status === 'skipped' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Skipped
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {r.reason ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importResult.skipped > 0 && (
                <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                  Skipped rows are usually due to missing address, or a database error. Fix the data and re-import to add them.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

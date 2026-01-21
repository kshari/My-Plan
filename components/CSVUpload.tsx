'use client'

import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { createClient } from '@/lib/supabase/client'
import { getTickerInfo } from '@/lib/utils/market-data'

interface CSVUploadProps {
  portfolioId: string
  onUploadSuccess: () => void
}

interface CSVRow {
  [key: string]: string | undefined
}

// Database field definitions
type DatabaseField = 
  | 'symbol'
  | 'quantity'
  | 'cost_basis'
  | 'purchase_date'
  | 'position_type'
  | 'strike_price'
  | 'expiration_date'
  | 'option_type'
  | 'premium'
  | 'contracts'
  | 'ignore' // For columns to skip

interface FieldMapping {
  csvColumn: string
  databaseField: DatabaseField
}

// Common CSV column name variations mapped to database fields
const DEFAULT_MAPPINGS: Record<string, DatabaseField> = {
  // Symbol variations
  'symbol': 'symbol',
  'ticker': 'symbol',
  'ticker symbol': 'symbol',
  'stock': 'symbol',
  'stock symbol': 'symbol',
  'sym': 'symbol',
  
  // Quantity variations
  'quantity': 'quantity',
  'qty': 'quantity',
  'shares': 'quantity',
  'amount': 'quantity',
  'units': 'quantity',
  
  // Cost basis variations
  'cost_basis': 'cost_basis',
  'cost basis': 'cost_basis',
  'cost': 'cost_basis',
  'total cost': 'cost_basis',
  'basis': 'cost_basis',
  'purchase cost': 'cost_basis',
  'investment': 'cost_basis',
  
  // Purchase date variations
  'purchase_date': 'purchase_date',
  'purchase date': 'purchase_date',
  'date': 'purchase_date',
  'buy date': 'purchase_date',
  'acquired date': 'purchase_date',
  
  // Position type variations
  'position_type': 'position_type',
  'position type': 'position_type',
  'type': 'position_type',
  'instrument type': 'position_type',
  
  // Option fields
  'strike_price': 'strike_price',
  'strike price': 'strike_price',
  'strike': 'strike_price',
  
  'expiration_date': 'expiration_date',
  'expiration date': 'expiration_date',
  'expiry': 'expiration_date',
  'expiry date': 'expiration_date',
  'expiration': 'expiration_date',
  
  'option_type': 'option_type',
  'option type': 'option_type',
  'call put': 'option_type',
  
  'premium': 'premium',
  'option premium': 'premium',
  
  'contracts': 'contracts',
  'number of contracts': 'contracts',
  'contract count': 'contracts',
}

// Field metadata for UI
const FIELD_METADATA: Record<DatabaseField, { label: string; required: boolean; description: string }> = {
  symbol: { label: 'Symbol/Ticker', required: true, description: 'Stock or option symbol' },
  quantity: { label: 'Quantity', required: true, description: 'Number of shares or contracts' },
  cost_basis: { label: 'Cost Basis', required: true, description: 'Total cost of the position' },
  purchase_date: { label: 'Purchase Date', required: false, description: 'Date when position was purchased (defaults to today if not provided)' },
  position_type: { label: 'Position Type', required: false, description: 'stock or option (defaults to stock)' },
  strike_price: { label: 'Strike Price', required: false, description: 'Option strike price' },
  expiration_date: { label: 'Expiration Date', required: false, description: 'Option expiration date' },
  option_type: { label: 'Option Type', required: false, description: 'call or put' },
  premium: { label: 'Premium', required: false, description: 'Option premium paid' },
  contracts: { label: 'Contracts', required: false, description: 'Number of option contracts' },
  ignore: { label: 'Ignore', required: false, description: 'Skip this column' },
}

export default function CSVUpload({ portfolioId, onUploadSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<CSVRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [showMapping, setShowMapping] = useState(false)
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      // Don't close if clicking on a button (which toggles the dropdown)
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return
      }
      // Close if clicking outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setEditingColumn(null)
      }
    }

    if (editingColumn) {
      // Use setTimeout to avoid closing immediately when button is clicked
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingColumn])

  // Auto-detect field mappings based on CSV column names
  const autoDetectMappings = (columns: string[]): FieldMapping[] => {
    return columns.map(csvColumn => {
      const normalized = csvColumn.toLowerCase().trim()
      const databaseField = DEFAULT_MAPPINGS[normalized] || 'ignore'
      return { csvColumn, databaseField }
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          alert('CSV file is empty or has no valid rows')
          return
        }

        const columns = Object.keys(results.data[0] as CSVRow)
        setCsvColumns(columns)
        setPreview(results.data as CSVRow[])
        
        // Auto-detect mappings
        const mappings = autoDetectMappings(columns)
        setFieldMappings(mappings)
        setShowMapping(true)
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`)
      }
    })
  }

  const updateFieldMapping = (csvColumn: string, databaseField: DatabaseField) => {
    setFieldMappings(prev =>
      prev.map(mapping =>
        mapping.csvColumn === csvColumn ? { ...mapping, databaseField } : mapping
      )
    )
  }

  // Get mapped value from CSV row using field mappings
  const getMappedValue = (row: CSVRow, databaseField: DatabaseField): string | undefined => {
    const mapping = fieldMappings.find(m => m.databaseField === databaseField && m.databaseField !== 'ignore')
    if (!mapping) return undefined
    return row[mapping.csvColumn]
  }

  // Clean and parse numeric value from CSV (handles currency symbols, commas, etc.)
  const parseNumericValue = (value: string | undefined): number => {
    if (!value) return 0
    // Remove currency symbols, commas, whitespace, and other non-numeric characters except decimal point and minus sign
    const cleaned = String(value).replace(/[^\d.-]/g, '').trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  // Validate required field mappings
  const validateMappings = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    const requiredFields: DatabaseField[] = ['symbol', 'quantity', 'cost_basis']
    
    for (const field of requiredFields) {
      const mapping = fieldMappings.find(m => m.databaseField === field)
      if (!mapping || mapping.databaseField === 'ignore') {
        errors.push(`Required field "${FIELD_METADATA[field].label}" is not mapped`)
      }
    }
    
    return { valid: errors.length === 0, errors }
  }

  const handleUpload = async () => {
    if (!file || preview.length === 0) {
      alert('Please select a valid CSV file')
      return
    }

    // Validate mappings
    const validation = validateMappings()
    if (!validation.valid) {
      alert(`Please fix mapping errors:\n${validation.errors.join('\n')}`)
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Process each row
      let successCount = 0
      const errors: string[] = []

      for (let i = 0; i < preview.length; i++) {
        const row = preview[i]
        try {
          // Get mapped values using field mappings
          const symbolValue = getMappedValue(row, 'symbol') || ''
          const symbol = symbolValue.toUpperCase().trim()
          
          if (!symbol) {
            errors.push(`Row ${i + 1}: Missing symbol/ticker`)
            continue
          }

          // Validate required fields using mappings
          const quantityValue = getMappedValue(row, 'quantity')
          const costBasisValue = getMappedValue(row, 'cost_basis')
          const quantity = parseNumericValue(quantityValue)
          const costBasis = parseNumericValue(costBasisValue)
          
          if (quantity <= 0) {
            errors.push(`Row ${i + 1}: Invalid quantity (got: "${quantityValue}")`)
            continue
          }
          
          if (costBasis <= 0) {
            errors.push(`Row ${i + 1}: Invalid cost basis (got: "${costBasisValue}")`)
            continue
          }

          // Get or create ticker
          let tickerData: any
          const { data: existingTicker, error: tickerLookupError } = await supabase
            .from('pa_tickers')
            .select('*')
            .eq('symbol', symbol)
            .maybeSingle()

          if (tickerLookupError) {
            throw new Error(`Row ${i + 1}: Error looking up ticker: ${tickerLookupError.message}`)
          }

          if (existingTicker) {
            tickerData = existingTicker
          } else {
            // Fetch ticker info from market data API
            const tickerInfo = await getTickerInfo(symbol)
            const tickerName = tickerInfo?.name || symbol
            
            // Ticker doesn't exist, create it
            const { data: newTicker, error: tickerError } = await supabase
              .from('pa_tickers')
              .insert({
                symbol,
                name: tickerName,
              })
              .select()
              .single()

            if (tickerError) {
              // Check if it's a unique constraint violation (ticker was created between check and insert)
              if (tickerError.code === '23505') {
                // Try fetching again
                const { data: retryTicker, error: retryError } = await supabase
                  .from('pa_tickers')
                  .select('*')
                  .eq('symbol', symbol)
                  .maybeSingle()
                
                if (retryError) {
                  throw new Error(`Row ${i + 1}: Error fetching ticker after conflict: ${retryError.message}`)
                }
                
                if (!retryTicker) {
                  throw new Error(`Row ${i + 1}: Ticker not found after conflict resolution`)
                }
                
                tickerData = retryTicker
              } else {
                throw new Error(`Row ${i + 1}: Error creating ticker: ${tickerError.message}`)
              }
            } else {
              tickerData = newTicker
            }
          }

          if (!tickerData || !tickerData.id) {
            throw new Error(`Row ${i + 1}: Failed to get ticker data`)
          }

          // Get optional mapped values
          const positionTypeValue = getMappedValue(row, 'position_type') || 'stock'
          const positionType = positionTypeValue.toLowerCase() as 'stock' | 'option'
          const purchaseDateValue = getMappedValue(row, 'purchase_date') || new Date().toISOString().split('T')[0]
          const purchaseDate = purchaseDateValue

          // Create position
          const { data: position, error: positionError } = await supabase
            .from('pa_positions')
            .insert({
              portfolio_id: portfolioId,
              ticker_id: tickerData.id,
              quantity,
              cost_basis: costBasis,
              purchase_date: purchaseDate,
              position_type: positionType,
            })
            .select()
            .single()

          if (positionError) {
            throw new Error(`Row ${i + 1}: Error creating position: ${positionError.message}`)
          }

          if (!position || !position.id) {
            throw new Error(`Row ${i + 1}: Failed to create position`)
          }

          // If option, create options position
          if (positionType === 'option') {
            const strikePriceValue = getMappedValue(row, 'strike_price')
            const expirationDateValue = getMappedValue(row, 'expiration_date')
            
            if (strikePriceValue && expirationDateValue) {
              const optionTypeValue = getMappedValue(row, 'option_type') || 'call'
              const premiumValue = getMappedValue(row, 'premium')
              const contractsValue = getMappedValue(row, 'contracts')

              const { error: optionError } = await supabase
                .from('pa_options_positions')
                .insert({
                  position_id: position.id,
                  strike_price: parseNumericValue(strikePriceValue),
                  expiration_date: expirationDateValue,
                  option_type: optionTypeValue.toLowerCase() as 'call' | 'put',
                  premium: parseNumericValue(premiumValue),
                  contracts: Math.max(1, Math.round(parseNumericValue(contractsValue) || 1)),
                })

              if (optionError) {
                throw new Error(`Row ${i + 1}: Error creating option position: ${optionError.message}`)
              }
            }
          }

          successCount++
        } catch (error: any) {
          errors.push(error.message || `Row ${i + 1}: Unknown error`)
          console.error(`Error processing row ${i + 1}:`, error)
        }
      }

      // Show results
      if (errors.length > 0) {
        const message = `Imported ${successCount} of ${preview.length} positions.\n\nErrors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`
        alert(message)
      } else {
        alert(`Successfully imported ${successCount} positions!`)
      }
      
      if (successCount > 0) {
        setFile(null)
        setPreview([])
        setCsvColumns([])
        setFieldMappings([])
        setShowMapping(false)
        onUploadSuccess()
      }
    } catch (error: any) {
      console.error('CSV upload error:', error)
      alert(`Error uploading CSV: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  // All available database fields for mapping
  const databaseFields: DatabaseField[] = [
    'symbol',
    'quantity',
    'cost_basis',
    'purchase_date',
    'position_type',
    'strike_price',
    'expiration_date',
    'option_type',
    'premium',
    'contracts',
    'ignore'
  ]

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Upload CSV File</h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">
          CSV File Format
        </label>
        <p className="mt-1 text-sm text-gray-500">
          Upload a CSV file with any column names. The system will automatically detect common column name variations and map them to the appropriate fields. You can review and modify the mappings before uploading.
        </p>
        <div className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-semibold">Required fields: Symbol/Ticker, Quantity, Cost Basis</p>
          <p className="mt-1">Optional fields: Purchase Date (defaults to today), Position Type, and for options: Strike Price, Expiration Date, Option Type, Premium, Contracts</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">
          Select CSV File
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {showMapping && fieldMappings.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            <strong>Tip:</strong> Click on column headers in the preview table below to change field mappings. Required fields are marked with <span className="text-red-600">*</span>.
          </p>
          {/* Validation warnings */}
          {(() => {
            const validation = validateMappings()
            if (!validation.valid) {
              return (
                <div className="mt-3 rounded-md bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-800">Mapping Errors:</p>
                  <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                    {validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )
            }
            return null
          })()}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Data Preview ({preview.length} rows)
            {showMapping && (
              <span className="ml-2 text-xs font-normal text-gray-500">(Click column headers to change mapping)</span>
            )}
          </h3>
          <div className="max-h-64 overflow-auto rounded border border-gray-300 relative">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvColumns.map((column) => {
                    const mapping = fieldMappings.find(m => m.csvColumn === column)
                    const fieldInfo = mapping ? FIELD_METADATA[mapping.databaseField] : null
                        const isEditing = editingColumn === column
                    return (
                      <th 
                        key={column} 
                        className="relative px-3 py-2 text-left text-xs font-medium uppercase text-gray-500"
                      >
                        {showMapping ? (
                          <div className="group relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingColumn(isEditing ? null : column)
                              }}
                              className="flex flex-col items-start hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <div className="font-semibold">{column}</div>
                              {mapping && mapping.databaseField !== 'ignore' ? (
                                <div className="mt-1 text-xs font-normal text-blue-600">
                                  → {fieldInfo?.label}
                                  {fieldInfo?.required && <span className="text-red-600 ml-1">*</span>}
                                </div>
                              ) : (
                                <div className="mt-1 text-xs font-normal text-gray-400">
                                  (not mapped)
                                </div>
                              )}
                            </button>
                            
                            {isEditing && (
                              <div ref={dropdownRef} className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border border-gray-300 bg-white shadow-lg">
                                <div className="p-3">
                                  <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Map "{column}" to:
                                  </label>
                                  <select
                                    value={mapping?.databaseField || 'ignore'}
                                    onChange={(e) => {
                                      updateFieldMapping(column, e.target.value as DatabaseField)
                                      setEditingColumn(null)
                                    }}
                                    autoFocus
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                                  >
                                    {databaseFields.map((field) => (
                                      <option key={field} value={field}>
                                        {FIELD_METADATA[field].label}
                                        {FIELD_METADATA[field].required ? ' (required)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {mapping && FIELD_METADATA[mapping.databaseField] && (
                                    <p className="mt-2 text-xs text-gray-500">
                                      {FIELD_METADATA[mapping.databaseField].description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div>{column}</div>
                            {mapping && mapping.databaseField !== 'ignore' && (
                              <div className="mt-1 text-xs font-normal text-blue-600">
                                → {fieldInfo?.label}
                              </div>
                            )}
                          </>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {preview.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    {csvColumns.map((column) => (
                      <td key={column} className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                        {String(row[column] || '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 5 && (
              <p className="p-2 text-xs text-gray-500">
                Showing first 5 of {preview.length} rows
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || preview.length === 0 || uploading || (showMapping && !validateMappings().valid)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
        {file && (
          <button
            onClick={() => {
              setFile(null)
              setPreview([])
              setCsvColumns([])
              setFieldMappings([])
              setShowMapping(false)
            }}
            disabled={uploading}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

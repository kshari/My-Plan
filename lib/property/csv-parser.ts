import Papa from 'papaparse'

export interface ParsedRow {
  [key: string]: string
}

export interface ParseResult {
  columns: string[]
  rows: ParsedRow[]
  totalRows: number
}

/**
 * Parse a CSV file client-side using PapaParse.
 * Returns column headers and all rows as string dictionaries.
 */
export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as ParsedRow[]
        if (rows.length === 0) {
          reject(new Error('CSV file is empty or has no valid rows'))
          return
        }
        const columns = Object.keys(rows[0])
        resolve({ columns, rows, totalRows: rows.length })
      },
      error: (error) => {
        reject(new Error(`Error parsing CSV: ${error.message}`))
      },
    })
  })
}

import type { ParsedRow, ParseResult } from './csv-parser'

interface TextItem {
  str: string
  transform: number[]
}

/**
 * Parse a tabular PDF file client-side using pdfjs-dist.
 * Groups text items by Y position (rows) then sorts by X (columns).
 * Works for digitally-generated PDFs with tabular layouts.
 */
export async function parsePDF(file: File): Promise<ParseResult> {
  const pdfjsLib = await import('pdfjs-dist')

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allItems: TextItem[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        allItems.push({
          str: item.str.trim(),
          transform: (item as any).transform as number[],
        })
      }
    }
  }

  if (allItems.length === 0) {
    throw new Error('No text found in PDF. Only digitally-generated PDFs with tabular data are supported.')
  }

  const yGroups = groupByY(allItems, 3)

  if (yGroups.length < 2) {
    throw new Error('Could not detect a table in the PDF. At least a header row and one data row are needed.')
  }

  const headerRow = yGroups[0]
  const columns = headerRow.map((item) => item.str)

  const rows: ParsedRow[] = []
  for (let i = 1; i < yGroups.length; i++) {
    const dataRow = yGroups[i]
    const row: ParsedRow = {}
    for (let col = 0; col < columns.length; col++) {
      row[columns[col]] = dataRow[col]?.str ?? ''
    }
    const hasAnyValue = Object.values(row).some((v) => v.trim().length > 0)
    if (hasAnyValue) {
      rows.push(row)
    }
  }

  if (rows.length === 0) {
    throw new Error('PDF table has headers but no data rows.')
  }

  return { columns, rows, totalRows: rows.length }
}

/**
 * Group text items into rows by their Y coordinate.
 * Items within `tolerance` pixels of Y are considered the same row.
 * Within each row, items are sorted left-to-right by X.
 */
function groupByY(items: TextItem[], tolerance: number): TextItem[][] {
  const sorted = [...items].sort((a, b) => {
    const yA = a.transform[5]
    const yB = b.transform[5]
    return yB - yA
  })

  const rows: TextItem[][] = []
  let currentRow: TextItem[] = []
  let currentY = sorted[0]?.transform[5] ?? 0

  for (const item of sorted) {
    const y = item.transform[5]
    if (Math.abs(y - currentY) > tolerance) {
      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.transform[4] - b.transform[4])
        rows.push(currentRow)
      }
      currentRow = [item]
      currentY = y
    } else {
      currentRow.push(item)
    }
  }
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.transform[4] - b.transform[4])
    rows.push(currentRow)
  }

  return rows
}

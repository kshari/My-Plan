import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CSVUpload from '@/components/CSVUpload'

// Mock PapaParse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((file: File, options: any) => {
      // Simulate reading the file
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        const lines = text.split('\n').filter(Boolean)
        if (lines.length < 2) {
          options.complete({ data: [], errors: [] })
          return
        }
        const headers = lines[0].split(',')
        const rows = lines.slice(1).map((line: string) => {
          const vals = line.split(',')
          const row: Record<string, string> = {}
          headers.forEach((h: string, i: number) => {
            row[h.trim()] = vals[i]?.trim() || ''
          })
          return row
        })
        options.complete({ data: rows, errors: [] })
      }
      reader.readAsText(file)
    }),
  },
}))

// Mock market data
vi.mock('@/lib/utils/market-data', () => ({
  getTickerInfo: vi.fn().mockResolvedValue({ name: 'Test Stock' }),
}))

describe('CSVUpload', () => {
  const mockOnUploadSuccess = vi.fn()

  beforeEach(() => {
    mockOnUploadSuccess.mockClear()
  })

  it('should render the upload heading and button', () => {
    render(<CSVUpload portfolioId="test-portfolio" onUploadSuccess={mockOnUploadSuccess} />)
    expect(screen.getByText('Upload CSV File')).toBeInTheDocument()
    expect(screen.getByText('Upload CSV')).toBeInTheDocument()
  })

  it('should render file input', () => {
    render(<CSVUpload portfolioId="test-portfolio" onUploadSuccess={mockOnUploadSuccess} />)
    const fileInput = screen.getByLabelText('Select CSV File') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    expect(fileInput.type).toBe('file')
  })

  it('should disable upload button when no file is selected', () => {
    render(<CSVUpload portfolioId="test-portfolio" onUploadSuccess={mockOnUploadSuccess} />)
    const uploadButton = screen.getByText('Upload CSV')
    expect(uploadButton).toBeDisabled()
  })
})

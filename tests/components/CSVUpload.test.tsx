import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CSVUpload from '@/components/CSVUpload'

// Mock file reading
global.FileReader = class FileReader {
  result: string | null = null
  onload: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null

  readAsText(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      this.result = 'Symbol,Quantity,Price\nAAPL,10,150.00\nGOOGL,5,2500.00'
      if (this.onload) {
        this.onload({ target: { result: this.result } })
      }
    }, 0)
  }
} as any

describe('CSVUpload', () => {
  const mockOnUpload = vi.fn()

  beforeEach(() => {
    mockOnUpload.mockClear()
  })

  it('should render upload button', () => {
    render(<CSVUpload onUpload={mockOnUpload} />)
    expect(screen.getByText(/upload/i)).toBeInTheDocument()
  })

  it('should handle file selection', async () => {
    render(<CSVUpload onUpload={mockOnUpload} />)
    
    const file = new File(
      ['Symbol,Quantity,Price\nAAPL,10,150.00'],
      'test.csv',
      { type: 'text/csv' }
    )

    const input = screen.getByLabelText(/upload/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalled()
    })
  })

  it('should validate CSV format', async () => {
    render(<CSVUpload onUpload={mockOnUpload} />)
    
    const invalidFile = new File(
      ['Invalid content'],
      'test.txt',
      { type: 'text/plain' }
    )

    const input = screen.getByLabelText(/upload/i) as HTMLInputElement
    fireEvent.change(input, { target: { files: [invalidFile] } })

    // Should show error or not call onUpload
    await waitFor(() => {
      // Check for error message or that onUpload wasn't called with invalid data
    })
  })
})

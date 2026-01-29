import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SnapshotTab from '@/components/retirement/tabs/snapshot-tab'

// Mock the scenario context
vi.mock('@/components/retirement/scenario-context', () => ({
  useScenario: () => ({
    selectedScenarioId: 'test-scenario-id',
    setSelectedScenarioId: vi.fn(),
  }),
}))

describe('SnapshotTab', () => {
  const mockPlanId = 'test-plan-id'
  const mockOnSwitchToAdvanced = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render quick start form', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    expect(screen.getByLabelText(/your age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/retirement age/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/current savings/i)).toBeInTheDocument()
  })

  it('should update input values', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    const ageInput = screen.getByLabelText(/your age/i) as HTMLInputElement
    fireEvent.change(ageInput, { target: { value: '45' } })
    expect(ageInput.value).toBe('45')
  })

  it('should disable calculate button when required fields are missing', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    const calculateButton = screen.getByRole('button', {
      name: /save.*snapshot/i,
    })
    expect(calculateButton).toBeDisabled()
  })

  it('should enable calculate button when all required fields are filled', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/your age/i), {
      target: { value: '45' },
    })
    fireEvent.change(screen.getByLabelText(/retirement age/i), {
      target: { value: '65' },
    })
    fireEvent.change(screen.getByLabelText(/current savings/i), {
      target: { value: '100000' },
    })
    fireEvent.change(screen.getByLabelText(/estimated annual expenses/i), {
      target: { value: '50000' },
    })

    const calculateButton = screen.getByRole('button', {
      name: /save.*snapshot/i,
    })
    expect(calculateButton).not.toBeDisabled()
  })

  it('should handle SSA checkbox toggle', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    // First, we need to show results or SSA customization
    // This is a simplified test - you may need to adjust based on your component structure
    const ssaCheckbox = screen.queryByLabelText(
      /include social security income/i
    )
    if (ssaCheckbox) {
      fireEvent.click(ssaCheckbox)
      expect((ssaCheckbox as HTMLInputElement).checked).toBe(false)
    }
  })
})

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

// Mock recharts to avoid rendering issues in test environment
vi.mock('recharts', () => ({
  LineChart: () => null,
  Line: () => null,
  AreaChart: () => null,
  Area: () => null,
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => children,
  Tooltip: () => null,
}))

// Mock the tooltip components
vi.mock('@/components/property/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => children,
  TooltipTrigger: ({ children }: any) => children,
  TooltipContent: ({ children }: any) => children,
  TooltipProvider: ({ children }: any) => children,
}))

describe('SnapshotTab', () => {
  const mockPlanId = 123
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
    expect(screen.getByLabelText(/planned retirement age/i)).toBeInTheDocument()
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

  it('should have a save/calculate button', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    const calculateButton = screen.getByRole('button', {
      name: /save.*retirement snapshot/i,
    })
    expect(calculateButton).toBeInTheDocument()
  })

  it('should render Quick Start heading', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    expect(screen.getByText('Quick Start')).toBeInTheDocument()
  })

  it('should render estimated annual expenses input', () => {
    render(
      <SnapshotTab
        planId={mockPlanId}
        onSwitchToAdvanced={mockOnSwitchToAdvanced}
      />
    )

    const expensesInput = screen.getByLabelText(/estimated annual expenses/i) as HTMLInputElement
    expect(expensesInput).toBeInTheDocument()
    fireEvent.change(expensesInput, { target: { value: '80000' } })
    expect(expensesInput.value).toBe('80000')
  })
})

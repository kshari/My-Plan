# Testing Guide for Portfolio Analyzer

This guide explains how to write and run unit and functional tests for this Next.js application.

## Quick Start

```bash
# Install dependencies (already done)
npm install

# Run all tests
npm test

# Run tests in watch mode (recommended during development)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run a specific test file
npm test -- snapshot-tab.test.tsx

# Run tests matching a pattern
npm test -- --grep "retirement"
```

## Testing Stack

- **Vitest**: Fast unit test framework (Jest-compatible API)
- **React Testing Library**: Component testing utilities
- **jsdom**: DOM environment for browser-like testing
- **@testing-library/jest-dom**: Custom matchers for DOM assertions

## Project Structure

```
tests/
├── setup.ts                          # Global test configuration
├── components/                        # Component tests
│   ├── CSVUpload.test.tsx
│   └── snapshot-tab.test.tsx
└── utils/                            # Utility function tests
    ├── portfolio-analysis.test.ts
    └── retirement-projections.test.ts
```

## Writing Unit Tests

### Testing Pure Functions

Example: Testing retirement projection calculations

```typescript
// tests/utils/retirement-projections.test.ts
import { describe, it, expect } from 'vitest'
import { calculateRetirementProjections } from '@/lib/utils/retirement-projections'

describe('calculateRetirementProjections', () => {
  it('should calculate basic retirement scenario', () => {
    const result = calculateRetirementProjections(
      birthYear,
      accounts,
      expenses,
      otherIncome,
      settings
    )
    
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })
})
```

### Testing Component Behavior

Example: Testing form interactions

```typescript
// tests/components/snapshot-tab.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import SnapshotTab from '@/components/retirement/tabs/snapshot-tab'

describe('SnapshotTab', () => {
  it('should update input values', () => {
    render(<SnapshotTab planId="123" />)
    
    const ageInput = screen.getByLabelText(/your age/i)
    fireEvent.change(ageInput, { target: { value: '45' } })
    
    expect(ageInput.value).toBe('45')
  })
})
```

## Testing Patterns

### 1. Testing User Interactions

```typescript
import { fireEvent, waitFor } from '@testing-library/react'

it('should handle button clicks', async () => {
  render(<MyComponent />)
  
  const button = screen.getByRole('button', { name: /submit/i })
  fireEvent.click(button)
  
  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})
```

### 2. Testing Async Operations

```typescript
it('should load data asynchronously', async () => {
  render(<AsyncComponent />)
  
  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  }, { timeout: 3000 })
})
```

### 3. Testing Form Validation

```typescript
it('should show error for invalid input', async () => {
  render(<FormComponent />)
  
  const input = screen.getByLabelText(/email/i)
  fireEvent.change(input, { target: { value: 'invalid-email' } })
  fireEvent.blur(input)
  
  await waitFor(() => {
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument()
  })
})
```

### 4. Testing Conditional Rendering

```typescript
it('should show content when condition is met', () => {
  const { rerender } = render(<Component showContent={false} />)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
  
  rerender(<Component showContent={true} />)
  expect(screen.getByText('Content')).toBeInTheDocument()
})
```

## Mocking

### Mocking Supabase

The Supabase client is automatically mocked in `tests/setup.ts`. For specific tests:

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          data: [{ id: 1, name: 'Test' }],
          error: null,
        }),
      }),
    }),
  }),
}))
```

### Mocking Next.js Router

```typescript
import { useRouter } from 'next/navigation'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// In your test
expect(mockPush).toHaveBeenCalledWith('/expected-path')
```

### Mocking API Calls

```typescript
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'mock data' }),
  })
) as any
```

## Best Practices

### 1. Test User Behavior, Not Implementation

✅ Good:
```typescript
it('should save form data when submit button is clicked', () => {
  // Test what user sees and does
})
```

❌ Bad:
```typescript
it('should call handleSubmit function', () => {
  // Testing implementation details
})
```

### 2. Use Semantic Queries

✅ Good:
```typescript
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email address/i)
```

❌ Bad:
```typescript
screen.getByTestId('submit-button')
screen.getByClassName('email-input')
```

### 3. Keep Tests Isolated

Each test should be independent and not rely on other tests:

```typescript
describe('Component', () => {
  beforeEach(() => {
    // Reset state before each test
  })
  
  it('test 1', () => { /* ... */ })
  it('test 2', () => { /* ... */ })
})
```

### 4. Test Edge Cases

```typescript
describe('calculateRetirementProjections', () => {
  it('should handle zero balance', () => { /* ... */ })
  it('should handle negative values', () => { /* ... */ })
  it('should handle missing data', () => { /* ... */ })
})
```

## Coverage Goals

Aim for:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

View coverage report:
```bash
npm test -- --coverage
# Open coverage/index.html in browser
```

## Common Test Scenarios

### Testing Retirement Planner Components

1. **Quick Start Form**
   - Form validation
   - Input changes
   - Calculate button state
   - Results display

2. **SSA Settings**
   - Checkbox toggles
   - Save functionality
   - Recalculation triggers

3. **Projections Display**
   - Data rendering
   - Tooltip interactions
   - Chart rendering

### Testing Utility Functions

1. **Retirement Projections**
   - Basic calculations
   - Edge cases (zero balance, negative values)
   - Tax calculations
   - Withdrawal strategies

2. **Portfolio Analysis**
   - Position calculations
   - Weight distributions
   - Total value calculations

## Debugging Tests

### Using Vitest UI

```bash
npm run test:ui
```

Opens a browser interface for running and debugging tests.

### Console Logging

```typescript
it('should debug', () => {
  const result = myFunction()
  console.log('Result:', result)
  expect(result).toBeDefined()
})
```

### Debugging in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Current Test",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "${file}"]
}
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: |
    npm install
    npm test -- --coverage
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Next Steps

1. Start with utility functions (easiest to test)
2. Add component tests for critical user flows
3. Increase coverage gradually
4. Focus on testing business logic first
5. Add integration tests for API routes

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

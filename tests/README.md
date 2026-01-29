# Testing Guide

This project uses **Vitest** for unit testing and **React Testing Library** for component testing.

## Setup

Tests are configured in `vitest.config.ts` and test files are located in the `tests/` directory.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run a specific test file
npm test -- snapshot-tab.test.tsx
```

## Test Structure

```
tests/
├── setup.ts                    # Test configuration and mocks
├── components/                 # Component tests
│   ├── CSVUpload.test.tsx
│   └── snapshot-tab.test.tsx
└── utils/                      # Utility function tests
    ├── portfolio-analysis.test.ts
    └── retirement-projections.test.ts
```

## Writing Tests

### Unit Tests for Utilities

Test pure functions in `lib/utils/`:

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/lib/utils/my-utils'

describe('myFunction', () => {
  it('should handle basic case', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

### Component Tests

Test React components with React Testing Library:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should handle user interactions', () => {
    render(<MyComponent />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    // Assert expected behavior
  })
})
```

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react'

it('should handle async operations', async () => {
  render(<AsyncComponent />)
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what users see and do
2. **Use semantic queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Keep tests isolated**: Each test should be independent
4. **Mock external dependencies**: Mock Supabase, API calls, etc.
5. **Test edge cases**: Empty states, error states, boundary conditions

## Mocking

### Supabase Client

The Supabase client is mocked in `tests/setup.ts`. For specific test cases, you can override:

```typescript
import { vi } from 'vitest'
import { createClient } from '@/lib/supabase/client'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          data: mockData,
          error: null,
        }),
      }),
    }),
  }),
}))
```

### Next.js Router

The Next.js router is automatically mocked in `tests/setup.ts`.

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Continuous Integration

Add to your CI/CD pipeline:

```yaml
- name: Run tests
  run: npm test -- --coverage
```

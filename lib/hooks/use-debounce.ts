'use client'

import { useRef, useCallback } from 'react'

/**
 * Returns a debounced version of the provided callback.
 * Only the last invocation within `delay` ms will actually execute.
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    ((...args: any[]) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => callback(...args), delay)
    }) as T,
    [callback, delay]
  )
}

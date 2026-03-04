'use client'

import { LocalStorageProvider } from '@/lib/storage'

/**
 * Layout for the unauthenticated "try" experience.
 * No auth guard — wraps children in a LocalStorageProvider
 * so all components use localStorage as the data backend.
 */
export default function TryRetirementLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocalStorageProvider>
      <div className="min-h-screen bg-background">
        {children}
      </div>
    </LocalStorageProvider>
  )
}

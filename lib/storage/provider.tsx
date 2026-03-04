'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { DataService } from './types'
import { LocalDataService } from './local-adapter'

const StorageContext = createContext<DataService | null>(null)

export function useDataService(): DataService {
  const ctx = useContext(StorageContext)
  if (!ctx) throw new Error('useDataService must be used within a StorageProvider')
  return ctx
}

/**
 * Returns the DataService if inside a StorageProvider, or null otherwise.
 * Useful for components that need to work both inside and outside the provider.
 */
export function useOptionalDataService(): DataService | null {
  return useContext(StorageContext)
}

interface StorageProviderProps {
  children: ReactNode
  service: DataService
}

/**
 * Provides a DataService to the component tree.
 * The parent decides which adapter to use (LocalDataService vs SupabaseDataService).
 */
export function StorageProvider({ children, service }: StorageProviderProps) {
  const value = useMemo(() => service, [service])
  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
}

/**
 * Convenience wrapper that always provides a LocalDataService.
 * Used by the /apps/retirement/try route.
 */
export function LocalStorageProvider({ children }: { children: ReactNode }) {
  const service = useMemo(() => new LocalDataService(), [])
  return <StorageProvider service={service}>{children}</StorageProvider>
}

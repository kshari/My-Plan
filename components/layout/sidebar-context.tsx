"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  type ElementType,
} from "react"

export interface ContextNavItem {
  id: string
  label: string
  icon: ElementType
  disabled?: boolean
}

export interface ContextNavSection {
  /** Optional section header, e.g. "Setup" or "Analysis" */
  label?: string
  items: ContextNavItem[]
}

export interface ContextNavState {
  /** Short label shown above the section, e.g. "Retirement Plan" */
  title: string
  /** Where the back-link points, e.g. "/apps/retirement" */
  backHref?: string
  sections: ContextNavSection[]
  activeId: string
  onNavigate: (id: string) => void
}

interface SidebarNavContextValue {
  nav: ContextNavState | null
  setNav: (state: ContextNavState | null) => void
  updateActiveId: (id: string) => void
}

const SidebarNavContext = createContext<SidebarNavContextValue>({
  nav: null,
  setNav: () => {},
  updateActiveId: () => {},
})

export function SidebarNavProvider({ children }: { children: ReactNode }) {
  const [nav, setNavState] = useState<ContextNavState | null>(null)

  const setNav = useCallback((state: ContextNavState | null) => {
    setNavState(state)
  }, [])

  const updateActiveId = useCallback((id: string) => {
    setNavState((prev) => (prev ? { ...prev, activeId: id } : prev))
  }, [])

  return (
    <SidebarNavContext.Provider value={{ nav, setNav, updateActiveId }}>
      {children}
    </SidebarNavContext.Provider>
  )
}

export function useSidebarNav() {
  return useContext(SidebarNavContext)
}

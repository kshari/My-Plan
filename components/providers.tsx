"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { SidebarNavProvider } from "@/components/layout/sidebar-context"
import { AgentPanelProvider } from "@/components/agent/agent-panel-context"
import { ScoringConfigProvider } from "@/components/property/scoring-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ScoringConfigProvider>
        <SidebarNavProvider>
          <AgentPanelProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AgentPanelProvider>
        </SidebarNavProvider>
      </ScoringConfigProvider>
    </ThemeProvider>
  )
}

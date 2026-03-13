"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { SidebarNavProvider } from "@/components/layout/sidebar-context"
import { AgentPanelProvider } from "@/components/agent/agent-panel-context"
import { ScoringConfigProvider } from "@/components/property/scoring-context"
import { FontScaleProvider } from "@/components/layout/font-scale-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <FontScaleProvider>
        <ScoringConfigProvider>
          <SidebarNavProvider>
            <AgentPanelProvider>
              {children}
              <Toaster richColors position="top-right" />
            </AgentPanelProvider>
          </SidebarNavProvider>
        </ScoringConfigProvider>
      </FontScaleProvider>
    </ThemeProvider>
  )
}

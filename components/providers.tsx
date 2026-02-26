"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { SidebarNavProvider } from "@/components/layout/sidebar-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SidebarNavProvider>
        {children}
        <Toaster richColors position="top-right" />
      </SidebarNavProvider>
    </ThemeProvider>
  )
}

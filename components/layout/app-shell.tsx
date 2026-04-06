"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LayoutDashboard, Building2, Target, Activity, Bot, Handshake } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/sidebar"
import { useSidebarNav } from "@/components/layout/sidebar-context"
import { FeedbackButton } from "@/components/feedback/feedback-button"
import { BetaBanner } from "@/components/layout/beta-banner"
import { useAgentPanel } from "@/components/agent/agent-panel-context"
import { AgentPanel } from "@/components/agent/agent-panel"
import type { FeatureFlags } from "@/lib/app-features"

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
  isAdmin?: boolean
  features?: FeatureFlags
}

const bottomNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/apps/pulse", label: "Pulse", icon: Activity, color: "text-orange-500" },
  { href: "/apps/retirement", label: "Retire", icon: Target, color: "text-violet-500" },
  { href: "/apps/property", label: "Property", icon: Building2, color: "text-emerald-500" },
  { href: "/apps/partnerships", label: "Partners", icon: Handshake, color: "text-blue-500" },
]

export function AppShell({ children, userEmail, isAdmin = false, features }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { nav } = useSidebarNav()
  const { mode: agentMode, open: openAgent } = useAgentPanel()
  const aiAgentEnabled = features?.aiAgent !== false

  const isActive = (item: (typeof bottomNavItems)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const mobileContextItems = nav
    ? nav.sections.flatMap((s) => s.items).filter((i) => !i.disabled).slice(0, 4)
    : null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — fixed */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border shrink-0">
        <div className="h-full">
          <Sidebar userEmail={userEmail} isAdmin={isAdmin} aiAgentEnabled={aiAgentEnabled} />
        </div>
      </aside>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 border-r">
          <Sidebar userEmail={userEmail} isAdmin={isAdmin} aiAgentEnabled={aiAgentEnabled} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Content area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm">My Plan</span>
        </header>

        {/* Main + optional docked panel */}
        <div className="flex flex-1 min-h-0 relative">
          {/* Main content — hidden when agent is fullscreen */}
          {agentMode !== 'fullscreen' && (
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 min-w-0">
              <BetaBanner />
              {children}
            </main>
          )}

          {/* Agent panel — docked or fullscreen (only when feature enabled) */}
          {aiAgentEnabled && agentMode !== 'hidden' && <AgentPanel />}
        </div>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
          {mobileContextItems ? (
            mobileContextItems.map((item) => {
              const Icon = item.icon
              const active = nav!.activeId === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => nav!.onNavigate(item.id)}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[44px]",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      active && "scale-110 text-primary"
                    )}
                  />
                  <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-70")}>
                    {item.label}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-primary" />
                  )}
                </button>
              )
            })
          ) : (
            bottomNavItems.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[44px]",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform",
                      active && "scale-110",
                      active && item.color ? item.color : active ? "text-foreground" : "",
                      !active && item.color ? `${item.color} opacity-60` : ""
                    )}
                  />
                  <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-70")}>
                    {item.label}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-primary" />
                  )}
                </Link>
              )
            })
          )}
        </nav>

        {/* Agent FAB — only when panel is hidden and feature enabled */}
        {aiAgentEnabled && agentMode === 'hidden' && (
          <button
            onClick={openAgent}
            className={cn(
              "fixed bottom-32 right-4 z-50 lg:bottom-[4.5rem] lg:right-6",
              "flex h-11 w-11 items-center justify-center rounded-full",
              "bg-sky-500 text-white shadow-lg hover:bg-sky-600 hover:scale-105 active:scale-95",
              "transition-all duration-150"
            )}
            aria-label="Open AI Assistant"
          >
            <Bot className="h-5 w-5" />
          </button>
        )}
        <FeedbackButton />
      </div>
    </div>
  )
}

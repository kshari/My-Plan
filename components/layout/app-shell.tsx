"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, LayoutDashboard, Building2, Target, Activity } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/sidebar"
import { useSidebarNav } from "@/components/layout/sidebar-context"
import { FeedbackButton } from "@/components/feedback/feedback-button"

interface AppShellProps {
  children: React.ReactNode
  userEmail: string
  isAdmin?: boolean
}

const bottomNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/apps/pulse", label: "Pulse", icon: Activity, color: "text-orange-500" },
  { href: "/apps/retirement", label: "Retire", icon: Target, color: "text-violet-500" },
  { href: "/apps/property", label: "Property", icon: Building2, color: "text-emerald-500" },
]

export function AppShell({ children, userEmail, isAdmin = false }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { nav } = useSidebarNav()

  const isActive = (item: (typeof bottomNavItems)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  // Flatten contextual nav items (first 4 non-disabled) for mobile bottom bar
  const mobileContextItems = nav
    ? nav.sections.flatMap((s) => s.items).filter((i) => !i.disabled).slice(0, 4)
    : null

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — fixed */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <Sidebar userEmail={userEmail} isAdmin={isAdmin} />
        </div>
      </aside>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 border-r">
          <Sidebar userEmail={userEmail} isAdmin={isAdmin} onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Content area */}
      <div className="flex flex-1 flex-col min-w-0">
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

        {/* Main content — leaves room for bottom nav on mobile */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
          {mobileContextItems ? (
            // ── Contextual plan tabs ──
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
            // ── App switcher (default) ──
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

        <FeedbackButton />
      </div>
    </div>
  )
}

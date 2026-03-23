"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, Handshake, LayoutDashboard, TrendingUp, Vote } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { PartnershipsSidebar } from "@/components/partnerships/partnerships-sidebar"
import { FeedbackButton } from "@/components/feedback/feedback-button"
import type { PartnershipEntity } from "@/lib/types/partnerships"

interface PartnershipsShellProps {
  children: React.ReactNode
  userEmail: string
  entities: PartnershipEntity[]
}

export function PartnershipsShell({
  children,
  userEmail,
  entities,
}: PartnershipsShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Auto-detect current entity from pathname: /apps/partnerships/[entityId]/...
  const entityMatch = pathname.match(/^\/apps\/partnerships\/([^/]+)/)
  const currentEntityId = entityMatch ? entityMatch[1] : undefined

  const bottomNavItems = currentEntityId
    ? [
        {
          href: `/apps/partnerships/${currentEntityId}`,
          label: "Overview",
          icon: LayoutDashboard,
          exact: true,
        },
        {
          href: `/apps/partnerships/${currentEntityId}/investments`,
          label: "Investments",
          icon: TrendingUp,
        },
        {
          href: `/apps/partnerships/${currentEntityId}/decisions`,
          label: "Decisions",
          icon: Vote,
        },
      ]
    : [
        { href: "/apps/partnerships", label: "Partnerships", icon: Handshake, exact: true },
      ]

  const isActive = (item: (typeof bottomNavItems)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <PartnershipsSidebar
            userEmail={userEmail}
            entities={entities}
            currentEntityId={currentEntityId}
          />
        </div>
      </aside>

      {/* Mobile sheet sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 border-r">
          <PartnershipsSidebar
            userEmail={userEmail}
            entities={entities}
            currentEntityId={currentEntityId}
            onClose={() => setMobileOpen(false)}
          />
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
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
              <Handshake className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Partnerships</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 min-w-0">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center border-t bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden">
          {bottomNavItems.map((item) => {
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
                    active && "scale-110 text-blue-600"
                  )}
                />
                <span className={cn("transition-opacity", active ? "opacity-100" : "opacity-70")}>
                  {item.label}
                </span>
                {active && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-blue-600" />
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      <FeedbackButton />
    </div>
  )
}

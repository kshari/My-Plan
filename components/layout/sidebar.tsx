"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  Target,
  Activity,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  Bot,
  FileUp,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { toast } from 'sonner'
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { FontScaleToggle } from "@/components/layout/font-scale-toggle"
import { ClearDataDialog } from "@/components/layout/clear-data-dialog"
import { useSidebarNav } from "@/components/layout/sidebar-context"
import { useAgentPanel } from "@/components/agent/agent-panel-context"

const appNavItems = [
  {
    href: "/",
    label: "All Tools",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/apps/pulse",
    label: "Financial Pulse",
    icon: Activity,
    color: "text-orange-500",
  },
  {
    href: "/apps/retirement",
    label: "Retirement Planner",
    icon: Target,
    color: "text-violet-500",
  },
  {
    href: "/apps/property",
    label: "Property Investment",
    icon: Building2,
    color: "text-emerald-500",
  },
]

interface SidebarProps {
  userEmail: string
  isAdmin?: boolean
  aiAgentEnabled?: boolean
  onClose?: () => void
}

export function Sidebar({ userEmail, isAdmin = false, aiAgentEnabled = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { nav } = useSidebarNav()
  const { open: openAgent } = useAgentPanel()

  // null = auto-derive from context; true/false = user's manual override
  const [appsExpandedManual, setAppsExpandedManual] = useState<boolean | null>(null)
  // Auto-collapse apps list when a contextual nav is active (inside a plan)
  const appsExpanded = appsExpandedManual !== null ? appsExpandedManual : !nav

  const isActive = (item: (typeof appNavItems)[0]) => {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "UP"

  // Active app item (for collapsed state label)
  const activeApp = appNavItems.find((item) => isActive(item))

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
          <Target className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-base font-bold text-sidebar-foreground tracking-tight">
          My Plan
        </span>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto">

        {/* App navigation */}
        <nav className="space-y-0.5 px-3 py-4">
          {/* Section header — clickable toggle */}
          <button
            onClick={() => setAppsExpandedManual(!appsExpanded)}
            className="flex w-full items-center justify-between px-2 mb-1 group"
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
              Applications
            </p>
            <ChevronDown
              className={cn(
                "h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-all duration-200",
                appsExpanded && "rotate-180"
              )}
            />
          </button>

          {/* Collapsed state — show active app as a single non-interactive hint */}
          {!appsExpanded && activeApp && activeApp.href !== "/" && (
            <div className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs text-sidebar-foreground/50">
              <activeApp.icon className={cn("h-3.5 w-3.5 shrink-0", activeApp.color)} />
              <span className="truncate">{activeApp.label}</span>
            </div>
          )}

          {/* Expanded list */}
          {appsExpanded && (
            <>
              {appNavItems.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "opacity-100" : "opacity-70",
                        item.color
                      )}
                    />
                    {item.label}
                  </Link>
                )
              })}
              {aiAgentEnabled && (
                <button
                  onClick={() => { openAgent(); onClose?.() }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
                >
                  <Bot className="h-4 w-4 shrink-0 opacity-70 text-sky-500" />
                  AI Assistant
                </button>
              )}
            </>
          )}
        </nav>

        {/* Property Investment — Dashboard & Imports (visible when in property app) */}
        {pathname.startsWith("/apps/property") && (
          <>
            <div className="px-3">
              <Separator className="bg-sidebar-border" />
            </div>
            <nav className="space-y-0.5 px-3 py-3">
              <Link
                href="/apps/property/dashboard"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/apps/property/dashboard"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                Dashboard
              </Link>
              <Link
                href="/apps/property/imports"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/apps/property/imports")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <FileUp className="h-4 w-4 shrink-0" />
                Imports
              </Link>
              <Link
                href="/apps/property/analytics"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith("/apps/property/analytics")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <BarChart3 className="h-4 w-4 shrink-0" />
                Analytics
              </Link>
            </nav>
          </>
        )}

        {/* Retirement Planner — Plan Structure & Dashboard (visible when in retirement app, not in a plan) */}
        {pathname.startsWith("/apps/retirement") && !nav && (
          <>
            <div className="px-3">
              <Separator className="bg-sidebar-border" />
            </div>
            <nav className="space-y-0.5 px-3 py-3">
              <Link
                href="/apps/retirement/structure"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-2",
                  pathname === "/apps/retirement/structure"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" />
                Plan Structure
              </Link>
              <Link
                href="/apps/retirement/dashboard"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-2",
                  pathname === "/apps/retirement/dashboard"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                Dashboard
              </Link>
            </nav>
          </>
        )}

        {/* Contextual plan nav — injected by detail pages (Plan name + items when in a plan) */}
        {nav && (
          <>
            <div className="px-3">
              <Separator className="bg-sidebar-border" />
            </div>

            <nav className="space-y-0.5 px-3 py-3">
              {/* Plan Structure (first, not plan-specific) */}
              {(nav.planStructureHref || nav.planStructureNavId) && (
                nav.planStructureHref ? (
                  <Link
                    href={nav.planStructureHref}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-2",
                      pathname === nav.planStructureHref
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    Plan Structure
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      if (nav.planStructureNavId) {
                        nav.onNavigate(nav.planStructureNavId)
                        onClose?.()
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors mb-2",
                      nav.activeId === nav.planStructureNavId
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    )}
                  >
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    Plan Structure
                  </button>
                )
              )}

              {/* Dashboard link */}
              {nav.dashboardHref && (
                <Link
                  href={nav.dashboardHref}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-2",
                    pathname === nav.dashboardHref
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  Dashboard
                </Link>
              )}

              {/* Back + plan name */}
              <div className="flex items-center gap-1 mb-2">
                {nav.backHref && (
                  <Link
                    href={nav.backHref}
                    onClick={onClose}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors shrink-0"
                    title="Back"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Link>
                )}
                <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 truncate">
                  {nav.title}
                </p>
              </div>

              {nav.sections.map((section, si) => (
                <div key={si}>
                  {section.label && (
                    <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 select-none">
                      {section.label}
                    </p>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = nav.activeId === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (!item.disabled) {
                            nav.onNavigate(item.id)
                            onClose?.()
                          }
                        }}
                        disabled={item.disabled}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          item.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Admin link */}
      {isAdmin && (
        <div className="px-3 pb-1">
          <Link
            href="/apps/admin"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/apps/admin")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Admin
          </Link>
        </div>
      )}

      {/* User section */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3 space-y-0.5">
        <ThemeToggle />
        <FontScaleToggle />
        <Separator className="my-1 bg-sidebar-border" />
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className="text-xs text-sidebar-foreground/60 truncate"
            title={userEmail}
          >
            {userEmail}
          </span>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </form>
        <ClearDataDialog
          variant="sidebar"
          onConfirm={() => {
            try { localStorage.removeItem('rp_local_plan') } catch {}
            toast.success('Browser data cleared.')
          }}
        />
      </div>
    </div>
  )
}

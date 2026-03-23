"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Handshake,
  LayoutDashboard,
  Building2,
  TrendingUp,
  Users,
  BookOpen,
  Vote,
  FolderOpen,
  Settings,
  ChevronDown,
  ChevronLeft,
  ArrowLeft,
  Plus,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { FontScaleToggle } from "@/components/layout/font-scale-toggle"
import type { PartnershipEntity } from "@/lib/types/partnerships"

interface PartnershipsSidebarProps {
  userEmail: string
  entities: PartnershipEntity[]
  currentEntityId?: string
  onClose?: () => void
}

const entityNavItems = (entityId: string) => [
  { href: `/apps/partnerships/${entityId}`, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: `/apps/partnerships/${entityId}/investments`, label: "Investments", icon: TrendingUp },
  { href: `/apps/partnerships/${entityId}/ledger`, label: "Ledger", icon: BookOpen },
  { href: `/apps/partnerships/${entityId}/cap-table`, label: "Cap Table", icon: Users },
  { href: `/apps/partnerships/${entityId}/decisions`, label: "Decisions", icon: Vote },
  { href: `/apps/partnerships/${entityId}/documents`, label: "Documents", icon: FolderOpen },
  { href: `/apps/partnerships/${entityId}/members`, label: "Members", icon: Users },
  { href: `/apps/partnerships/${entityId}/settings`, label: "Settings", icon: Settings },
]

export function PartnershipsSidebar({
  userEmail,
  entities,
  currentEntityId,
  onClose,
}: PartnershipsSidebarProps) {
  const pathname = usePathname()
  const [entitiesExpanded, setEntitiesExpanded] = useState(true)

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "UP"
  const currentEntity = entities.find((e) => e.id === currentEntityId)

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shrink-0">
          <Handshake className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <span className="text-base font-bold text-sidebar-foreground tracking-tight block leading-tight">
            Partnerships
          </span>
          <span className="text-[10px] text-sidebar-foreground/40 leading-tight">by My Plan</span>
        </div>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto">
        {/* Back to My Plan */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back to My Plan
          </Link>
        </div>

        <Separator className="mx-3 bg-sidebar-border" />

        {/* Entity list section */}
        <nav className="space-y-0.5 px-3 py-3">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setEntitiesExpanded(!entitiesExpanded)}
              className="flex flex-1 items-center justify-between px-2 group"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                My Entities
              </p>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-all duration-200",
                  entitiesExpanded && "rotate-180"
                )}
              />
            </button>
            <Link
              href="/apps/partnerships/new"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors ml-1"
              title="New Entity"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          {entitiesExpanded && (
            <>
              {entities.length === 0 ? (
                <p className="px-3 py-2 text-xs text-sidebar-foreground/40">
                  No entities yet
                </p>
              ) : (
                entities.map((entity) => {
                  const active = pathname.startsWith(`/apps/partnerships/${entity.id}`)
                  return (
                    <Link
                      key={entity.id}
                      href={`/apps/partnerships/${entity.id}`}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      <Building2 className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70", "text-blue-500")} />
                      <span className="truncate">{entity.name}</span>
                    </Link>
                  )
                })
              )}
            </>
          )}

          {/* Partnerships home */}
          {!entitiesExpanded && (
            <Link
              href="/apps/partnerships"
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/apps/partnerships"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 opacity-70" />
              Dashboard
            </Link>
          )}
        </nav>

        {/* Entity sub-nav — only when inside an entity */}
        {currentEntityId && (
          <>
            <div className="px-3">
              <Separator className="bg-sidebar-border" />
            </div>
            <nav className="space-y-0.5 px-3 py-3">
              {/* Back to entity list + entity name */}
              <div className="flex items-center gap-1 mb-2">
                <Link
                  href="/apps/partnerships"
                  onClick={onClose}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors shrink-0"
                  title="All Entities"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
                <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 truncate">
                  {currentEntity?.name ?? "Entity"}
                </p>
              </div>

              {entityNavItems(currentEntityId).map((item) => {
                const active = isActive(item.href, item.exact)
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
                    <item.icon className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-70")} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </>
        )}
      </div>

      {/* User section */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-3 space-y-0.5">
        <ThemeToggle />
        <FontScaleToggle />
        <Separator className="my-1 bg-sidebar-border" />
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-blue-600/10 text-blue-600 text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-sidebar-foreground/60 truncate" title={userEmail}>
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
      </div>
    </div>
  )
}

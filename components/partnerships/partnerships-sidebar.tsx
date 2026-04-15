"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
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
  Calculator,
  FileText,
  Scale,
  BarChart3,
  Droplets,
  PieChart,
  ClipboardList,
  Receipt,
  HelpCircle,
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

const accountingNavItems = (entityId: string) => [
  { href: `/apps/partnerships/${entityId}/accounting`, label: "Accounting Home", icon: Calculator, exact: true },
  { href: `/apps/partnerships/${entityId}/accounting/chart-of-accounts`, label: "Chart of Accounts", icon: ClipboardList },
  { href: `/apps/partnerships/${entityId}/accounting/journal-entries`, label: "Journal Entries", icon: FileText },
  { href: `/apps/partnerships/${entityId}/accounting/balance-sheet`, label: "Balance Sheet", icon: Scale },
  { href: `/apps/partnerships/${entityId}/accounting/income-statement`, label: "Income Statement", icon: BarChart3 },
  { href: `/apps/partnerships/${entityId}/accounting/cash-flows`, label: "Cash Flows", icon: Droplets },
  { href: `/apps/partnerships/${entityId}/accounting/partners-capital`, label: "Partners' Capital", icon: PieChart },
  { href: `/apps/partnerships/${entityId}/accounting/trial-balance`, label: "Trial Balance", icon: Receipt },
  { href: `/apps/partnerships/${entityId}/accounting/k1s`, label: "Schedule K-1", icon: FolderOpen },
]

// ─── Entity dropdown (used when 2+ entities exist) ───────────────────────────

function EntityDropdown({
  entities,
  currentEntityId,
  pathname,
  onClose,
}: {
  entities: PartnershipEntity[]
  currentEntityId: string | undefined
  pathname: string
  onClose?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = entities.find(e => e.id === currentEntityId) ?? null

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function select(entityId: string) {
    setOpen(false)
    onClose?.()
    router.push(`/apps/partnerships/${entityId}`)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors border",
          open
            ? "bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground"
            : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="flex-1 truncate text-left">
          {current ? current.name : "Select entity…"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-sidebar-border bg-sidebar shadow-lg overflow-hidden">
          {entities.map(entity => {
            const active = entity.id === currentEntityId
            return (
              <button
                key={entity.id}
                onClick={() => select(entity.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                <Building2 className={cn("h-4 w-4 shrink-0 text-blue-500", active ? "opacity-100" : "opacity-60")} />
                <span className="truncate">{entity.name}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PartnershipsSidebar({
  userEmail,
  entities,
  currentEntityId,
  onClose,
}: PartnershipsSidebarProps) {
  const pathname = usePathname()

  // Whether the current path is inside the accounting sub-module
  const inAccounting = Boolean(
    currentEntityId &&
    pathname.startsWith(`/apps/partnerships/${currentEntityId}/accounting`)
  )

  // General nav and Accounting nav are mutually exclusive by default.
  // They auto-sync whenever the user navigates between sections, but can
  // still be toggled independently via their section headers.
  const [entityNavExpanded, setEntityNavExpanded] = useState(!inAccounting)
  const [accountingExpanded, setAccountingExpanded] = useState(inAccounting)
  const prevInAccounting = useRef(inAccounting)

  useEffect(() => {
    if (prevInAccounting.current !== inAccounting) {
      setEntityNavExpanded(!inAccounting)
      setAccountingExpanded(inAccounting)
      prevInAccounting.current = inAccounting
    }
  }, [inAccounting])

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
        {/* Back to My Plan + User Guide */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back to My Plan
          </Link>
          <Link
            href="/apps/partnerships/guide"
            onClick={onClose}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              pathname === "/apps/partnerships/guide"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            User Guide
          </Link>
        </div>

        <Separator className="mx-3 bg-sidebar-border" />

        {/* Entity list section */}
        <nav className="space-y-0.5 px-3 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              My Entities
            </p>
            <Link
              href="/apps/partnerships/new"
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
              title="New Entity"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          {entities.length === 0 ? (
            <p className="px-3 py-2 text-xs text-sidebar-foreground/40">
              No entities yet
            </p>
          ) : entities.length === 1 ? (
            /* Single entity — show as a plain nav link, no dropdown needed */
            (() => {
              const entity = entities[0]
              const active = pathname.startsWith(`/apps/partnerships/${entity.id}`)
              return (
                <Link
                  href={`/apps/partnerships/${entity.id}`}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <Building2 className={cn("h-4 w-4 shrink-0 text-blue-500", active ? "opacity-100" : "opacity-70")} />
                  <span className="truncate">{entity.name}</span>
                </Link>
              )
            })()
          ) : (
            /* Multiple entities — compact dropdown */
            <EntityDropdown
              entities={entities}
              currentEntityId={currentEntityId}
              pathname={pathname}
              onClose={onClose}
            />
          )}

          {/* Partnerships home — shown when on the root partnerships page */}
          {pathname === "/apps/partnerships" && (
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

        {/* Entity sub-nav — only when inside a real entity (not guide/new/join) */}
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

              {/* ── General nav (Overview, Investments, Ledger, …) ─────────── */}
              <button
                onClick={() => {
                  setEntityNavExpanded(v => {
                    if (!v) setAccountingExpanded(false)
                    return !v
                  })
                }}
                className="flex w-full items-center justify-between px-2 py-1 group mb-0.5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                  General
                </p>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-all duration-200",
                    entityNavExpanded && "rotate-180"
                  )}
                />
              </button>

              {entityNavExpanded && entityNavItems(currentEntityId).map((item) => {
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

              {/* ── Accounting nav ─────────────────────────────────────────── */}
              <div className={entityNavExpanded ? "mt-2" : "mt-0.5"}>
                {entityNavExpanded && <Separator className="bg-sidebar-border mb-2" />}
                <button
                  onClick={() => {
                    setAccountingExpanded(v => {
                      if (!v) setEntityNavExpanded(false)
                      return !v
                    })
                  }}
                  className="flex w-full items-center justify-between px-2 py-1 group mb-0.5"
                >
                  <div className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 transition-colors">
                      Accounting
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 transition-all duration-200",
                      accountingExpanded && "rotate-180"
                    )}
                  />
                </button>
                {accountingExpanded && accountingNavItems(currentEntityId).map((item) => {
                  const active = isActive(item.href, (item as any).exact)
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
              </div>
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

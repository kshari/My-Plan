'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldCheck, MessageSquare, Users, ArrowLeft, Bot, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { cn } from '@/lib/utils'
import { useAgentPanel } from '@/components/agent/agent-panel-context'
import { AgentPanel } from '@/components/agent/agent-panel'
import { FeedbackButton } from '@/components/feedback/feedback-button'
import type { FeatureFlags } from '@/lib/app-features'

const tabs = [
  { href: '/apps/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { href: '/apps/admin/agent-logs', label: 'Agent Logs', icon: Bot },
  { href: '/apps/admin/features', label: 'Features', icon: Settings, superAdminOnly: true },
  { href: '/apps/admin/users', label: 'Users', icon: Users, superAdminOnly: true },
]

interface AdminShellProps {
  children: React.ReactNode
  userEmail: string
  role: string
  features?: FeatureFlags
}

export function AdminShell({ children, userEmail, role, features }: AdminShellProps) {
  const pathname = usePathname()
  const isSuperAdmin = role === 'super_admin'
  const { mode: agentMode, open: openAgent } = useAgentPanel()
  const aiAgentEnabled = features?.aiAgent !== false

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 shrink-0 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Link>
            <span className="bg-border w-px h-5" aria-hidden />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Admin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:block">{userEmail}</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px">
            {tabs
              .filter((tab) => !tab.superAdminOnly || isSuperAdmin)
              .map((tab) => {
                const active = pathname.startsWith(tab.href)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </Link>
                )
              })}
          </nav>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative">
        <main className={cn(
          "flex-1 overflow-y-auto min-w-0",
          agentMode === 'fullscreen' && "hidden"
        )}>
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        {aiAgentEnabled && agentMode !== 'hidden' && <AgentPanel />}
      </div>

      {aiAgentEnabled && agentMode === 'hidden' && (
        <button
          onClick={openAgent}
          className={cn(
            "fixed bottom-6 right-6 z-50",
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
  )
}

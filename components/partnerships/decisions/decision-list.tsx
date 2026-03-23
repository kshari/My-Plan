"use client"

import Link from "next/link"
import { Vote, MessageSquare, Clock, CheckCircle, XCircle, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DECISION_TYPE_LABELS } from "@/lib/constants/partnerships"
import type { PartnershipDecision } from "@/lib/types/partnerships"

interface DecisionListProps {
  entityId: string
  decisions: PartnershipDecision[]
  isAdmin: boolean
  investmentId?: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  rejected: "bg-destructive/10 text-destructive",
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft: MessageSquare,
  open: Vote,
  closed: CheckCircle,
  approved: CheckCircle,
  rejected: XCircle,
}

export function DecisionList({ entityId, decisions, isAdmin, investmentId }: DecisionListProps) {
  const newHref = investmentId
    ? `/apps/partnerships/${entityId}/investments/${investmentId}/decisions/new`
    : `/apps/partnerships/${entityId}/decisions/new`

  const detailBase = investmentId
    ? `/apps/partnerships/${entityId}/investments/${investmentId}/decisions`
    : `/apps/partnerships/${entityId}/decisions`

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
        <Vote className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <h2 className="text-base font-semibold">No decisions yet</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Create votes, discussions, or announcements for the group.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-6">
          <Link href={newHref}>Create Decision</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {decisions.map((d) => {
        const StatusIcon = STATUS_ICONS[d.status] ?? Vote
        const isType = d.decision_type
        return (
          <Link
            key={d.id}
            href={`${detailBase}/${d.id}`}
            className="group block rounded-xl border bg-card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40 shrink-0 mt-0.5">
                {isType === "announcement" ? (
                  <Megaphone className="h-4 w-4 text-violet-600" />
                ) : isType === "discussion" ? (
                  <MessageSquare className="h-4 w-4 text-violet-600" />
                ) : (
                  <Vote className="h-4 w-4 text-violet-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold group-hover:text-blue-600 transition-colors">
                    {d.title}
                  </h3>
                  <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLES[d.status])}>
                    <StatusIcon className="h-3 w-3" />
                    {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {DECISION_TYPE_LABELS[d.decision_type]}
                  {d.deadline ? ` · Deadline: ${new Date(d.deadline).toLocaleDateString()}` : ""}
                </p>
                {d.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{d.description}</p>
                )}
                {d.outcome && (
                  <p className="mt-1 text-xs text-muted-foreground italic">Outcome: {d.outcome}</p>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { DecisionList } from "@/components/partnerships/decisions/decision-list"
import type { PartnershipDecision } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function DecisionsPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, decisionsResult, myMemberResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name").eq("id", entityId).single(),
    supabase
      .from("pt_decisions")
      .select("*")
      .eq("entity_id", entityId)
      .is("investment_id", null)
      .order("created_at", { ascending: false }),
    supabase.from("pt_members").select("role").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!entityResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decisions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entity-level votes, discussions, and announcements.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={`/apps/partnerships/${entityId}/decisions/new`}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Decision
          </Link>
        </Button>
      </div>
      <div className="mt-8">
        <DecisionList
          entityId={entityId}
          decisions={(decisionsResult.data ?? []) as PartnershipDecision[]}
          isAdmin={myMemberResult.data?.role === "admin"}
        />
      </div>
    </div>
  )
}

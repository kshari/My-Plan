import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { DecisionDetail } from "@/components/partnerships/decisions/decision-detail"
import type { PartnershipDecision, DecisionOption, Vote, DecisionComment, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string; decisionId: string }>
}

export default async function InvestmentDecisionDetailPage({ params }: PageProps) {
  const { entityId, investmentId, decisionId } = await params
  const { supabase, user } = await requireAuth()

  const [decisionResult, optionsResult, votesResult, commentsResult, membersResult, myMemberResult] = await Promise.all([
    supabase.from("pt_decisions").select("*").eq("id", decisionId).single(),
    supabase.from("pt_decision_options").select("*").eq("decision_id", decisionId).order("sort_order"),
    supabase.from("pt_votes").select("*").eq("decision_id", decisionId),
    supabase.from("pt_decision_comments").select("*").eq("decision_id", decisionId).order("created_at"),
    supabase.from("pt_members").select("*").eq("entity_id", entityId).neq("status", "removed"),
    supabase.from("pt_members").select("id, role, ownership_pct").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!decisionResult.data) notFound()

  const myMember = myMemberResult.data as Pick<PartnershipMember, "id" | "role" | "ownership_pct"> | null

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}/decisions`} className={BACK_LINK}>
        ← Back to Decisions
      </Link>
      <div className="mt-6">
        <DecisionDetail
          entityId={entityId}
          decision={decisionResult.data as PartnershipDecision}
          options={(optionsResult.data ?? []) as DecisionOption[]}
          votes={(votesResult.data ?? []) as Vote[]}
          comments={(commentsResult.data ?? []) as DecisionComment[]}
          members={(membersResult.data ?? []) as PartnershipMember[]}
          currentMemberId={myMember?.id ?? null}
          isAdmin={myMember?.role === "admin"}
        />
      </div>
    </div>
  )
}

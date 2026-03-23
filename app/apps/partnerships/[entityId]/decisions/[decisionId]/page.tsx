import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { DecisionDetail } from "@/components/partnerships/decisions/decision-detail"
import type {
  PartnershipDecision,
  DecisionOption,
  Vote,
  DecisionComment,
  PartnershipMember,
} from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; decisionId: string }>
}

export default async function DecisionDetailPage({ params }: PageProps) {
  const { entityId, decisionId } = await params
  const { supabase, user } = await requireAuth()

  const [decisionResult, optionsResult, votesResult, commentsResult, membersResult, myMemberResult] = await Promise.all([
    supabase.from("pt_decisions").select("*").eq("id", decisionId).eq("entity_id", entityId).single(),
    supabase.from("pt_decision_options").select("*").eq("decision_id", decisionId).order("sort_order"),
    supabase.from("pt_votes").select("*").eq("decision_id", decisionId),
    supabase.from("pt_decision_comments").select("*").eq("decision_id", decisionId).order("created_at"),
    supabase.from("pt_members").select("*").eq("entity_id", entityId).neq("status", "removed"),
    supabase.from("pt_members").select("id, role, ownership_pct").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!decisionResult.data) notFound()

  const decision = decisionResult.data as PartnershipDecision
  const options = (optionsResult.data ?? []) as DecisionOption[]
  const votes = (votesResult.data ?? []) as Vote[]
  const comments = (commentsResult.data ?? []) as DecisionComment[]
  const members = (membersResult.data ?? []) as PartnershipMember[]
  const myMember = myMemberResult.data as Pick<PartnershipMember, "id" | "role" | "ownership_pct"> | null
  const isAdmin = myMember?.role === "admin"

  const backHref = decision.investment_id
    ? `/apps/partnerships/${entityId}/investments/${decision.investment_id}/decisions`
    : `/apps/partnerships/${entityId}/decisions`

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={backHref} className={BACK_LINK}>
        ← Back to Decisions
      </Link>
      <div className="mt-6">
        <DecisionDetail
          entityId={entityId}
          decision={decision}
          options={options}
          votes={votes}
          comments={comments}
          members={members}
          currentMemberId={myMember?.id ?? null}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}

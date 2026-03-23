import { notFound } from "next/navigation"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER } from "@/lib/constants/css"
import { EntityDashboard } from "@/components/partnerships/entity-dashboard"
import type { CapitalEvent, PartnershipDecision, PartnershipEntity, PartnershipInvestment, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function EntityDashboardPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, membersResult, investmentsResult, decisionsResult, capitalEventsResult] = await Promise.all([
    supabase.from("pt_entities").select("*").eq("id", entityId).single(),
    supabase.from("pt_members").select("*").eq("entity_id", entityId).neq("status", "removed"),
    supabase.from("pt_investments").select("*").eq("entity_id", entityId).neq("status", "cancelled"),
    supabase
      .from("pt_decisions")
      .select("*")
      .eq("entity_id", entityId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("pt_capital_events")
      .select("member_id, event_type, amount")
      .eq("entity_id", entityId),
  ])

  if (!entityResult.data) notFound()

  const entity = entityResult.data as PartnershipEntity
  const members = (membersResult.data ?? []) as PartnershipMember[]
  const investments = (investmentsResult.data ?? []) as PartnershipInvestment[]
  const openDecisions = (decisionsResult.data ?? []) as PartnershipDecision[]
  const capitalEvents = (capitalEventsResult.data ?? []) as Pick<CapitalEvent, "member_id" | "event_type" | "amount">[]

  const myMember = members.find((m) => m.user_id === user.id)
  const isAdmin = myMember?.role === "admin"

  return (
    <div className={PAGE_CONTAINER}>
      <EntityDashboard
        entity={entity}
        members={members}
        investments={investments}
        openDecisions={openDecisions}
        capitalEvents={capitalEvents}
        isAdmin={isAdmin}
        userId={user.id}
      />
    </div>
  )
}

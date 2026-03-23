import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { CapTableView } from "@/components/partnerships/cap-table/cap-table-view"
import type { CapTableEntry, CapitalEvent, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function CapTablePage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, entriesResult, membersResult, myMemberResult, eventsResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name").eq("id", entityId).single(),
    supabase
      .from("pt_cap_table")
      .select("*")
      .eq("entity_id", entityId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("pt_members").select("*").eq("entity_id", entityId).neq("status", "removed"),
    supabase.from("pt_members").select("role").eq("entity_id", entityId).eq("user_id", user.id).single(),
    supabase
      .from("pt_capital_events")
      .select("*")
      .eq("entity_id", entityId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ])

  if (!entityResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Cap Table</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ownership records and capital contributions for {entityResult.data.name}.
        </p>
      </div>
      <div className="mt-8">
        <CapTableView
          entityId={entityId}
          entries={(entriesResult.data ?? []) as CapTableEntry[]}
          members={(membersResult.data ?? []) as PartnershipMember[]}
          capitalEvents={(eventsResult.data ?? []) as CapitalEvent[]}
          isAdmin={myMemberResult.data?.role === "admin"}
        />
      </div>
    </div>
  )
}

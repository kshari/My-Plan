import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { LedgerView } from "@/components/partnerships/ledger/ledger-view"
import type { PartnershipTransaction, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function LedgerPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, txnResult, membersResult, myMemberResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name").eq("id", entityId).single(),
    supabase
      .from("pt_transactions")
      .select("*")
      .eq("entity_id", entityId)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("pt_members")
      .select("*")
      .eq("entity_id", entityId)
      .neq("status", "removed"),
    supabase
      .from("pt_members")
      .select("role")
      .eq("entity_id", entityId)
      .eq("user_id", user.id)
      .single(),
  ])

  if (!entityResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Ledger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Income, expenses, capital calls, and distributions for {entityResult.data.name}.
        </p>
      </div>
      <div className="mt-8">
        <LedgerView
          entityId={entityId}
          transactions={(txnResult.data ?? []) as PartnershipTransaction[]}
          members={(membersResult.data ?? []) as PartnershipMember[]}
          isAdmin={myMemberResult.data?.role === "admin"}
        />
      </div>
    </div>
  )
}

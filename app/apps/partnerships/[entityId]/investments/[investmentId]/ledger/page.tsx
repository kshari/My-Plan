import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { LedgerView } from "@/components/partnerships/ledger/ledger-view"
import type { PartnershipTransaction, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string }>
}

export default async function InvestmentLedgerPage({ params }: PageProps) {
  const { entityId, investmentId } = await params
  const { supabase, user } = await requireAuth()

  const [investmentResult, txnResult, membersResult, myMemberResult] = await Promise.all([
    supabase.from("pt_investments").select("id, name").eq("id", investmentId).eq("entity_id", entityId).single(),
    supabase.from("pt_transactions").select("*").eq("entity_id", entityId).eq("investment_id", investmentId).order("transaction_date", { ascending: false }),
    supabase.from("pt_members").select("*").eq("entity_id", entityId).neq("status", "removed"),
    supabase.from("pt_members").select("role").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!investmentResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}`} className={BACK_LINK}>
        ← Back to Investment
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Ledger — {investmentResult.data.name}</h1>
      </div>
      <div className="mt-8">
        <LedgerView
          entityId={entityId}
          transactions={(txnResult.data ?? []) as PartnershipTransaction[]}
          members={(membersResult.data ?? []) as PartnershipMember[]}
          isAdmin={myMemberResult.data?.role === "admin"}
          investmentId={investmentId}
        />
      </div>
    </div>
  )
}

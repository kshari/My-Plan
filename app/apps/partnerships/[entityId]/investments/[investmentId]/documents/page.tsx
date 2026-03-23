import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { DocumentVault } from "@/components/partnerships/documents/document-vault"
import type { PartnershipDocument } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string }>
}

export default async function InvestmentDocumentsPage({ params }: PageProps) {
  const { entityId, investmentId } = await params
  const { supabase, user } = await requireAuth()

  const [investmentResult, docsResult, myMemberResult] = await Promise.all([
    supabase.from("pt_investments").select("id, name").eq("id", investmentId).single(),
    supabase.from("pt_documents").select("*").eq("entity_id", entityId).eq("investment_id", investmentId).order("created_at", { ascending: false }),
    supabase.from("pt_members").select("role").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!investmentResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}`} className={BACK_LINK}>
        ← Back to Investment
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Documents — {investmentResult.data.name}</h1>
      </div>
      <div className="mt-8">
        <DocumentVault
          entityId={entityId}
          documents={(docsResult.data ?? []) as PartnershipDocument[]}
          isAdmin={myMemberResult.data?.role === "admin"}
          investmentId={investmentId}
        />
      </div>
    </div>
  )
}

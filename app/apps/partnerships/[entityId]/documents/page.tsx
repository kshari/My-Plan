import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { DocumentVault } from "@/components/partnerships/documents/document-vault"
import type { PartnershipDocument } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function DocumentsPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, docsResult, myMemberResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name").eq("id", entityId).single(),
    supabase.from("pt_documents").select("*").eq("entity_id", entityId).is("investment_id", null).order("created_at", { ascending: false }),
    supabase.from("pt_members").select("role").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!entityResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Document Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operating agreements, K-1s, tax returns, and more for {entityResult.data.name}.
        </p>
      </div>
      <div className="mt-8">
        <DocumentVault
          entityId={entityId}
          documents={(docsResult.data ?? []) as PartnershipDocument[]}
          isAdmin={myMemberResult.data?.role === "admin"}
        />
      </div>
    </div>
  )
}

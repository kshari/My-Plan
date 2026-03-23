import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { InvestmentForm } from "@/components/partnerships/investments/investment-form"
import type { PartnershipInvestment } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string }>
}

export default async function EditInvestmentPage({ params }: PageProps) {
  const { entityId, investmentId } = await params
  const { supabase } = await requireAuth()

  const { data: investment } = await supabase
    .from("pt_investments")
    .select("*")
    .eq("id", investmentId)
    .eq("entity_id", entityId)
    .single()

  if (!investment) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}`} className={BACK_LINK}>
        ← Back to Investment
      </Link>
      <div className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">Edit Investment</h1>
        <div className="mt-8">
          <InvestmentForm entityId={entityId} investment={investment as PartnershipInvestment} />
        </div>
      </div>
    </div>
  )
}

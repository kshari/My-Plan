import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { InvestmentDetail } from "@/components/partnerships/investments/investment-detail"
import type { PartnershipInvestment, InvestmentStage, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string }>
}

export default async function InvestmentDetailPage({ params }: PageProps) {
  const { entityId, investmentId } = await params
  const { supabase, user } = await requireAuth()

  const [investmentResult, stagesResult, memberResult] = await Promise.all([
    supabase.from("pt_investments").select("*").eq("id", investmentId).eq("entity_id", entityId).single(),
    supabase.from("pt_investment_stages").select("*").eq("investment_id", investmentId).order("entered_at", { ascending: true }),
    supabase.from("pt_members").select("role, user_id").eq("entity_id", entityId).eq("user_id", user.id).single(),
  ])

  if (!investmentResult.data) notFound()

  const investment = investmentResult.data as PartnershipInvestment
  const stages = (stagesResult.data ?? []) as InvestmentStage[]
  const isAdmin = (memberResult.data as Pick<PartnershipMember, "role" | "user_id"> | null)?.role === "admin"

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments`} className={BACK_LINK}>
        ← Back to Investments
      </Link>
      <div className="mt-6">
        <InvestmentDetail
          entityId={entityId}
          investment={investment}
          stages={stages}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}

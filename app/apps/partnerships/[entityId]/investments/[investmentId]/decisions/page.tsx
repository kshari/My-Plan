import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { DecisionList } from "@/components/partnerships/decisions/decision-list"
import type { PartnershipDecision } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string; investmentId: string }>
}

export default async function InvestmentDecisionsPage({ params }: PageProps) {
  const { entityId, investmentId } = await params
  const { supabase, user } = await requireAuth()

  const [investmentResult, decisionsResult] = await Promise.all([
    supabase.from("pt_investments").select("id, name").eq("id", investmentId).eq("entity_id", entityId).single(),
    supabase.from("pt_decisions").select("*").eq("entity_id", entityId).eq("investment_id", investmentId).order("created_at", { ascending: false }),
  ])

  if (!investmentResult.data) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}`} className={BACK_LINK}>
        ← Back to {investmentResult.data.name}
      </Link>
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decisions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Votes and discussions for this investment.</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/apps/partnerships/${entityId}/investments/${investmentId}/decisions/new`}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Decision
          </Link>
        </Button>
      </div>
      <div className="mt-8">
        <DecisionList
          entityId={entityId}
          decisions={(decisionsResult.data ?? []) as PartnershipDecision[]}
          isAdmin
          investmentId={investmentId}
        />
      </div>
    </div>
  )
}

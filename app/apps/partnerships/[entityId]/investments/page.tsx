import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { InvestmentList } from "@/components/partnerships/investments/investment-list"
import type { CapitalEvent, PartnershipInvestment, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function InvestmentsPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, investmentsResult, membersResult, capitalEventsResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name, cash_balance, cash_balance_as_of").eq("id", entityId).single(),
    supabase
      .from("pt_investments")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pt_members")
      .select("role, user_id")
      .eq("entity_id", entityId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("pt_capital_events")
      .select("event_type, amount")
      .eq("entity_id", entityId),
  ])

  if (!entityResult.data) notFound()

  const investments = (investmentsResult.data ?? []) as PartnershipInvestment[]
  const myMember = membersResult.data as Pick<PartnershipMember, "role" | "user_id"> | null
  const isAdmin = myMember?.role === "admin"

  // Sum all contribution events for total capital contributed
  const capitalContributed = ((capitalEventsResult.data ?? []) as Pick<CapitalEvent, "event_type" | "amount">[])
    .filter((e) => e.event_type === "contribution")
    .reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track all investment opportunities and their workflow stages.
          </p>
        </div>
        {isAdmin && (
          <Button asChild size="sm">
            <Link href={`/apps/partnerships/${entityId}/investments/new`}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Investment
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-8">
        <InvestmentList
          entityId={entityId}
          investments={investments}
          isAdmin={isAdmin}
          cashBalance={entityResult.data?.cash_balance ?? 0}
          cashBalanceAsOf={entityResult.data?.cash_balance_as_of ?? null}
          capitalContributed={capitalContributed > 0 ? capitalContributed : null}
        />
      </div>
    </div>
  )
}

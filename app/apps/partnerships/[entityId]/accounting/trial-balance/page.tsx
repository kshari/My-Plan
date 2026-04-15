"use client"
import { useParams } from "next/navigation"
import { TrialBalanceView } from "@/components/partnerships/accounting/financial-statement-views"
export default function TrialBalancePage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <TrialBalanceView entityId={entityId} />
}

"use client"
import { useParams } from "next/navigation"
import { CashFlowView } from "@/components/partnerships/accounting/financial-statement-views"
export default function CashFlowsPage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <CashFlowView entityId={entityId} />
}

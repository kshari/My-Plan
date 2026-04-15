"use client"
import { useParams } from "next/navigation"
import { BalanceSheetView } from "@/components/partnerships/accounting/financial-statement-views"
export default function BalanceSheetPage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <BalanceSheetView entityId={entityId} />
}

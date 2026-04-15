"use client"
import { useParams } from "next/navigation"
import { IncomeStatementView } from "@/components/partnerships/accounting/financial-statement-views"
export default function IncomeStatementPage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <IncomeStatementView entityId={entityId} />
}

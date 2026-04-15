"use client"
import { useParams } from "next/navigation"
import { PartnersCapitalView } from "@/components/partnerships/accounting/financial-statement-views"
export default function PartnersCapitalPage() {
  const { entityId } = useParams<{ entityId: string }>()
  return <PartnersCapitalView entityId={entityId} />
}

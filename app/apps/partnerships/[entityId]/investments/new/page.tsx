import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { InvestmentForm } from "@/components/partnerships/investments/investment-form"
import { notFound } from "next/navigation"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function NewInvestmentPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const { data: entity } = await supabase
    .from("pt_entities")
    .select("id, name")
    .eq("id", entityId)
    .single()

  if (!entity) notFound()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/investments`} className={BACK_LINK}>
        ← Back to Investments
      </Link>
      <div className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">Add Investment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new investment opportunity for {entity.name}.
        </p>
        <div className="mt-8">
          <InvestmentForm entityId={entityId} />
        </div>
      </div>
    </div>
  )
}

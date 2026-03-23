import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { DecisionForm } from "@/components/partnerships/decisions/decision-form"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function NewDecisionPage({ params }: PageProps) {
  const { entityId } = await params
  await requireAuth()

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}/decisions`} className={BACK_LINK}>
        ← Back to Decisions
      </Link>
      <div className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">New Decision</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a vote, discussion, or announcement for the group.
        </p>
        <div className="mt-8">
          <DecisionForm entityId={entityId} />
        </div>
      </div>
    </div>
  )
}

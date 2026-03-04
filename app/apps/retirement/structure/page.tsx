import { requireAuth } from '@/lib/utils/auth'
import { PAGE_CONTAINER } from '@/lib/constants/css'
import Link from 'next/link'
import { PlanStructureContent } from '@/components/retirement/plan-structure-content'

export default async function PlanStructurePage() {
  await requireAuth()

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <Link
          href="/apps/retirement/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Plan Structure</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of retirement planning sections. Select a plan from the Dashboard to get started.
        </p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-6">
        <PlanStructureContent showOpen={false} />
      </div>
    </div>
  )
}

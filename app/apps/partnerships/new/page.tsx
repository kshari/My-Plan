import Link from "next/link"
import { CreateEntityForm } from "@/components/partnerships/create-entity-form"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"

export default function NewEntityPage() {
  return (
    <div className={PAGE_CONTAINER}>
      <Link href="/apps/partnerships" className={BACK_LINK}>
        ← Back to Partnerships
      </Link>
      <div className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">Create New Entity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a new investment group entity — an LLC, LP, or informal partnership.
        </p>
        <div className="mt-8">
          <CreateEntityForm />
        </div>
      </div>
    </div>
  )
}

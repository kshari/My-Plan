import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { EntitySettingsForm } from "@/components/partnerships/entity-settings-form"
import type { PartnershipEntity } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function EntitySettingsPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const { data: entity } = await supabase
    .from("pt_entities")
    .select("*")
    .eq("id", entityId)
    .single()

  if (!entity) notFound()

  const { data: member } = await supabase
    .from("pt_members")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .single()

  if (!member || member.role !== "admin") {
    return (
      <div className={PAGE_CONTAINER}>
        <p className="text-muted-foreground">You do not have admin access to this entity.</p>
      </div>
    )
  }

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold tracking-tight">Entity Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update formation details and entity information.
        </p>
        <div className="mt-8">
          <EntitySettingsForm entity={entity as PartnershipEntity} />
        </div>
      </div>
    </div>
  )
}

import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAuth } from "@/lib/utils/auth"
import { PAGE_CONTAINER, BACK_LINK } from "@/lib/constants/css"
import { MemberList } from "@/components/partnerships/members/member-list"
import type { PartnershipEntity, PartnershipMember } from "@/lib/types/partnerships"

interface PageProps {
  params: Promise<{ entityId: string }>
}

export default async function MembersPage({ params }: PageProps) {
  const { entityId } = await params
  const { supabase, user } = await requireAuth()

  const [entityResult, membersResult] = await Promise.all([
    supabase.from("pt_entities").select("id, name").eq("id", entityId).single(),
    supabase
      .from("pt_members")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true }),
  ])

  if (!entityResult.data) notFound()

  const entity = entityResult.data as Pick<PartnershipEntity, "id" | "name">
  const members = (membersResult.data ?? []) as PartnershipMember[]
  const myMember = members.find((m) => m.user_id === user.id)
  const isAdmin = myMember?.role === "admin"

  return (
    <div className={PAGE_CONTAINER}>
      <Link href={`/apps/partnerships/${entityId}`} className={BACK_LINK}>
        ← Back to Overview
      </Link>
      <div className="mt-6">
        <h1 className="text-2xl font-bold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage members, roles, and send invitations for {entity.name}.
        </p>
      </div>
      <div className="mt-8">
        <MemberList
          entityId={entityId}
          entityName={entity.name}
          members={members}
          isAdmin={isAdmin}
          currentUserId={user.id}
        />
      </div>
    </div>
  )
}

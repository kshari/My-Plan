import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { MembersClient } from "@/components/family/members-client"
import type { Family, FamilyMember, FamilyInvitation } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function MembersPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const [{ data: family }, { data: myMember }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!family) notFound()

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).neq("status", "removed").order("created_at", { ascending: true }),
    supabase.from("fa_invitations").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
  ])

  return (
    <MembersClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      invitations={(invitations ?? []) as FamilyInvitation[]}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  )
}

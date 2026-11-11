import { requireAuth } from "@/lib/utils/auth"
import { FamilyListClient } from "@/components/family/family-list-client"
import type { Family, FamilyMember } from "@/lib/types/family"

export default async function FamilyPage() {
  const { supabase, user } = await requireAuth()

  const { data: members } = await supabase
    .from("fa_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("status", "active")

  const memberFamilyIds = (members ?? []).map((m) => m.family_id)

  const familyIds = [...new Set([...memberFamilyIds])]

  let families: Family[] = []
  if (familyIds.length > 0) {
    const { data } = await supabase
      .from("fa_families")
      .select("*")
      .in("id", familyIds)
      .order("created_at", { ascending: false })
    families = (data ?? []) as Family[]
  }

  const { data: myMemberships } = await supabase
    .from("fa_members")
    .select("*")
    .in("family_id", familyIds.length > 0 ? familyIds : ["none"])
    .eq("user_id", user.id)

  return (
    <FamilyListClient
      families={families}
      myMemberships={(myMemberships ?? []) as FamilyMember[]}
      userId={user.id}
      userEmail={user.email ?? ""}
    />
  )
}

import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { InterestsClient } from "@/components/family/interests-client"
import type { Family, FamilyMember, Interest } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function InterestsPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const [{ data: family }, { data: myMember }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!family) notFound()

  const [{ data: members }, { data: interests }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).in("status", ["active","placeholder"]).order("created_at"),
    supabase.from("fa_interests").select("*").eq("family_id", familyId),
  ])

  return (
    <InterestsClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      initialInterests={(interests ?? []) as Interest[]}
      userId={user.id}
    />
  )
}

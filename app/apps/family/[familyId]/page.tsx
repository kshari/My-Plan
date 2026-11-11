import { requireAuth } from "@/lib/utils/auth"
import { notFound, redirect } from "next/navigation"
import { FamilyDashboardClient } from "@/components/family/family-dashboard-client"
import type { Family, FamilyMember, Suggestion, Trip } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function FamilyDashboardPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const [{ data: family }, { data: myMember }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!family) notFound()
  if (!myMember && family.created_by !== user.id) redirect("/apps/family")

  const [{ data: members }, { data: suggestions }, { data: trips }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).neq("status", "removed").order("joined_at", { ascending: true }),
    supabase.from("fa_suggestions").select("*").eq("family_id", familyId).neq("status", "dismissed").order("score", { ascending: false }).limit(5),
    supabase.from("fa_trips").select("*").eq("family_id", familyId).neq("status", "cancelled").order("start_date", { ascending: true }).limit(3),
  ])

  return (
    <FamilyDashboardClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      topSuggestions={(suggestions ?? []) as Suggestion[]}
      upcomingTrips={(trips ?? []) as Trip[]}
    />
  )
}

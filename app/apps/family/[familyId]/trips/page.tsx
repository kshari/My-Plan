import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { TripsClient } from "@/components/family/trips-client"
import type { Family, FamilyMember, Trip, Suggestion } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function TripsPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const { data: family } = await supabase.from("fa_families").select("*").eq("id", familyId).single()
  if (!family) notFound()

  const [{ data: myMember }, { data: members }, { data: trips }, { data: shortlisted }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).in("status", ["active","placeholder"]),
    supabase.from("fa_trips").select("*").eq("family_id", familyId).neq("status", "cancelled").order("start_date", { ascending: true, nullsFirst: false }),
    supabase.from("fa_suggestions").select("*").eq("family_id", familyId).eq("status", "shortlisted"),
  ])

  return (
    <TripsClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      initialTrips={(trips ?? []) as Trip[]}
      shortlistedSuggestions={(shortlisted ?? []) as Suggestion[]}
      userId={user.id}
    />
  )
}

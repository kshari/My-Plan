import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { SuggestionsClient } from "@/components/family/suggestions-client"
import type { Family, FamilyMember, Suggestion, SuggestionVote, Place } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function SuggestionsPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const [{ data: family }, { data: myMember }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!family) notFound()

  const [{ data: members }, { data: suggestions }, { data: votes }, { data: places }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).in("status", ["active","placeholder"]),
    supabase.from("fa_suggestions").select("*").eq("family_id", familyId).order("score", { ascending: false, nullsFirst: false }),
    supabase.from("fa_suggestion_votes").select("*").eq("family_id", familyId),
    supabase.from("fa_places").select("*").eq("family_id", familyId),
  ])

  return (
    <SuggestionsClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      initialSuggestions={(suggestions ?? []) as Suggestion[]}
      initialVotes={(votes ?? []) as SuggestionVote[]}
      places={(places ?? []) as Place[]}
      userId={user.id}
    />
  )
}

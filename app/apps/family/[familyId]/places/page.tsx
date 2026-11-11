import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { PlacesClient } from "@/components/family/places-client"
import type { Family, FamilyMember, Place } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function PlacesPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const { data: family } = await supabase.from("fa_families").select("*").eq("id", familyId).single()
  if (!family) notFound()

  const [{ data: myMember }, { data: places }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
    supabase.from("fa_places").select("*").eq("family_id", familyId).order("created_at", { ascending: false }),
  ])

  return (
    <PlacesClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      initialPlaces={(places ?? []) as Place[]}
      userId={user.id}
    />
  )
}

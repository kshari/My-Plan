import { requireAuth } from "@/lib/utils/auth"
import { notFound } from "next/navigation"
import { AvailabilityClient } from "@/components/family/availability-client"
import type { Family, FamilyMember, Availability } from "@/lib/types/family"

interface Props { params: Promise<{ familyId: string }> }

export default async function AvailabilityPage({ params }: Props) {
  const { familyId } = await params
  const { supabase, user } = await requireAuth()

  const [{ data: family }, { data: myMember }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!family) notFound()

  const [{ data: members }, { data: availability }] = await Promise.all([
    supabase.from("fa_members").select("*").eq("family_id", familyId).in("status", ["active","placeholder"]).order("created_at"),
    supabase.from("fa_availability").select("*").eq("family_id", familyId).gte("end_ts", new Date().toISOString()).order("start_ts"),
  ])

  return (
    <AvailabilityClient
      family={family as Family}
      myMember={myMember as FamilyMember | null}
      members={(members ?? []) as FamilyMember[]}
      initialAvailability={(availability ?? []) as Availability[]}
    />
  )
}

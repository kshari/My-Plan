import { withAuth } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"
import { generateRuleBasedSuggestions } from "@/lib/family/recommend"
import { familyAppForbidden } from "@/lib/family/feature-gate"

export const POST = withAuth(async (request, { user, supabase, params }) => {
  const forbidden = await familyAppForbidden(supabase, user.id)
  if (forbidden) return forbidden
  const { familyId } = params

  const { data: member } = await supabase
    .from("fa_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!member) return NextResponse.json({ error: "Not a family member" }, { status: 403 })

  const [{ data: places }, { data: members }, { data: interests }, { data: availability }] = await Promise.all([
    supabase.from("fa_places").select("*").eq("family_id", familyId),
    supabase.from("fa_members").select("id,age_band").eq("family_id", familyId).eq("status", "active"),
    supabase.from("fa_interests").select("*").eq("family_id", familyId),
    supabase.from("fa_availability").select("*").eq("family_id", familyId),
  ])

  if (!places?.length) {
    return NextResponse.json({ message: "No places to score — add some places first", suggestions: [] })
  }

  const scored = generateRuleBasedSuggestions(
    familyId,
    user.id,
    places,
    (members ?? []) as { id: string; age_band: string }[],
    interests ?? [],
    availability ?? [],
  )

  const { data: inserted, error } = await supabase
    .from("fa_suggestions")
    .insert(scored)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ suggestions: inserted ?? [] })
})

import { withAuth, safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"
import { familyAppForbidden } from "@/lib/family/feature-gate"

export const POST = withAuth(async (request, { user, supabase, params }) => {
  const forbidden = await familyAppForbidden(supabase, user.id)
  if (forbidden) return forbidden
  const { familyId, suggestionId } = params
  const body = await safeJson<{ vote: 1 | -1 }>(request)
  if (!body || (body.vote !== 1 && body.vote !== -1)) {
    return NextResponse.json({ error: "vote must be 1 or -1" }, { status: 400 })
  }

  // Verify user is a family member
  const { data: member } = await supabase
    .from("fa_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!member) return NextResponse.json({ error: "Not a family member" }, { status: 403 })

  // Upsert vote
  const { data, error } = await supabase
    .from("fa_suggestion_votes")
    .upsert({
      suggestion_id: suggestionId,
      member_id: member.id,
      family_id: familyId,
      vote: body.vote,
    }, { onConflict: "suggestion_id,member_id" })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
})

export const DELETE = withAuth(async (request, { user, supabase, params }) => {
  const forbidden = await familyAppForbidden(supabase, user.id)
  if (forbidden) return forbidden
  const { familyId, suggestionId } = params

  const { data: member } = await supabase
    .from("fa_members")
    .select("id")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (!member) return NextResponse.json({ error: "Not a family member" }, { status: 403 })

  await supabase.from("fa_suggestion_votes")
    .delete()
    .eq("suggestion_id", suggestionId)
    .eq("member_id", member.id)

  return NextResponse.json({ ok: true })
})

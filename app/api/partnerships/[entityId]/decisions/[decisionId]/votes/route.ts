import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; decisionId: string }>
}

// POST a vote
export async function POST(request: Request, { params }: RouteParams) {
  const { entityId, decisionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { option_id, comment } = body
  if (!option_id) return NextResponse.json({ error: "option_id is required" }, { status: 400 })

  // Find the user's member record
  const { data: member } = await supabase
    .from("pt_members")
    .select("id, ownership_pct")
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (!member) return NextResponse.json({ error: "Not a member of this entity" }, { status: 403 })

  // Upsert vote (one vote per member per decision)
  const { data, error } = await supabase
    .from("pt_votes")
    .upsert(
      {
        decision_id: decisionId,
        option_id,
        member_id: member.id,
        weight: member.ownership_pct,
        comment: comment || null,
        voted_at: new Date().toISOString(),
      },
      { onConflict: "decision_id,member_id" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vote: data })
}
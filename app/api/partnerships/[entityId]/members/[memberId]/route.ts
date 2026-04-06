import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; memberId: string }>
}

// PATCH /api/partnerships/[entityId]/members/[memberId]
export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, memberId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const allowed = ["role", "status", "membership_status", "ownership_pct", "display_name", "email"]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Fetch the current record so we can detect ownership_pct changes
  const { data: current } = await supabase
    .from("pt_members")
    .select("ownership_pct")
    .eq("id", memberId)
    .eq("entity_id", entityId)
    .single()

  const { data: member, error } = await supabase
    .from("pt_members")
    .update(updates)
    .eq("id", memberId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If ownership_pct changed, record a new cap table entry to preserve the audit trail
  const newPct = "ownership_pct" in body ? Number(body.ownership_pct) : null
  const oldPct = current?.ownership_pct ?? null
  if (newPct !== null && newPct !== oldPct) {
    await supabase.from("pt_cap_table").insert({
      entity_id: entityId,
      member_id: memberId,
      ownership_pct: newPct,
      capital_contributed: 0,
      distributions_received: 0,
      effective_date: new Date().toISOString().split("T")[0],
      notes: "Ownership updated via member edit",
      recorded_by: user.id,
    })
  }

  return NextResponse.json({ member })
}

// DELETE /api/partnerships/[entityId]/members/[memberId]
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId, memberId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("pt_members")
    .update({ status: "removed", updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("entity_id", entityId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
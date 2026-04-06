import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

// GET /api/partnerships/[entityId]/members
export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_members")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data })
}

// POST /api/partnerships/[entityId]/members — add placeholder member directly
export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { display_name, email, role, ownership_pct } = body

  if (!display_name?.trim()) {
    return NextResponse.json({ error: "display_name is required" }, { status: 400 })
  }

  // Check email uniqueness within entity before inserting
  if (email?.trim()) {
    const { data: emailConflict } = await supabase
      .from("pt_members")
      .select("id, display_name")
      .eq("entity_id", entityId)
      .ilike("email", email.trim())
      .neq("status", "removed")
      .maybeSingle()

    if (emailConflict) {
      return NextResponse.json(
        {
          error: `A member with email "${email.trim()}" already exists in this entity (${emailConflict.display_name}).`,
        },
        { status: 409 }
      )
    }
  }

  const ownershipPct = Number(ownership_pct) >= 0 ? Number(ownership_pct) : 0

  const { data: member, error } = await supabase
    .from("pt_members")
    .insert({
      entity_id: entityId,
      display_name: display_name.trim(),
      email: email?.trim() || null,
      role: role ?? "member",
      ownership_pct: ownershipPct,
      status: "placeholder",
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505" && error.message.includes("email")) {
      return NextResponse.json(
        { error: "A member with this email already exists in this entity." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Auto-seed a cap table entry so the cap table reflects this ownership from day one
  if (ownershipPct > 0) {
    await supabase.from("pt_cap_table").insert({
      entity_id: entityId,
      member_id: member.id,
      ownership_pct: ownershipPct,
      capital_contributed: 0,
      distributions_received: 0,
      effective_date: new Date().toISOString().split("T")[0],
      notes: "Initial entry — auto-created when member was added",
      recorded_by: user.id,
    })
  }

  return NextResponse.json({ member }, { status: 201 })
}
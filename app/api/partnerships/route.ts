import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

// GET /api/partnerships — list entities for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_entities")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entities: data })
}

// POST /api/partnerships — create new entity
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { name, entity_type, description, state_of_formation, fiscal_year_end } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  // Create entity
  const { data: entity, error: entityError } = await supabase
    .from("pt_entities")
    .insert({
      name: name.trim(),
      entity_type: entity_type ?? "llc",
      description: description || null,
      state_of_formation: state_of_formation || null,
      fiscal_year_end: fiscal_year_end || "12/31",
      created_by: user.id,
    })
    .select()
    .single()

  if (entityError) return NextResponse.json({ error: entityError.message }, { status: 500 })

  // Add creator as admin member
  const { error: memberError } = await supabase.from("pt_members").insert({
    entity_id: entity.id,
    user_id: user.id,
    display_name: user.email?.split("@")[0] ?? "Owner",
    email: user.email,
    role: "admin",
    status: "active",
    joined_at: new Date().toISOString(),
  })

  if (memberError) {
    // Rollback entity on member creation failure
    await supabase.from("pt_entities").delete().eq("id", entity.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ entity }, { status: 201 })
}

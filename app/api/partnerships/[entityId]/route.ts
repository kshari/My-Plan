import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

// GET /api/partnerships/[entityId]
export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_entities")
    .select("*")
    .eq("id", entityId)
    .single()

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ entity: data })
}

// PATCH /api/partnerships/[entityId]
export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const allowed = ["name", "entity_type", "description", "state_of_formation", "ein",
    "formation_date", "fiscal_year_end", "status", "cash_balance", "cash_balance_as_of"]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }
  if (body.name) updates.name = body.name.trim()
  if ("cash_balance" in body) updates.cash_balance = body.cash_balance != null ? Number(body.cash_balance) : 0
  if ("cash_balance_as_of" in body) updates.cash_balance_as_of = body.cash_balance_as_of || null

  const { data, error } = await supabase
    .from("pt_entities")
    .update(updates)
    .eq("id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entity: data })
}

// DELETE /api/partnerships/[entityId]
export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase.from("pt_entities").delete().eq("id", entityId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

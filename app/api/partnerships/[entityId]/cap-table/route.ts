import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_cap_table")
    .select("*, pt_members(display_name, email)")
    .eq("entity_id", entityId)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { member_id, ownership_pct, effective_date, notes } = body

  if (!member_id || ownership_pct == null || !effective_date) {
    return NextResponse.json({ error: "member_id, ownership_pct, and effective_date are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_cap_table")
    .insert({
      entity_id: entityId,
      member_id,
      ownership_pct: Number(ownership_pct),
      effective_date,
      notes: notes || null,
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data }, { status: 201 })
}

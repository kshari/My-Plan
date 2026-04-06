import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
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
    .from("pt_capital_events")
    .select("*")
    .eq("entity_id", entityId)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { member_id, event_type, amount, effective_date, investment_id, capital_call_id, notes } = body

  if (!member_id || !event_type || amount == null || !effective_date) {
    return NextResponse.json({ error: "member_id, event_type, amount, and effective_date are required" }, { status: 400 })
  }

  const validTypes = ["contribution", "distribution", "return_of_capital", "fee", "correction"]
  if (!validTypes.includes(event_type as string)) {
    return NextResponse.json({ error: `event_type must be one of: ${validTypes.join(", ")}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_capital_events")
    .insert({
      entity_id:       entityId,
      member_id,
      event_type,
      amount:          Number(amount),
      effective_date,
      investment_id:   investment_id || null,
      capital_call_id: capital_call_id || null,
      notes:           notes?.trim() || null,
      recorded_by:     user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}
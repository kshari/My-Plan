import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; investmentId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId, investmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [investmentResult, stagesResult] = await Promise.all([
    supabase.from("pt_investments").select("*").eq("id", investmentId).eq("entity_id", entityId).single(),
    supabase.from("pt_investment_stages").select("*").eq("investment_id", investmentId).order("entered_at", { ascending: true }),
  ])

  if (!investmentResult.data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ investment: investmentResult.data, stages: stagesResult.data ?? [] })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, investmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const allowed = ["name", "investment_type", "description", "investment_manager",
    "ticker", "target_amount", "num_shares", "market_price_per_share", "current_stage",
    "status", "acquired_date", "exit_date", "exit_amount", "metadata"]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] ?? null
  }
  if ("ticker" in body) updates.ticker = body.ticker?.trim().toUpperCase() || null

  const { data, error } = await supabase
    .from("pt_investments")
    .update(updates)
    .eq("id", investmentId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ investment: data })
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId, investmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { error } = await supabase
    .from("pt_investments")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", investmentId)
    .eq("entity_id", entityId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

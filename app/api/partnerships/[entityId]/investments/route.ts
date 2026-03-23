import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { WORKFLOW_STAGES } from "@/lib/constants/partnerships"
import type { WorkflowStage } from "@/lib/types/partnerships"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_investments")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ investments: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    name, investment_type, description, investment_manager, ticker,
    target_amount, num_shares, market_price_per_share, metadata,
  } = body

  // Accept an explicit starting stage; default to 'ideation'
  const startStage: WorkflowStage =
    WORKFLOW_STAGES.includes(body.current_stage) ? body.current_stage : "ideation"

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { data: investment, error } = await supabase
    .from("pt_investments")
    .insert({
      entity_id: entityId,
      name: name.trim(),
      investment_type: investment_type ?? "other",
      description: description || null,
      investment_manager: investment_manager?.trim() || null,
      ticker: ticker?.trim().toUpperCase() || null,
      target_amount: target_amount || null,
      num_shares: num_shares != null ? Number(num_shares) : null,
      market_price_per_share: market_price_per_share != null ? Number(market_price_per_share) : null,
      current_stage: startStage,
      metadata: metadata ?? {},
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build stage history: backfill every stage before startStage as "completed",
  // then add the startStage itself as the initial entry.
  const startIndex = WORKFLOW_STAGES.indexOf(startStage)
  const stageRows = [
    ...WORKFLOW_STAGES.slice(0, startIndex).map((s) => ({
      investment_id: investment.id,
      stage: s as WorkflowStage,
      entered_by: user.id,
      notes: "Completed — recorded when investment was added",
    })),
    {
      investment_id: investment.id,
      stage: startStage,
      entered_by: user.id,
      notes: startIndex === 0
        ? "Investment created"
        : "Current stage when investment was recorded",
    },
  ]

  await supabase.from("pt_investment_stages").insert(stageRows)

  return NextResponse.json({ investment }, { status: 201 })
}

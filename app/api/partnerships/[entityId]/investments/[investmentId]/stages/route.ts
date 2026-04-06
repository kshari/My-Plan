import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"
import { WORKFLOW_STAGES } from "@/lib/constants/partnerships"
import type { WorkflowStage } from "@/lib/types/partnerships"

interface RouteParams {
  params: Promise<{ entityId: string; investmentId: string }>
}

// POST /api/partnerships/[entityId]/investments/[investmentId]/stages
// Sets the investment to the requested stage and, if jumping forward by more
// than one step, inserts completed-stage history entries for every skipped step.
export async function POST(request: Request, { params }: RouteParams) {
  const { entityId, investmentId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { stage, notes } = body

  if (!stage || !WORKFLOW_STAGES.includes(stage as WorkflowStage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 })
  }

  // Fetch current stage so we know which intermediate stages to backfill
  const { data: current, error: fetchError } = await supabase
    .from("pt_investments")
    .select("current_stage")
    .eq("id", investmentId)
    .eq("entity_id", entityId)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: "Investment not found" }, { status: 404 })
  }

  const fromIndex = WORKFLOW_STAGES.indexOf(current.current_stage as WorkflowStage)
  const toIndex = WORKFLOW_STAGES.indexOf(stage as WorkflowStage)

  // Update investment's current_stage
  const { data: investment, error: updateError } = await supabase
    .from("pt_investments")
    .update({ current_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", investmentId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Build the list of stage history rows to insert.
  // If jumping forward by more than one step, backfill each skipped stage as
  // "completed" so the history accurately reflects all stages the investment
  // passed through.
  const stageInserts: {
    investment_id: string
    stage: WorkflowStage
    entered_by: string
    notes: string | null
  }[] = []

  if (toIndex > fromIndex + 1) {
    // Intermediate stages — marked completed automatically
    for (let i = fromIndex + 1; i < toIndex; i++) {
      stageInserts.push({
        investment_id: investmentId,
        stage: WORKFLOW_STAGES[i],
        entered_by: user.id,
        notes: "Completed — recorded when setting current stage",
      })
    }
  }

  // The target stage itself carries the user-provided note
  stageInserts.push({
    investment_id: investmentId,
    stage: stage as WorkflowStage,
    entered_by: user.id,
    notes: notes?.trim() || null,
  })

  const { data: stageRecords, error: stageError } = await supabase
    .from("pt_investment_stages")
    .insert(stageInserts)
    .select()

  if (stageError) return NextResponse.json({ error: stageError.message }, { status: 500 })

  return NextResponse.json(
    { investment, stages: stageRecords, backfilled: Math.max(0, toIndex - fromIndex - 1) },
    { status: 201 }
  )
}
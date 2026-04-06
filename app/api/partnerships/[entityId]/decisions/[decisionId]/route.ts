import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; decisionId: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId, decisionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [decisionResult, optionsResult, votesResult, commentsResult] = await Promise.all([
    supabase.from("pt_decisions").select("*").eq("id", decisionId).eq("entity_id", entityId).single(),
    supabase.from("pt_decision_options").select("*").eq("decision_id", decisionId).order("sort_order"),
    supabase.from("pt_votes").select("*").eq("decision_id", decisionId),
    supabase.from("pt_decision_comments").select("*").eq("decision_id", decisionId).order("created_at"),
  ])

  if (!decisionResult.data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({
    decision: decisionResult.data,
    options: optionsResult.data ?? [],
    votes: votesResult.data ?? [],
    comments: commentsResult.data ?? [],
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, decisionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const allowed = ["status", "outcome", "deadline", "title", "description"]
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (body.status === "closed" || body.status === "approved" || body.status === "rejected") {
    updates.closed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("pt_decisions")
    .update(updates)
    .eq("id", decisionId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ decision: data })
}
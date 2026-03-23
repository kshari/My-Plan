import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const investmentId = searchParams.get("investment_id")

  let query = supabase
    .from("pt_decisions")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (investmentId) {
    query = query.eq("investment_id", investmentId)
  } else {
    query = query.is("investment_id", null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ decisions: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { title, description, decision_type, voting_method, deadline, investment_id, options } = body

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

  const { data: decision, error: decisionError } = await supabase
    .from("pt_decisions")
    .insert({
      entity_id: entityId,
      investment_id: investment_id || null,
      title: title.trim(),
      description: description || null,
      decision_type: decision_type ?? "vote",
      voting_method: voting_method ?? "simple_majority",
      deadline: deadline || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (decisionError) return NextResponse.json({ error: decisionError.message }, { status: 500 })

  // Insert options if provided (default: Approve / Reject)
  const optionList: string[] = options?.length ? options : ["Approve", "Reject", "Abstain"]
  if (decision.decision_type === "vote") {
    await supabase.from("pt_decision_options").insert(
      optionList.map((label, i) => ({
        decision_id: decision.id,
        label,
        sort_order: i,
      }))
    )
  }

  return NextResponse.json({ decision }, { status: 201 })
}

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

  const { data, error } = await supabase
    .from("pt_decision_comments")
    .select("*")
    .eq("decision_id", decisionId)
    .order("created_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId, decisionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { content } = (await safeJson<{content:string}>(request)) ?? {}
  if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 })

  const { data: member } = await supabase
    .from("pt_members")
    .select("id")
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single()

  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const { data, error } = await supabase
    .from("pt_decision_comments")
    .insert({ decision_id: decisionId, member_id: member.id, content: content.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data }, { status: 201 })
}
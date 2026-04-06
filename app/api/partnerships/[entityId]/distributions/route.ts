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
    .from("pt_distributions")
    .select("*, pt_members(display_name)")
    .eq("entity_id", entityId)
    .order("distribution_date", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ distributions: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { member_id, amount, distribution_date, type, notes, investment_id } = body

  if (!member_id || !amount || !distribution_date) {
    return NextResponse.json({ error: "member_id, amount, and distribution_date are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_distributions")
    .insert({
      entity_id: entityId,
      investment_id: investment_id || null,
      member_id,
      amount: Number(amount),
      distribution_date,
      type: type ?? "profit",
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ distribution: data }, { status: 201 })
}
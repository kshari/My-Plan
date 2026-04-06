import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
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
    .from("pt_transactions")
    .select("*")
    .eq("entity_id", entityId)
    .order("transaction_date", { ascending: false })

  if (investmentId) query = query.eq("investment_id", investmentId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { type, amount, transaction_date, description, category, investment_id } = body

  if (!type || !amount || !transaction_date) {
    return NextResponse.json({ error: "type, amount, and transaction_date are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_transactions")
    .insert({
      entity_id: entityId,
      investment_id: investment_id || null,
      type,
      amount: Number(amount),
      transaction_date,
      description: description || null,
      category: category || null,
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data }, { status: 201 })
}
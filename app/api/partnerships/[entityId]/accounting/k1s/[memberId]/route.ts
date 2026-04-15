import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string; memberId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fiscalYearId = searchParams.get("fiscal_year_id")

  let baseQuery = supabase
    .from("pt_k1_allocations")
    .select("*, member:member_id(display_name, email), fiscal_year:fiscal_year_id(label, tax_year, start_date, end_date)")
    .eq("entity_id", entityId)
    .eq("member_id", memberId)

  if (fiscalYearId) {
    const { data, error } = await baseQuery.eq("fiscal_year_id", fiscalYearId).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ k1: data })
  }

  const { data, error } = await baseQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ k1: data })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body?.fiscal_year_id) return NextResponse.json({ error: "fiscal_year_id is required" }, { status: 400 })

  // Check not already finalized
  const { data: existing } = await supabase
    .from("pt_k1_allocations")
    .select("is_final")
    .eq("entity_id", entityId)
    .eq("member_id", memberId)
    .eq("fiscal_year_id", body.fiscal_year_id)
    .single()

  if (existing?.is_final) {
    return NextResponse.json({ error: "Finalized K-1s cannot be edited" }, { status: 400 })
  }

  // Allow updating any box field or notes; finalizing sets is_final = true
  const allowedFields = [
    "box_1_ordinary_income","box_2_net_rental_re_income","box_3_other_net_rental_income",
    "box_4_guaranteed_payments_svc","box_5_guaranteed_payments_cap","box_6_net_1231_gain",
    "box_7_other_income","box_9a_lt_capital_gain","box_9b_collectibles_gain",
    "box_9c_unrec_1250_gain","box_10_net_1231_gain_28","box_11_other_income_loss",
    "box_12_section_179","box_13_other_deductions","box_15_credits","box_17_amt_items",
    "box_18_tax_exempt","box_19a_distributions_cash","box_19c_distributions_prop",
    "box_20_other_info","capital_method","notes","beginning_capital","contributions",
    "net_income_allocated","withdrawals","ending_capital",
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  if (body.is_final === true) {
    updates.is_final = true
    updates.finalized_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("pt_k1_allocations")
    .update(updates)
    .eq("entity_id", entityId)
    .eq("member_id", memberId)
    .eq("fiscal_year_id", body.fiscal_year_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ k1: data })
}

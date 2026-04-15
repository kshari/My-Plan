import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_fiscal_years")
    .select("*")
    .eq("entity_id", entityId)
    .order("tax_year", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fiscal_years: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const { label, start_date, end_date, tax_year } = body
  if (!label || !start_date || !end_date || !tax_year) {
    return NextResponse.json({ error: "label, start_date, end_date, and tax_year are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_fiscal_years")
    .insert({ entity_id: entityId, label, start_date, end_date, tax_year, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fiscal_year: data }, { status: 201 })
}

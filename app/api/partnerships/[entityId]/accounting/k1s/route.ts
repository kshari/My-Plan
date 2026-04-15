import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const fiscalYearId = searchParams.get("fiscal_year_id")

  let query = supabase
    .from("pt_k1_allocations")
    .select("*, member:member_id(display_name, email), fiscal_year:fiscal_year_id(label, tax_year)")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (fiscalYearId) query = query.eq("fiscal_year_id", fiscalYearId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ k1s: data })
}

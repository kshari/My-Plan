import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"
import { allocateIncome, buildK1 } from "@/lib/utils/partnerships/k1-calculator"

interface RouteParams { params: Promise<{ entityId: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body?.fiscal_year_id) {
    return NextResponse.json({ error: "fiscal_year_id is required" }, { status: 400 })
  }

  const { fiscal_year_id } = body

  // Load fiscal year
  const { data: fy, error: fyErr } = await supabase
    .from("pt_fiscal_years")
    .select("*")
    .eq("id", fiscal_year_id)
    .eq("entity_id", entityId)
    .single()
  if (fyErr || !fy) return NextResponse.json({ error: "Fiscal year not found" }, { status: 404 })

  // Load all data in parallel
  const [
    { data: accounts, error: acctErr },
    { data: lines, error: linesErr },
    { data: members, error: membersErr },
    { data: existingK1s },
  ] = await Promise.all([
    supabase.from("pt_accounts").select("*").eq("entity_id", entityId).eq("is_active", true),
    supabase
      .from("pt_journal_lines")
      .select("*, journal_entry:journal_entry_id(entry_date, status)")
      .eq("entity_id", entityId),
    supabase
      .from("pt_members")
      .select("id, display_name, email, ownership_pct")
      .eq("entity_id", entityId)
      .in("status", ["active", "removed"]),
    supabase
      .from("pt_k1_allocations")
      .select("*")
      .eq("entity_id", entityId)
      .eq("fiscal_year_id", fiscal_year_id),
  ])

  if (acctErr) return NextResponse.json({ error: acctErr.message }, { status: 500 })
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })
  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })

  // Compute allocations
  const allocations = allocateIncome(lines ?? [], accounts ?? [], members ?? [], fy)

  // Upsert K-1 records for each partner
  const k1Records = allocations.map(alloc => {
    const existing = existingK1s?.find(k => k.member_id === alloc.memberId)
    const k1Data = buildK1(entityId, fiscal_year_id, alloc, existing ?? undefined)
    return {
      ...k1Data,
      generated_by: user.id,
      generated_at: new Date().toISOString(),
    }
  })

  const { data: saved, error: saveErr } = await supabase
    .from("pt_k1_allocations")
    .upsert(k1Records, { onConflict: "entity_id,member_id,fiscal_year_id" })
    .select()

  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 })
  return NextResponse.json({ k1s: saved, count: saved?.length ?? 0 }, { status: 201 })
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { buildCashFlows } from "@/lib/utils/partnerships/financial-reports"

interface RouteParams { params: Promise<{ entityId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const startDate = searchParams.get("start_date") ?? `${now.getFullYear()}-01-01`
  const endDate = searchParams.get("end_date") ?? now.toISOString().split("T")[0]

  const [{ data: accounts, error: acctErr }, { data: lines, error: linesErr }] = await Promise.all([
    supabase.from("pt_accounts").select("*").eq("entity_id", entityId).eq("is_active", true),
    supabase
      .from("pt_journal_lines")
      .select("*, journal_entry:journal_entry_id(entry_date, status)")
      .eq("entity_id", entityId),
  ])

  if (acctErr) return NextResponse.json({ error: acctErr.message }, { status: 500 })
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })

  const report = buildCashFlows(lines ?? [], accounts ?? [], startDate, endDate)
  return NextResponse.json({ report })
}

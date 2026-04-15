import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const fiscalYearId = searchParams.get("fiscal_year_id")
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")

  let query = supabase
    .from("pt_journal_entries")
    .select("*, lines:pt_journal_lines(*, account:account_id(account_code, name, type))")
    .eq("entity_id", entityId)
    .order("entry_date", { ascending: false })

  if (status) query = query.eq("status", status)
  if (fiscalYearId) query = query.eq("fiscal_year_id", fiscalYearId)
  if (startDate) query = query.gte("entry_date", startDate)
  if (endDate) query = query.lte("entry_date", endDate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ journal_entries: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const { entry_date, description, fiscal_year_id, status = "draft", lines } = body
  if (!entry_date || !description) {
    return NextResponse.json({ error: "entry_date and description are required" }, { status: 400 })
  }
  if (!lines || !Array.isArray(lines) || lines.length < 2) {
    return NextResponse.json({ error: "At least 2 journal lines are required" }, { status: 400 })
  }

  // Validate balanced entry before posting
  const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
  if (status === "posted" && Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({
      error: `Entry is unbalanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
    }, { status: 400 })
  }

  // Create the header
  const { data: entry, error: entryErr } = await supabase
    .from("pt_journal_entries")
    .insert({
      entity_id: entityId,
      fiscal_year_id: fiscal_year_id || null,
      entry_date,
      description,
      status,
      entry_type: body.entry_type || "manual",
      reference_type: body.reference_type || null,
      reference_id: body.reference_id || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  // Insert lines
  const lineRecords = lines.map((l: any, idx: number) => ({
    journal_entry_id: entry.id,
    entity_id: entityId,
    account_id: l.account_id,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    memo: l.memo || null,
    line_order: idx,
  }))

  const { error: linesErr } = await supabase.from("pt_journal_lines").insert(lineRecords)
  if (linesErr) {
    // Rollback entry if lines fail
    await supabase.from("pt_journal_entries").delete().eq("id", entry.id)
    return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  const { data: full } = await supabase
    .from("pt_journal_entries")
    .select("*, lines:pt_journal_lines(*, account:account_id(account_code, name, type))")
    .eq("id", entry.id)
    .single()

  return NextResponse.json({ journal_entry: full }, { status: 201 })
}

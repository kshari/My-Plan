import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string; entryId: string }> }

export async function GET(_req: Request, { params }: RouteParams) {
  const { entityId, entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("pt_journal_entries")
    .select("*, lines:pt_journal_lines(*, account:account_id(account_code, name, type, subtype))")
    .eq("id", entryId)
    .eq("entity_id", entityId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ journal_entry: data })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  // Fetch current entry to check status
  const { data: existing } = await supabase
    .from("pt_journal_entries")
    .select("status")
    .eq("id", entryId)
    .eq("entity_id", entityId)
    .single()

  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

  // Void a posted entry (immutable otherwise)
  if (body.status === "voided") {
    const { data, error } = await supabase
      .from("pt_journal_entries")
      .update({ status: "voided", updated_at: new Date().toISOString() })
      .eq("id", entryId)
      .eq("entity_id", entityId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ journal_entry: data })
  }

  if (existing.status === "posted") {
    return NextResponse.json({ error: "Posted entries cannot be edited. Void and re-enter instead." }, { status: 400 })
  }

  // Update draft entry
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.entry_date) updates.entry_date = body.entry_date
  if (body.description) updates.description = body.description
  if (body.fiscal_year_id !== undefined) updates.fiscal_year_id = body.fiscal_year_id
  if (body.status) {
    // Validate balance before posting
    if (body.status === "posted" && body.lines) {
      const totalDebit = body.lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
      const totalCredit = body.lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return NextResponse.json({
          error: `Entry is unbalanced: debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}`,
        }, { status: 400 })
      }
    }
    updates.status = body.status
  }

  const { data: entryData, error: entryErr } = await supabase
    .from("pt_journal_entries")
    .update(updates)
    .eq("id", entryId)
    .eq("entity_id", entityId)
    .select()
    .single()
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })

  // Replace lines if provided
  if (body.lines && Array.isArray(body.lines)) {
    await supabase.from("pt_journal_lines").delete().eq("journal_entry_id", entryId)
    const lineRecords = body.lines.map((l: any, idx: number) => ({
      journal_entry_id: entryId,
      entity_id: entityId,
      account_id: l.account_id,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
      memo: l.memo || null,
      line_order: idx,
    }))
    const { error: linesErr } = await supabase.from("pt_journal_lines").insert(lineRecords)
    if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })
  }

  return NextResponse.json({ journal_entry: entryData })
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId, entryId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: existing } = await supabase
    .from("pt_journal_entries")
    .select("status")
    .eq("id", entryId)
    .eq("entity_id", entityId)
    .single()

  if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Only draft entries can be deleted" }, { status: 400 })
  }

  const { error } = await supabase.from("pt_journal_entries").delete().eq("id", entryId).eq("entity_id", entityId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

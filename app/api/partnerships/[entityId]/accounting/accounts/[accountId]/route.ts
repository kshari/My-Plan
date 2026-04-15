import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string; accountId: string }> }

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, accountId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.subtype !== undefined) updates.subtype = body.subtype
  if (body.parent_id !== undefined) updates.parent_id = body.parent_id
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { data, error } = await supabase
    .from("pt_accounts")
    .update(updates)
    .eq("id", accountId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { entityId, accountId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Prevent deletion of system accounts or accounts with journal lines
  const { data: acct } = await supabase
    .from("pt_accounts")
    .select("is_system")
    .eq("id", accountId)
    .eq("entity_id", entityId)
    .single()

  if (acct?.is_system) {
    return NextResponse.json({ error: "System accounts cannot be deleted" }, { status: 400 })
  }

  const { count } = await supabase
    .from("pt_journal_lines")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "Cannot delete an account with journal entries. Deactivate it instead." }, { status: 400 })
  }

  const { error } = await supabase
    .from("pt_accounts")
    .delete()
    .eq("id", accountId)
    .eq("entity_id", entityId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

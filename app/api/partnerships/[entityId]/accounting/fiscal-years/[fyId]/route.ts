import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams { params: Promise<{ entityId: string; fyId: string }> }

export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, fyId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (body.label !== undefined) updates.label = body.label
  if (body.is_closed !== undefined) {
    updates.is_closed = body.is_closed
    updates.closed_at = body.is_closed ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from("pt_fiscal_years")
    .update(updates)
    .eq("id", fyId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fiscal_year: data })
}

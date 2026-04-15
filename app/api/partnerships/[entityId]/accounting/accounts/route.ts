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
    .from("pt_accounts")
    .select("*, member:member_id(display_name)")
    .eq("entity_id", entityId)
    .order("account_code", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  const { account_code, name, type, subtype, parent_id, description } = body
  if (!account_code || !name || !type) {
    return NextResponse.json({ error: "account_code, name, and type are required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("pt_accounts")
    .insert({
      entity_id: entityId,
      account_code,
      name,
      type,
      subtype: subtype || null,
      parent_id: parent_id || null,
      description: description || null,
      is_system: false,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}

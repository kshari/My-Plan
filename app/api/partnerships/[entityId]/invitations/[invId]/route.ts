import { createClient } from "@/lib/supabase/server"
import { safeJson } from "@/lib/utils/route-handler"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string; invId: string }>
}

// PATCH /api/partnerships/[entityId]/invitations/[invId] — revoke
export async function PATCH(request: Request, { params }: RouteParams) {
  const { entityId, invId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await safeJson(request)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  const { status } = body // expected: "revoked"

  const { data, error } = await supabase
    .from("pt_invitations")
    .update({ status })
    .eq("id", invId)
    .eq("entity_id", entityId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invitation: data })
}
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ entityId: string }>
}

interface MemberRow {
  display_name: string
  email?: string | null
  role?: string
  ownership_pct?: number
}

// POST /api/partnerships/[entityId]/members/import — bulk-add placeholder members
export async function POST(request: Request, { params }: RouteParams) {
  const { entityId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify caller is an admin of this entity
  const { data: callerMember } = await supabase
    .from("pt_members")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", user.id)
    .single()

  if (!callerMember || callerMember.role !== "admin") {
    return NextResponse.json({ error: "Only admins can import members" }, { status: 403 })
  }

  const body = await request.json()
  const rows: MemberRow[] = body.members

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 })
  }

  const VALID_ROLES = ["admin", "member", "observer"]

  const inserts = rows
    .filter((r) => r.display_name?.trim())
    .map((r) => ({
      entity_id: entityId,
      display_name: r.display_name.trim(),
      email: r.email?.trim() || null,
      role: VALID_ROLES.includes(r.role ?? "") ? r.role : "member",
      ownership_pct: Number(r.ownership_pct) >= 0 ? Number(r.ownership_pct) : 0,
      status: "placeholder",
      invited_by: user.id,
    }))

  if (inserts.length === 0) {
    return NextResponse.json({ error: "No valid rows to import" }, { status: 400 })
  }

  // Fetch existing emails in this entity to skip duplicates
  const emailsToCheck = inserts.map((r) => r.email).filter(Boolean) as string[]
  let existingEmails = new Set<string>()
  if (emailsToCheck.length > 0) {
    const { data: existingMembers } = await supabase
      .from("pt_members")
      .select("email")
      .eq("entity_id", entityId)
      .neq("status", "removed")
      .in("email", emailsToCheck)
    existingEmails = new Set((existingMembers ?? []).map((m) => m.email?.toLowerCase()))
  }

  const deduped = inserts.filter(
    (r) => !r.email || !existingEmails.has(r.email.toLowerCase())
  )
  const skipped = inserts.length - deduped.length

  if (deduped.length === 0) {
    return NextResponse.json(
      { error: "All members already exist in this entity (email match).", skipped },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from("pt_members")
    .insert(deduped)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-seed cap table entries for members who have a non-zero ownership_pct
  const today = new Date().toISOString().split("T")[0]
  const capTableInserts = data
    .filter((m) => m.ownership_pct > 0)
    .map((m) => ({
      entity_id: entityId,
      member_id: m.id,
      ownership_pct: m.ownership_pct,
      capital_contributed: 0,
      distributions_received: 0,
      effective_date: today,
      notes: "Initial entry — auto-created during CSV import",
      recorded_by: user.id,
    }))

  if (capTableInserts.length > 0) {
    await supabase.from("pt_cap_table").insert(capTableInserts)
  }

  return NextResponse.json({ imported: data.length, skipped, members: data }, { status: 201 })
}

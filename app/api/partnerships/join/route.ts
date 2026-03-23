import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// POST /api/partnerships/join — accept invitation by token
export async function POST(request: Request) {
  // Use session client only for auth — all writes use the admin client to
  // bypass RLS (the join flow runs as an unauthenticated-to-the-entity user).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { token, display_name } = body
  if (!token) return NextResponse.json({ error: "Token is required" }, { status: 400 })
  if (!display_name?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 })
  }

  const admin = (() => {
    try {
      return createAdminClient()
    } catch (e) {
      return null
    }
  })()

  if (!admin) {
    return NextResponse.json(
      { error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    )
  }

  // Look up the invitation (admin read so we don't depend on RLS)
  const { data: invitation, error: invError } = await admin
    .from("pt_invitations")
    .select("*")
    .eq("invite_token", token)
    .eq("status", "pending")
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 })
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await admin
      .from("pt_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id)
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 })
  }

  // Check if user is already an active member
  const { data: existing } = await admin
    .from("pt_members")
    .select("id, status")
    .eq("entity_id", invitation.entity_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "Already a member", entityId: invitation.entity_id }, { status: 409 })
  }

  const confirmedEmail = user.email ?? null
  const now = new Date().toISOString()

  // Build the member payload — only include membership_status if the column
  // exists (migrations may not all be applied yet in every environment).
  const memberPayload: Record<string, unknown> = {
    user_id: user.id,
    display_name: display_name.trim(),
    email: confirmedEmail,
    status: "active",
    joined_at: now,
    updated_at: now,
  }

  // Probe whether the membership_status column exists by checking the first
  // member row; if it errors with "column not found" we skip the field.
  const { error: probeError } = await admin
    .from("pt_members")
    .select("membership_status")
    .eq("entity_id", invitation.entity_id)
    .limit(1)
  if (!probeError) {
    memberPayload.membership_status = "confirmed"
  }

  // Link user to the placeholder/invited member record, or create a new one
  if (invitation.member_id) {
    const { error: updateError } = await admin
      .from("pt_members")
      .update(memberPayload)
      .eq("id", invitation.member_id)

    if (updateError) {
      console.error("[join] member update failed:", updateError)
      return NextResponse.json(
        { error: `Failed to activate member: ${updateError.message}` },
        { status: 500 }
      )
    }
  } else {
    const { error: insertError } = await admin.from("pt_members").insert({
      entity_id: invitation.entity_id,
      role: "member",
      ...memberPayload,
    })

    if (insertError) {
      console.error("[join] member insert failed:", insertError)
      return NextResponse.json(
        { error: `Failed to create member: ${insertError.message}` },
        { status: 500 }
      )
    }
  }

  // Mark invitation as accepted
  await admin
    .from("pt_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  return NextResponse.json({ entityId: invitation.entity_id })
}

// GET /api/partnerships/join?token=... — read invitation info (public, no auth required)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

  // Try admin client first (bypasses RLS entirely), fall back to anon client
  // which relies on the "invitations_token_select USING (true)" policy.
  let db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>
  try {
    db = createAdminClient()
  } catch {
    db = await createClient()
  }

  const { data: invitation, error: invErr } = await db
    .from("pt_invitations")
    .select("id, entity_id, invite_email, status, expires_at, member_id")
    .eq("invite_token", token)
    .maybeSingle()

  if (invErr) {
    console.error("[join GET] invitation lookup error:", invErr)
    return NextResponse.json({ error: `DB error: ${invErr.message}` }, { status: 500 })
  }
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found. It may have expired or already been used." }, { status: 404 })
  }

  const { data: entity } = await db
    .from("pt_entities")
    .select("id, name, entity_type")
    .eq("id", invitation.entity_id)
    .single()

  let placeholder_name: string | null = null
  if (invitation.member_id) {
    const { data: member } = await db
      .from("pt_members")
      .select("display_name, email")
      .eq("id", invitation.member_id)
      .single()
    placeholder_name = member?.display_name ?? null
  }

  return NextResponse.json({ invitation, entity, placeholder_name })
}

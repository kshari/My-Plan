import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST /api/partnerships/join — accept invitation by token
export async function POST(request: Request) {
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

  // Look up the invitation
  const { data: invitation, error: invError } = await supabase
    .from("pt_invitations")
    .select("*")
    .eq("invite_token", token)
    .eq("status", "pending")
    .single()

  if (invError || !invitation) {
    return NextResponse.json({ error: "Invitation not found or already used" }, { status: 404 })
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await supabase
      .from("pt_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id)
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 })
  }

  // Check if user is already an active member
  const { data: existing } = await supabase
    .from("pt_members")
    .select("id, status")
    .eq("entity_id", invitation.entity_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "Already a member", entityId: invitation.entity_id }, { status: 409 })
  }

  const confirmedEmail = user.email ?? null

  // Link user to the placeholder/invited member record, or create a new one
  if (invitation.member_id) {
    await supabase
      .from("pt_members")
      .update({
        user_id: user.id,
        display_name: display_name.trim(),
        name_confirmed: true,
        email: confirmedEmail,
        status: "active",
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.member_id)
  } else {
    await supabase.from("pt_members").insert({
      entity_id: invitation.entity_id,
      user_id: user.id,
      display_name: display_name.trim(),
      name_confirmed: true,
      email: confirmedEmail,
      role: "member",
      status: "active",
      joined_at: new Date().toISOString(),
    })
  }

  // Mark invitation as accepted
  await supabase
    .from("pt_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)

  return NextResponse.json({ entityId: invitation.entity_id })
}

// GET /api/partnerships/join?token=... — read invitation info (public)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 })

  const supabase = await createClient()

  const { data: invitation } = await supabase
    .from("pt_invitations")
    .select("id, entity_id, invite_email, status, expires_at, member_id")
    .eq("invite_token", token)
    .maybeSingle()

  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Fetch entity name
  const { data: entity } = await supabase
    .from("pt_entities")
    .select("id, name, entity_type")
    .eq("id", invitation.entity_id)
    .single()

  // Fetch the placeholder member's display_name so the join page can pre-fill it
  let placeholder_name: string | null = null
  if (invitation.member_id) {
    const { data: member } = await supabase
      .from("pt_members")
      .select("display_name, email")
      .eq("id", invitation.member_id)
      .single()
    placeholder_name = member?.display_name ?? null
  }

  return NextResponse.json({ invitation, entity, placeholder_name })
}

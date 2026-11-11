import { createClient } from "@/lib/supabase/server"
import { decryptAgentCredential, encryptAgentCredential } from "@/lib/agent/encryption"
import { NextResponse } from "next/server"

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) throw new Error("Failed to refresh access token")
  const tokens = await res.json()
  return { access_token: tokens.access_token, expires_at: Date.now() + (tokens.expires_in - 60) * 1000 }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { familyId, memberId, timeMin, timeMax } = body as {
    familyId: string
    memberId: string
    timeMin?: string
    timeMax?: string
  }

  if (!familyId || !memberId) return NextResponse.json({ error: "familyId and memberId required" }, { status: 400 })

  // Verify membership
  const { data: member } = await supabase
    .from("fa_members").select("id").eq("id", memberId).eq("family_id", familyId).maybeSingle()
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 })

  // Get credentials
  const { data: cred } = await supabase
    .from("user_agent_credentials").select("encrypted_value").eq("user_id", user.id).eq("provider", "google_calendar").maybeSingle()
  if (!cred) return NextResponse.json({ error: "Google Calendar not connected. Connect from the Availability page." }, { status: 404 })

  let payload: { access_token: string; refresh_token: string; expires_at: number }
  try {
    payload = JSON.parse(decryptAgentCredential(cred.encrypted_value))
  } catch {
    return NextResponse.json({ error: "Failed to decrypt credentials" }, { status: 500 })
  }

  // Refresh token if needed
  if (payload.expires_at < Date.now()) {
    try {
      const { access_token, expires_at } = await refreshAccessToken(payload.refresh_token)
      payload.access_token = access_token
      payload.expires_at = expires_at
      await supabase.from("user_agent_credentials").update({
        encrypted_value: encryptAgentCredential(JSON.stringify(payload)),
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id).eq("provider", "google_calendar")
    } catch {
      return NextResponse.json({ error: "Token refresh failed — re-authorize Google Calendar" }, { status: 401 })
    }
  }

  // Fetch free/busy from Google Calendar
  const now = new Date()
  const start = timeMin ?? now.toISOString()
  const end = timeMax ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const fbRes = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${payload.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: start, timeMax: end, items: [{ id: "primary" }] }),
  })

  if (!fbRes.ok) return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 502 })

  const fbData = await fbRes.json()
  const busyPeriods: { start: string; end: string }[] = fbData.calendars?.primary?.busy ?? []

  // Delete existing google-synced entries for this member
  await supabase.from("fa_availability")
    .delete()
    .eq("family_id", familyId)
    .eq("member_id", memberId)
    .eq("source", "google")

  if (busyPeriods.length > 0) {
    await supabase.from("fa_availability").insert(
      busyPeriods.map((p) => ({
        family_id: familyId,
        member_id: memberId,
        source: "google",
        kind: "busy",
        start_ts: p.start,
        end_ts: p.end,
        title: "Calendar event",
      }))
    )
  }

  return NextResponse.json({ synced: busyPeriods.length, message: `Synced ${busyPeriods.length} busy periods` })
}

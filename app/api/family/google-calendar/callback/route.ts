import { createClient } from "@/lib/supabase/server"
import { encryptAgentCredential } from "@/lib/agent/encryption"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { familyAppForbidden } from "@/lib/family/feature-gate"

const TOKEN_URL = "https://oauth2.googleapis.com/token"

function htmlResponse(success: boolean, message: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "*"
  return new NextResponse(
    `<!DOCTYPE html><html><head><title>Google Calendar Auth</title></head><body>
<p>${message}</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "gcal-oauth-complete", success: ${success} }, "${siteUrl}");
    setTimeout(() => window.close(), 600);
  } else {
    setTimeout(() => { window.location.href = "/apps/family"; }, 1500);
  }
</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errorParam = url.searchParams.get("error")

  if (errorParam) return htmlResponse(false, `Google authorization failed: ${errorParam}`)
  if (!code || !state) return htmlResponse(false, "Missing code or state.")

  const cookieStore = await cookies()
  const savedState = cookieStore.get("gcal_oauth_state")?.value
  cookieStore.delete("gcal_oauth_state")

  if (!savedState || savedState !== state) return htmlResponse(false, "Invalid state.")

  const [, familyId] = state.split("|")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return htmlResponse(false, "Session expired.")
  if (await familyAppForbidden(supabase, user.id)) {
    return htmlResponse(false, "Family Activities is not enabled for your account.")
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return htmlResponse(false, "OAuth not configured.")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const redirectUri = `${siteUrl}/api/family/google-calendar/callback`

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  })

  if (!tokenRes.ok) return htmlResponse(false, "Token exchange failed.")

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens
  if (!access_token || !refresh_token) return htmlResponse(false, "Missing tokens — try again.")

  const payload = JSON.stringify({
    type: "oauth",
    access_token,
    refresh_token,
    expires_at: Date.now() + (expires_in - 60) * 1000,
    family_id: familyId,
  })

  const encrypted = encryptAgentCredential(payload)

  await supabase.from("user_agent_credentials").upsert({
    user_id: user.id,
    provider: "google_calendar",
    encrypted_value: encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" })

  return htmlResponse(true, "Google Calendar connected! This window will close.")
}

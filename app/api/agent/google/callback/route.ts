import { createClient } from '@/lib/supabase/server'
import { encryptAgentCredential } from '@/lib/agent/encryption'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

function htmlResponse(html: string, status = 200) {
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function resultPage(success: boolean, message: string) {
  const appOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
    : null
  // Use a specific origin for postMessage to prevent a malicious opener window
  // from intercepting the OAuth result. Fall back to '*' only in local dev where
  // NEXT_PUBLIC_SITE_URL is not set.
  const targetOrigin = appOrigin ?? '*'
  return htmlResponse(`<!DOCTYPE html>
<html><head><title>Google Auth</title></head>
<body>
<p>${message}</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'gemini-oauth-complete', success: ${success} }, '${targetOrigin}');
    setTimeout(() => window.close(), 600);
  }
</script>
</body></html>`)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return resultPage(false, `Google authorization failed: ${errorParam}`)
  }
  if (!code || !state) {
    return resultPage(false, 'Missing authorization code or state.')
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get('google_oauth_state')?.value
  cookieStore.delete('google_oauth_state')

  if (!savedState || savedState !== state) {
    return resultPage(false, 'Invalid state parameter. Please try again.')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return resultPage(false, 'Session expired. Please log in and try again.')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return resultPage(false, 'Google OAuth is not configured on the server.')
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectUri = `${siteUrl}/api/agent/google/callback`

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    console.error('Google token exchange failed:', err)
    return resultPage(false, 'Failed to exchange authorization code for tokens.')
  }

  const tokens = await tokenRes.json()
  const { access_token, refresh_token, expires_in } = tokens as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!access_token || !refresh_token) {
    return resultPage(false, 'Google did not return required tokens. Try disconnecting and reconnecting.')
  }

  const credentialPayload = JSON.stringify({
    type: 'oauth',
    access_token,
    refresh_token,
    expires_at: Date.now() + (expires_in - 60) * 1000,
  })

  const encrypted = encryptAgentCredential(credentialPayload)
  const now = new Date().toISOString()

  const { error } = await supabase.from('user_agent_credentials').upsert(
    {
      user_id: user.id,
      provider: 'gemini',
      encrypted_value: encrypted,
      updated_at: now,
    },
    { onConflict: 'user_id,provider' }
  )

  if (error) {
    console.error('Failed to store Google credentials:', error.message)
    return resultPage(false, 'Failed to save credentials.')
  }

  return resultPage(true, 'Google account connected! This window will close automatically.')
}

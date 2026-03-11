import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptAgentCredential, encryptAgentCredential } from './encryption'

/**
 * Server-side only: load and decrypt the user's API key for the given provider.
 * Use for providers that store a plain API key (e.g. OpenAI).
 */
export async function getDecryptedCredential(
  supabase: SupabaseClient,
  userId: string,
  provider: 'openai' | 'gemini' | 'gemini-api-key' | 'claude'
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_agent_credentials')
    .select('encrypted_value')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()
  if (error || !data?.encrypted_value) return null
  try {
    return decryptAgentCredential(data.encrypted_value)
  } catch {
    return null
  }
}

interface OAuthTokens {
  type: 'oauth'
  access_token: string
  refresh_token: string
  expires_at: number
}

/**
 * Server-side only: get a valid Gemini OAuth access token.
 * Automatically refreshes the token if expired.
 */
export async function getGeminiAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_agent_credentials')
    .select('encrypted_value')
    .eq('user_id', userId)
    .eq('provider', 'gemini')
    .maybeSingle()

  if (error || !data?.encrypted_value) return null

  let decrypted: string
  try {
    decrypted = decryptAgentCredential(data.encrypted_value)
  } catch {
    return null
  }

  let tokens: OAuthTokens
  try {
    tokens = JSON.parse(decrypted)
    if (tokens.type !== 'oauth' || !tokens.refresh_token) return null
  } catch {
    return null
  }

  if (Date.now() < tokens.expires_at) {
    return tokens.access_token
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) return null
    const refreshed = (await res.json()) as { access_token: string; expires_in: number }

    const updatedTokens: OAuthTokens = {
      type: 'oauth',
      access_token: refreshed.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (refreshed.expires_in - 60) * 1000,
    }

    const encrypted = encryptAgentCredential(JSON.stringify(updatedTokens))
    await supabase
      .from('user_agent_credentials')
      .update({ encrypted_value: encrypted, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', 'gemini')

    return refreshed.access_token
  } catch {
    return null
  }
}

/**
 * Get the user's preferred model for a Gemini provider (gemini or gemini-api-key).
 * Returns null if not set or no credential row.
 */
export async function getPreferredGeminiModel(
  supabase: SupabaseClient,
  userId: string,
  provider: 'gemini' | 'gemini-api-key'
): Promise<string | null> {
  return getPreferredModel(supabase, userId, provider)
}

/**
 * Get the user's preferred model for any provider.
 * Returns null if not set or no credential row.
 */
export async function getPreferredModel(
  supabase: SupabaseClient,
  userId: string,
  provider: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_agent_credentials')
    .select('preferred_model')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()
  if (error || !data) return null
  return typeof data.preferred_model === 'string' && data.preferred_model.length > 0
    ? data.preferred_model
    : null
}

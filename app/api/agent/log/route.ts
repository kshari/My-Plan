import { withAuth } from '@/lib/utils/route-handler'
import { NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'

const PROVIDERS = ['webllm', 'openai', 'gemini', 'gemini-api-key', 'claude'] as const
const STATUSES = ['success', 'partial', 'error'] as const

export const POST = withAuth(async (request, { user, supabase }) => {
  const botCheck = await checkBotId()
  if (botCheck.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: {
    provider?: string
    model?: string
    user_prompt?: string
    conversation_id?: string
    tool_calls_used?: boolean
    actions_requested?: string[]
    status?: string
    error_message?: string
    duration_ms?: number
    input_tokens?: number
    output_tokens?: number
    context_preview?: string
    result_summary?: string
    decisions?: string
    prompt_sent?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const provider = body.provider && PROVIDERS.includes(body.provider as (typeof PROVIDERS)[number])
    ? body.provider
    : 'webllm'
  const status = body.status && STATUSES.includes(body.status as (typeof STATUSES)[number])
    ? body.status
    : 'success'

  const { error } = await supabase.from('agent_request_logs').insert({
    user_id: user.id,
    provider,
    model: body.model ?? null,
    user_prompt: typeof body.user_prompt === 'string' ? body.user_prompt.slice(0, 10000) : null,
    conversation_id: body.conversation_id ?? null,
    tool_calls_used: Boolean(body.tool_calls_used),
    actions_requested: Array.isArray(body.actions_requested) ? body.actions_requested : [],
    status,
    error_message: body.error_message ?? null,
    duration_ms: typeof body.duration_ms === 'number' ? body.duration_ms : null,
    input_tokens: typeof body.input_tokens === 'number' ? body.input_tokens : null,
    output_tokens: typeof body.output_tokens === 'number' ? body.output_tokens : null,
    context_preview: typeof body.context_preview === 'string' ? body.context_preview.slice(0, 10000) : null,
    result_summary: typeof body.result_summary === 'string' ? body.result_summary.slice(0, 2000) : null,
    decisions: typeof body.decisions === 'string' ? body.decisions.slice(0, 5000) : null,
    prompt_sent: typeof body.prompt_sent === 'string' ? body.prompt_sent.slice(0, 10000) : null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
})

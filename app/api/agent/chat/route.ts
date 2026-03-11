import { withAuth } from '@/lib/utils/route-handler'
import { buildAgentContext } from '@/lib/agent/context-builder'
import { resolveContextScope } from '@/lib/agent/context-scope'
import { getDecryptedCredential, getGeminiAccessToken, getPreferredGeminiModel, getPreferredModel } from '@/lib/agent/credentials'
import { AGENT_TOOLS_OPENAI } from '@/lib/agent/tools'
import type { AgentAction } from '@/lib/agent/actions'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are a helpful financial assistant for the My Plan app. You help users understand and manage their data across three apps:

1. **Financial Pulse** – profile (age, income, savings, expenses, debts, subscriptions), pulse checks (net worth snapshots, mood).
2. **Retirement Planner** – plans (birth_year, life_expectancy, spouse info), accounts (401k, IRA, etc. with balances and contributions), expenses (before/after 65), other income (Social Security, pensions with start/end ages), scenarios.
3. **Property Investment** – properties (address, type, asking price, income, expenses), financial scenarios.

Rules:
- Answer questions using the exact numbers from the user's data provided below.
- When the user clearly asks to change, update, or set a value, use the appropriate tool. Each tool call will be shown to the user for confirmation before it is applied.
- Do NOT call a tool unless the user explicitly requests a change.
- Reference IDs from the context when calling tools (plan_id, account_id, expense_id, income_id, property_id).`

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

function toolCallToAction(name: string, args: Record<string, unknown>): AgentAction | null {
  switch (name) {
    case 'update_fp_profile':
      return { type: 'update_fp_profile', payload: (args.updates as Record<string, unknown>) ?? {} }
    case 'update_rp_plan':
      return {
        type: 'update_rp_plan',
        payload: { plan_id: Number(args.plan_id), ...((args.updates as Record<string, unknown>) ?? {}) },
      }
    case 'update_rp_account':
      return {
        type: 'update_rp_account',
        payload: { account_id: Number(args.account_id), ...((args.updates as Record<string, unknown>) ?? {}) },
      }
    case 'update_rp_expense':
      return {
        type: 'update_rp_expense',
        payload: { expense_id: Number(args.expense_id), ...((args.updates as Record<string, unknown>) ?? {}) },
      }
    case 'update_rp_other_income':
      return {
        type: 'update_rp_other_income',
        payload: { income_id: Number(args.income_id), ...((args.updates as Record<string, unknown>) ?? {}) },
      }
    case 'create_rp_scenario':
      return {
        type: 'create_rp_scenario',
        payload: { plan_id: Number(args.plan_id), scenario_name: String(args.scenario_name ?? 'New Scenario') },
      }
    case 'update_pi_property':
      return {
        type: 'update_pi_property',
        payload: { property_id: Number(args.property_id), ...((args.updates as Record<string, unknown>) ?? {}) },
      }
    default:
      return null
  }
}

function geminiRestFunctionDeclarations() {
  return AGENT_TOOLS_OPENAI.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: {
      type: 'OBJECT',
      properties: t.function.parameters.properties,
      required: t.function.parameters.required,
    },
  }))
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] }
    finishReason?: string
  }[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

function claudeToolDefinitions() {
  return AGENT_TOOLS_OPENAI.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: {
      type: 'object' as const,
      properties: t.function.parameters.properties,
      required: t.function.parameters.required,
    },
  }))
}

interface ClaudeContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

interface ClaudeResponse {
  content?: ClaudeContentBlock[]
  stop_reason?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export const POST = withAuth(async (request, { user, supabase }) => {
  const start = Date.now()
  let body: { message?: string; provider?: string; history?: HistoryMessage[]; currentPage?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const currentPage = typeof body.currentPage === 'string' ? body.currentPage : ''
  const providerRaw = body.provider
  const provider =
    providerRaw === 'gemini-api-key' ? 'gemini-api-key'
    : providerRaw === 'gemini' ? 'gemini'
    : providerRaw === 'claude' ? 'claude'
    : 'openai'
  const history: HistoryMessage[] = Array.isArray(body.history) ? body.history : []
  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  let apiKey: string | null = null
  let geminiAccessToken: string | null = null
  let geminiApiKey: string | null = null
  let claudeApiKey: string | null = null

  if (provider === 'openai') {
    apiKey = await getDecryptedCredential(supabase, user.id, 'openai')
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No OpenAI API key configured. Add your key in AI Settings.' },
        { status: 400 }
      )
    }
  } else if (provider === 'claude') {
    claudeApiKey = await getDecryptedCredential(supabase, user.id, 'claude')
    if (!claudeApiKey) {
      return NextResponse.json(
        { error: 'No Claude API key configured. Add your key in AI Settings.' },
        { status: 400 }
      )
    }
  } else if (provider === 'gemini-api-key') {
    geminiApiKey = await getDecryptedCredential(supabase, user.id, 'gemini-api-key')
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'No Gemini API key configured. Add your key in AI Settings.' },
        { status: 400 }
      )
    }
  } else {
    geminiAccessToken = await getGeminiAccessToken(supabase, user.id)
    if (!geminiAccessToken) {
      return NextResponse.json(
        { error: 'Google account not connected. Connect your Google account in AI Settings.' },
        { status: 400 }
      )
    }
  }

  const scope = resolveContextScope(currentPage, message)
  const context = await buildAgentContext(supabase, user.id, scope)

  const pageAwareness = scope.pageDescription
    ? `\nThe user is currently viewing: ${scope.pageDescription}\nFocus your answers on the data relevant to this page. If the user asks about other areas, you may reference that data too.`
    : ''
  const systemContent = `${SYSTEM_PROMPT}${pageAwareness}\n\n## User data (use exact numbers in answers)\n\n${context}`

  const contextPreview = context.length > 3000 ? context.slice(0, 3000) + '\n...[truncated]' : context
  const conversationBlock = history.slice(-20).map((h) => `${h.role}: ${h.content}`).join('\n\n')
  const fullPromptSent = `${systemContent}\n\n--- Conversation ---\n\n${conversationBlock}\n\nuser: ${message}`
  const promptSent = fullPromptSent.length > 10000 ? fullPromptSent.slice(0, 10000) + '\n...[truncated]' : fullPromptSent

  const decisionsBefore: string[] = [
    `provider=${provider}`,
    `auth=${provider === 'openai' || provider === 'gemini-api-key' || provider === 'claude' ? 'api_key' : 'oauth'}`,
    `page=${currentPage || '/'}`,
    `scope_domains=${scope.domains.join(',')}`,
    ...(scope.focusedPlanId ? [`focused_plan=${scope.focusedPlanId}`] : []),
    ...(scope.focusedPropertyId ? [`focused_property=${scope.focusedPropertyId}`] : []),
    `page_description=${scope.pageDescription}`,
    `context_length=${context.length}`,
  ]

  let reply = ''
  let modelUsed = ''
  let toolCallsUsed = false
  const pendingActions: { type: string; payload: Record<string, unknown>; description: string }[] = []
  let status: 'success' | 'partial' | 'error' = 'success'
  let errorMessage: string | null = null
  let inputTokens: number | null = null
  let outputTokens: number | null = null

  try {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: apiKey! })
      modelUsed = 'gpt-4o-mini'
      const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemContent },
        ...history.slice(-20).map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user', content: message },
      ]
      const completion = await openai.chat.completions.create({
        model: modelUsed,
        messages: msgs,
        tools: AGENT_TOOLS_OPENAI,
        tool_choice: 'auto',
      })
      const choice = completion.choices?.[0]
      if (completion.usage) {
        inputTokens = completion.usage.prompt_tokens ?? null
        outputTokens = completion.usage.completion_tokens ?? null
      }
      if (!choice) {
        errorMessage = 'No completion choice'
        status = 'error'
      } else if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        toolCallsUsed = true
        for (const tc of choice.message.tool_calls) {
          const fn = 'function' in tc ? tc.function : null
          if (!fn) continue
          const args = (typeof fn.arguments === 'string'
            ? (() => { try { return JSON.parse(fn.arguments) as Record<string, unknown> } catch { return {} } })()
            : {}) as Record<string, unknown>
          const action = toolCallToAction(fn.name, args)
          if (action) {
            pendingActions.push({
              type: action.type,
              payload: action.payload,
              description: `${fn.name}(${JSON.stringify(args)})`,
            })
          }
        }
        reply = choice.message.content ?? 'I\'d like to make the following changes. Please confirm.'
      } else {
        reply = choice.message?.content ?? ''
      }
    } else if (provider === 'claude') {
      const preferredClaudeModel = await getPreferredModel(supabase, user.id, 'claude')
      modelUsed = preferredClaudeModel ?? 'claude-sonnet-4-20250514'

      const claudeMsgs = [
        ...history.slice(-20).map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
        })),
        { role: 'user' as const, content: message },
      ]

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: modelUsed,
          max_tokens: 4096,
          system: systemContent,
          messages: claudeMsgs,
          tools: claudeToolDefinitions(),
        }),
      })

      if (!claudeRes.ok) {
        const errBody = await claudeRes.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(errBody.error?.message || `Claude API error (${claudeRes.status})`)
      }

      const claudeData = (await claudeRes.json()) as ClaudeResponse
      const blocks = claudeData.content ?? []

      let textReply = ''
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          textReply += block.text
        } else if (block.type === 'tool_use' && block.name) {
          toolCallsUsed = true
          const args = (block.input ?? {}) as Record<string, unknown>
          const action = toolCallToAction(block.name, args)
          if (action) {
            pendingActions.push({
              type: action.type,
              payload: action.payload,
              description: `${block.name}(${JSON.stringify(args)})`,
            })
          }
        }
      }

      if (pendingActions.length && !textReply) {
        reply = 'I\'d like to make the following changes. Please confirm.'
      } else {
        reply = textReply
      }

      if (claudeData.usage) {
        inputTokens = claudeData.usage.input_tokens ?? null
        outputTokens = claudeData.usage.output_tokens ?? null
      }
    } else {
      const preferredModel = await getPreferredGeminiModel(supabase, user.id, provider === 'gemini-api-key' ? 'gemini-api-key' : 'gemini')
      modelUsed = preferredModel ?? 'gemini-2.0-flash'
      const geminiContents = [
        ...history.slice(-20).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ]

      const useApiKey = provider === 'gemini-api-key'
      const url = useApiKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent?key=${encodeURIComponent(geminiApiKey!)}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent`

      const geminiHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (!useApiKey) {
        geminiHeaders.Authorization = `Bearer ${geminiAccessToken!}`
        const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
        const projectNumber = clientId.includes('-') ? clientId.split('-')[0] : ''
        if (projectNumber) geminiHeaders['x-goog-user-project'] = projectNumber
      }

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: geminiHeaders,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemContent }] },
          contents: geminiContents,
          tools: [{ functionDeclarations: geminiRestFunctionDeclarations() }],
        }),
      })

      if (!geminiRes.ok) {
        const errBody = await geminiRes.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(errBody.error?.message || `Gemini API error (${geminiRes.status})`)
      }

      const geminiData = (await geminiRes.json()) as GeminiResponse
      const candidate = geminiData.candidates?.[0]
      const parts = candidate?.content?.parts ?? []

      let textReply = ''
      const fnCalls: { name: string; args: Record<string, unknown> }[] = []
      for (const part of parts) {
        if (part.text) textReply += part.text
        if (part.functionCall) fnCalls.push(part.functionCall)
      }

      if (fnCalls.length) {
        toolCallsUsed = true
        for (const fc of fnCalls) {
          const args = fc.args ?? {}
          const action = toolCallToAction(fc.name, args)
          if (action) {
            pendingActions.push({
              type: action.type,
              payload: action.payload,
              description: `${fc.name}(${JSON.stringify(args)})`,
            })
          }
        }
        reply = textReply || 'I\'d like to make the following changes. Please confirm.'
      } else {
        reply = textReply
      }

      const usage = geminiData.usageMetadata
      if (usage) {
        inputTokens = usage.promptTokenCount ?? null
        outputTokens = usage.candidatesTokenCount ?? null
      }
    }
  } catch (e: unknown) {
    status = 'error'
    errorMessage = e instanceof Error ? e.message : 'Unknown error'
    reply = `Sorry, something went wrong: ${errorMessage}`
  }

  const durationMs = Date.now() - start
  const actionsRequested = pendingActions.map((a) => a.type)

  decisionsBefore.push(`model=${modelUsed}`)
  const decisionsAfter: string[] = []
  if (status === 'error') {
    decisionsAfter.push(`outcome=error: ${errorMessage ?? 'unknown'}`)
  } else {
    decisionsAfter.push(`reply_length=${reply.length}`)
    if (pendingActions.length) decisionsAfter.push(`pending_actions=${pendingActions.length}`)
  }
  const resultSummary = status === 'error'
    ? `error: ${(errorMessage ?? 'unknown').slice(0, 500)}`
    : `reply: ${reply.length} chars${pendingActions.length ? `, ${pendingActions.length} pending action(s)` : ''}`

  await supabase.from('agent_request_logs').insert({
    user_id: user.id,
    provider,
    model: modelUsed,
    user_prompt: message.slice(0, 10000),
    tool_calls_used: toolCallsUsed,
    actions_requested: actionsRequested,
    status,
    error_message: errorMessage,
    duration_ms: durationMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    context_preview: contextPreview,
    result_summary: resultSummary,
    decisions: [...decisionsBefore, ...decisionsAfter].join('\n'),
    prompt_sent: promptSent,
  })

  return NextResponse.json({
    reply,
    pendingActions: pendingActions.length > 0 ? pendingActions : undefined,
  })
})

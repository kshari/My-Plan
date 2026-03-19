import { withAuth } from '@/lib/utils/route-handler'
import { buildAgentContext } from '@/lib/agent/context-builder'
import { resolveContextScope } from '@/lib/agent/context-scope'
import { getDecryptedCredential, getGeminiAccessToken, getPreferredGeminiModel, getPreferredModel } from '@/lib/agent/credentials'
import { AGENT_TOOLS_OPENAI, TOOL_CATEGORIES } from '@/lib/agent/tools'
import type { AgentAction } from '@/lib/agent/actions'
import { executeReadOrCalcTool } from '@/lib/agent/tool-executor'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { checkBotId } from 'botid/server'

const SYSTEM_PROMPT = `You are a helpful financial assistant for the My Plan app. You help users understand and manage their data across three apps:

1. **Financial Pulse** – profile (age, income, savings, expenses, debts, subscriptions), pulse checks (net worth snapshots, mood).
2. **Retirement Planner** – plans (birth_year, life_expectancy, spouse info), accounts (401k, IRA, etc. with balances and contributions), expenses (before/after 65), other income (Social Security, pensions with start/end ages), scenarios.
3. **Property Investment** – properties (address, type, asking price, income, expenses), financial scenarios.

## Tools

You have access to tools in three categories:

**Read tools** – fetch additional data from the database. Use when the user asks about data that may not be fully in the context (e.g. full pulse check history, detailed projection rows, all property scenarios).

**Calculation tools** – run the app's financial engines. ALWAYS use these instead of doing math yourself when the user asks for:
- Future value projections → calculate_future_value
- Retirement readiness, "will I run out of money", income in retirement → calculate_retirement_projection
- Retirement risk, probability of success, worst-case scenarios → run_monte_carlo
- Property cap rate, ROI, cash-on-cash, investment score → calculate_property_metrics
- Tax estimates, effective/marginal rate → calculate_tax_estimate
- Debt payoff timelines, avalanche vs snowball → calculate_debt_payoff

**Mutation tools** – update user data. Only call these when the user explicitly asks to change, update, set, or modify a value. The user will be shown a confirmation dialog before any change is applied.

## Rules

- Answer using exact numbers from context or tool results.
- When calculations are needed, call the appropriate tool and use its result in your answer. Do NOT compute these by hand.
- Only call mutation tools when the user explicitly requests a change.
- Reference IDs from the context when calling tools (plan_id, account_id, expense_id, income_id, property_id).
- Be concise and specific. If data is missing or insufficient, say so and suggest what the user should add.`

const MAX_TOOL_ITERATIONS = 5

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

function parseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

function geminiRestFunctionDeclarations() {
  return AGENT_TOOLS_OPENAI.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: {
      type: 'OBJECT',
      properties: t.function.parameters.properties,
      required: (t.function.parameters as { required?: string[] }).required ?? [],
    },
  }))
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
  functionResponse?: { name: string; response: { content: unknown } }
}

interface GeminiContent {
  role: string
  parts: GeminiPart[]
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
      required: (t.function.parameters as { required?: string[] }).required ?? [],
    },
  }))
}

interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
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
  const botCheck = await checkBotId()
  if (botCheck.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

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
    if (!apiKey) return NextResponse.json({ error: 'No OpenAI API key configured. Add your key in AI Settings.' }, { status: 400 })
  } else if (provider === 'claude') {
    claudeApiKey = await getDecryptedCredential(supabase, user.id, 'claude')
    if (!claudeApiKey) return NextResponse.json({ error: 'No Claude API key configured. Add your key in AI Settings.' }, { status: 400 })
  } else if (provider === 'gemini-api-key') {
    geminiApiKey = await getDecryptedCredential(supabase, user.id, 'gemini-api-key')
    if (!geminiApiKey) return NextResponse.json({ error: 'No Gemini API key configured. Add your key in AI Settings.' }, { status: 400 })
  } else {
    geminiAccessToken = await getGeminiAccessToken(supabase, user.id)
    if (!geminiAccessToken) return NextResponse.json({ error: 'Google account not connected. Connect your Google account in AI Settings.' }, { status: 400 })
  }

  const scope = resolveContextScope(currentPage, message)
  const context = await buildAgentContext(supabase, user.id, scope)

  const pageAwareness = scope.pageDescription
    ? `\nThe user is currently viewing: ${scope.pageDescription}\nFocus your answers on the data relevant to this page.`
    : ''
  const systemContent = `${SYSTEM_PROMPT}${pageAwareness}\n\n## User data (use exact numbers in answers)\n\n${context}`

  const contextPreview = context.length > 3000 ? context.slice(0, 3000) + '\n...[truncated]' : context
  const conversationBlock = history.slice(-20).map((h) => `${h.role}: ${h.content}`).join('\n\n')
  const fullPromptSent = `${systemContent}\n\n--- Conversation ---\n\n${conversationBlock}\n\nuser: ${message}`
  const promptSent = fullPromptSent.length > 10000 ? fullPromptSent.slice(0, 10000) + '\n...[truncated]' : fullPromptSent

  const decisionsBefore: string[] = [
    `provider=${provider}`,
    `page=${currentPage || '/'}`,
    `scope_domains=${scope.domains.join(',')}`,
    ...(scope.focusedPlanId ? [`focused_plan=${scope.focusedPlanId}`] : []),
    ...(scope.focusedPropertyId ? [`focused_property=${scope.focusedPropertyId}`] : []),
    `context_length=${context.length}`,
  ]

  let reply = ''
  let modelUsed = ''
  let toolCallsUsed = false
  let toolCallCount = 0
  const pendingActions: { type: string; payload: Record<string, unknown>; description: string }[] = []
  let status: 'success' | 'partial' | 'error' = 'success'
  let errorMessage: string | null = null
  let inputTokens: number | null = null
  let outputTokens: number | null = null

  try {
    // ── OpenAI ──────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: apiKey! })
      modelUsed = 'gpt-4o-mini'

      const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemContent },
        ...history.slice(-20).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message },
      ]

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        const completion = await openai.chat.completions.create({
          model: modelUsed,
          messages: msgs,
          tools: AGENT_TOOLS_OPENAI,
          tool_choice: 'auto',
        })

        if (completion.usage) {
          inputTokens = (inputTokens ?? 0) + (completion.usage.prompt_tokens ?? 0)
          outputTokens = (outputTokens ?? 0) + (completion.usage.completion_tokens ?? 0)
        }

        const choice = completion.choices?.[0]
        if (!choice) { errorMessage = 'No completion choice'; status = 'error'; break }

        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
          toolCallsUsed = true
          msgs.push(choice.message)

          const toolResults: OpenAI.Chat.ChatCompletionToolMessageParam[] = []
          let hasMutate = false

          for (const tc of choice.message.tool_calls) {
            const fn = 'function' in tc ? tc.function : null
            if (!fn) continue
            toolCallCount++

            const args = parseArgs(fn.arguments)
            const category = TOOL_CATEGORIES[fn.name]

            if (category === 'mutate') {
              hasMutate = true
              const action = toolCallToAction(fn.name, args)
              if (action) {
                pendingActions.push({ type: action.type, payload: action.payload, description: `${fn.name}(${JSON.stringify(args)})` })
              }
              // Feed a placeholder result back so the message array stays valid
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ queued: true }) })
            } else {
              // read / calculate — execute immediately
              const result = await executeReadOrCalcTool(fn.name, args, supabase, user.id)
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
            }
          }

          msgs.push(...toolResults)

          if (hasMutate) {
            // Get a summarising reply from the model for the mutations
            const finalCompletion = await openai.chat.completions.create({
              model: modelUsed,
              messages: msgs,
              tools: AGENT_TOOLS_OPENAI,
              tool_choice: 'none',
            })
            reply = finalCompletion.choices?.[0]?.message?.content ?? 'I\'d like to make the following changes. Please confirm.'
            break
          }
          // Continue loop for read/calc results
        } else {
          reply = choice.message?.content ?? ''
          break
        }
      }

    // ── Claude ───────────────────────────────────────────────────────────────
    } else if (provider === 'claude') {
      const preferredModel = await getPreferredModel(supabase, user.id, 'claude')
      modelUsed = preferredModel ?? 'claude-sonnet-4-20250514'

      type ClaudeMsgParam = { role: 'user' | 'assistant'; content: string | ClaudeContentBlock[] }
      const claudeMsgs: ClaudeMsgParam[] = [
        ...history.slice(-20).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message },
      ]

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': claudeApiKey!, 'anthropic-version': '2023-06-01' },
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
        if (claudeData.usage) {
          inputTokens = (inputTokens ?? 0) + (claudeData.usage.input_tokens ?? 0)
          outputTokens = (outputTokens ?? 0) + (claudeData.usage.output_tokens ?? 0)
        }

        const blocks = claudeData.content ?? []
        const textBlocks = blocks.filter((b) => b.type === 'text')
        const toolUseBlocks = blocks.filter((b) => b.type === 'tool_use')

        if (toolUseBlocks.length > 0) {
          toolCallsUsed = true
          claudeMsgs.push({ role: 'assistant', content: blocks })

          const toolResults: ClaudeContentBlock[] = []
          let hasMutate = false

          for (const block of toolUseBlocks) {
            if (!block.name) continue
            toolCallCount++
            const args = (block.input ?? {}) as Record<string, unknown>
            const category = TOOL_CATEGORIES[block.name]

            if (category === 'mutate') {
              hasMutate = true
              const action = toolCallToAction(block.name, args)
              if (action) {
                pendingActions.push({ type: action.type, payload: action.payload, description: `${block.name}(${JSON.stringify(args)})` })
              }
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ queued: true }) })
            } else {
              const result = await executeReadOrCalcTool(block.name, args, supabase, user.id)
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
            }
          }

          claudeMsgs.push({ role: 'user', content: toolResults })

          if (hasMutate) {
            // Ask Claude to summarise the pending mutations
            const summaryRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': claudeApiKey!, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({
                model: modelUsed,
                max_tokens: 1024,
                system: systemContent,
                messages: claudeMsgs,
              }),
            })
            if (summaryRes.ok) {
              const summaryData = (await summaryRes.json()) as ClaudeResponse
              const summaryText = summaryData.content?.find((b) => b.type === 'text')?.text ?? ''
              reply = summaryText || 'I\'d like to make the following changes. Please confirm.'
            } else {
              reply = textBlocks.map((b) => b.text ?? '').join('') || 'I\'d like to make the following changes. Please confirm.'
            }
            break
          }
        } else {
          reply = textBlocks.map((b) => b.text ?? '').join('')
          break
        }
      }

    // ── Gemini ────────────────────────────────────────────────────────────────
    } else {
      const preferredModel = await getPreferredGeminiModel(supabase, user.id, provider === 'gemini-api-key' ? 'gemini-api-key' : 'gemini')
      modelUsed = preferredModel ?? 'gemini-2.0-flash'

      const useApiKey = provider === 'gemini-api-key'
      const urlBase = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent`
      const url = useApiKey ? `${urlBase}?key=${encodeURIComponent(geminiApiKey!)}` : urlBase

      const geminiHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!useApiKey) {
        geminiHeaders.Authorization = `Bearer ${geminiAccessToken!}`
        const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
        const projectNumber = clientId.includes('-') ? clientId.split('-')[0] : ''
        if (projectNumber) geminiHeaders['x-goog-user-project'] = projectNumber
      }

      const geminiContents: GeminiContent[] = [
        ...history.slice(-20).map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ]

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
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
        const usage = geminiData.usageMetadata
        if (usage) {
          inputTokens = (inputTokens ?? 0) + (usage.promptTokenCount ?? 0)
          outputTokens = (outputTokens ?? 0) + (usage.candidatesTokenCount ?? 0)
        }

        const candidate = geminiData.candidates?.[0]
        const parts = candidate?.content?.parts ?? []
        const textParts = parts.filter((p) => p.text)
        const fnCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!)

        if (fnCalls.length > 0) {
          toolCallsUsed = true
          // Append model turn
          geminiContents.push({ role: 'model', parts })

          const toolResultParts: GeminiPart[] = []
          let hasMutate = false

          for (const fc of fnCalls) {
            toolCallCount++
            const args = fc.args ?? {}
            const category = TOOL_CATEGORIES[fc.name]

            if (category === 'mutate') {
              hasMutate = true
              const action = toolCallToAction(fc.name, args)
              if (action) {
                pendingActions.push({ type: action.type, payload: action.payload, description: `${fc.name}(${JSON.stringify(args)})` })
              }
              toolResultParts.push({ functionResponse: { name: fc.name, response: { content: { queued: true } } } })
            } else {
              const result = await executeReadOrCalcTool(fc.name, args, supabase, user.id)
              toolResultParts.push({ functionResponse: { name: fc.name, response: { content: result } } })
            }
          }

          geminiContents.push({ role: 'user', parts: toolResultParts })

          if (hasMutate) {
            reply = textParts.map((p) => p.text ?? '').join('') || 'I\'d like to make the following changes. Please confirm.'
            break
          }
        } else {
          reply = textParts.map((p) => p.text ?? '').join('')
          break
        }
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
  const decisionsAfter: string[] = [`tool_iterations=${toolCallCount}`]
  if (status === 'error') {
    decisionsAfter.push(`outcome=error: ${errorMessage ?? 'unknown'}`)
  } else {
    decisionsAfter.push(`reply_length=${reply.length}`)
    if (pendingActions.length) decisionsAfter.push(`pending_actions=${pendingActions.length}`)
  }
  const resultSummary = status === 'error'
    ? `error: ${(errorMessage ?? 'unknown').slice(0, 500)}`
    : `reply: ${reply.length} chars${pendingActions.length ? `, ${pendingActions.length} pending action(s)` : ''}${toolCallCount > 0 ? `, ${toolCallCount} tool call(s)` : ''}`

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

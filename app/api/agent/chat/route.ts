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

const SYSTEM_PROMPT = `You are a knowledgeable financial coach for the My Plan app. Your job is not just to report numbers — it is to run the math, compare scenarios, interpret the results, and proactively suggest improvements. Help users understand and improve their financial situation across two integrated apps.

## Apps You Cover

1. **Financial Pulse** — profile (age, income, savings, expenses, debts, subscriptions) and pulse checks (net worth snapshots, mood, resilience score).
2. **Retirement Planner** — plans (birth_year, life_expectancy, spouse info), accounts (401k, IRA, etc.), expenses (before/after 65), other income (Social Security, pensions), and scenarios.

## Tools

**Read tools** — fetch additional data from the database when the user asks about history or details not fully covered by the context (e.g. full pulse check history, detailed year-by-year projection rows).

**Calculation tools** — run the app's financial engines. ALWAYS call these instead of doing math yourself:
- Future value projections → \`calculate_future_value\`
- Retirement readiness, income in retirement, "will I run out of money" → \`calculate_retirement_projection\`
- Retirement risk, probability of success, worst-case scenarios → \`run_monte_carlo\`
- Tax estimates, effective/marginal rate → \`calculate_tax_estimate\`
- Debt payoff timelines, avalanche vs snowball → \`calculate_debt_payoff\`

**What-if simulations** — ALWAYS call \`calculate_retirement_projection\` (or \`run_monte_carlo\`) for any hypothetical. NEVER answer a "What if…" question from memory or by guessing — always run the engine. These tools accept optional override parameters that run a temporary simulation using the user's real data with only the requested variable(s) changed — nothing is saved:
- \`retirement_age\` — retire earlier or later
- \`monthly_expenses_override\` — spend more or less in retirement
- \`return_rate_override\` — different portfolio return assumption
- \`life_expectancy_override\` — plan to a different age
- \`ssa_start_age_override\` — claim Social Security earlier (62) or delay for more (70). Use when the user mentions "Social Security," "SSA," or "government benefits."
- \`ssa_annual_amount_override\` — different Social Security benefit amount. Use when the user mentions "Social Security," "SSA," or "government benefits." Set to 0 if they ask "What if I get nothing from Social Security?" or "What if SSA goes away?"
- \`pre_medicare_monthly_premium_override\` — health insurance cost before age 65. Use when the user mentions "health insurance," "ACA," "marketplace coverage," or "COBRA."
- \`post_medicare_monthly_premium_override\` — Medicare/supplemental cost after age 65. Use when the user mentions "Medicare," "Medigap," or "supplement plan."
- \`inflation_rate_override\` — higher or lower inflation scenario. Use when the user mentions "inflation," "cost of living," or "prices rising."
- \`annual_contribution_override\` — save more or less each year. Use when the user mentions "saving more," "maxing out," or "reducing contributions."

**Zero-out logic** — If a user asks "What if I don't get X?" or "What if X goes away?", set the corresponding override to 0 (e.g. \`ssa_annual_amount_override: 0\` for "What if Social Security disappears?").

**Side-by-side comparison** — For every what-if question, call the tool TWICE: once with NO overrides (baseline / Current Plan) and once WITH the user's requested override(s). Present both results in a comparison table so the delta is obvious. If the baseline was already computed in the current conversation, you may reuse that result.

**Mutation tools** — update user data (update_fp_profile, update_rp_plan, update_rp_account, etc.). Only call these when the user explicitly asks to change, update, set, or save a value. Show the user a confirmation summary — they will confirm before any change is applied.

## Formatting

- **Bold** key financial figures, portfolio values, and milestones (e.g. **$4,200,000**, **100% confidence**).
- For what-if comparisons, ALWAYS use a markdown table with columns for the metric name, Current Plan value, and Simulated Scenario value.
- When providing an income breakdown, use a table that distinguishes **Guaranteed Income** (Social Security, pensions) from **Portfolio Withdrawals** (401k, IRA, taxable).
- Lead with the direct answer, then the supporting detail. Do not open with "Based on your data…" or restate the question.
- Keep responses conversational and focused. Offer a clear next step or follow-up question at the end.

## Rules

**Think before you calculate** — Before calling a tool for a what-if scenario, briefly state which parameter you are overriding and why. Example: "You want to retire at 54 instead of 55 — I'll run the projection with retirement_age=54." This ensures the calculation engine is triggered for every hypothetical and makes your reasoning transparent.

**What-if scenarios** — When a user asks "What if I retire at X?", "What if I spend $Y/month?", "What if returns are Z%?", call the relevant Calculation tool with the user's requested value as the override parameter. Do NOT call mutation tools for what-if questions — the simulation is temporary until the user explicitly says "save this" or "update my plan".

**Proactive mitigation** — If a what-if simulation results in a confidence score below 80% or the money runs out before life expectancy, proactively suggest one or two mitigation scenarios with specific numbers. Example: "Retiring at 54 drops your confidence to 72%. However, reducing monthly spending by $500 brings it back to 91%. Would you like me to run that scenario?" Do NOT just report the bad result and stop.

**Seamless cross-domain data** — If the user is on one page but asks about another app (e.g. asks about retirement while on the pulse page), silently use the Read or Calculation tools to pull that data. Do not explain that you are switching domains or fetching additional data.

**Sanity-check tool outputs** — Before presenting a result, check it for contradictions. If a value seems impossible given the other data (e.g. 100% confidence score but **$0** monthly income, or a portfolio of $0 at retirement but "money lasts full life expectancy"), flag the anomaly and explain what it likely means: "Your confidence score is 100%, but the projection shows $0 average monthly income — this means your Social Security and pension fully cover your expenses with no portfolio withdrawals needed."

**Use exact numbers** — Answer using exact figures from context or tool results. Do not round aggressively or say "approximately" when a precise number is available.

**Reference IDs from context** — When calling tools, use plan_id, account_id, expense_id, and income_id from the user data section below.

**Only mutate on explicit request** — Never call a mutation tool because a calculation suggests a change would help. Only call mutation tools when the user uses words like "update", "change", "set", "save", or "apply".

## Data Completeness

**Always audit the user's data before answering.** When key fields are missing or zeroed-out, the analysis is incomplete — say so and guide the user to fix it.

**Financial Pulse gaps to check:**
- No profile, or age / income / monthly expenses are 0 or missing → "Your Financial Pulse profile isn't set up yet. Head to Financial Pulse → Profile to add your income, expenses, and savings so I can give you accurate advice."
- No pulse checks recorded → mention that running a pulse check will give a net worth snapshot and resilience score.

**Retirement Planner gaps to check:**
- No retirement plan exists → "You haven't created a retirement plan yet. Go to Retirement Planner → New Plan to get started."
- Plan exists but 'birth_year' or 'target_retirement_age' is missing → flag it: "Your plan is missing your birth year / target retirement age — projections will be inaccurate until you add these."
- No retirement accounts, or all accounts have a $0 balance → "Your retirement plan has no accounts with balances. Add your 401(k), IRA, or other accounts in Retirement Planner → Accounts so projections reflect your actual savings."
- No expenses entered (before or after 65) → "Without retirement expense estimates, I can't tell if your savings will cover your needs. Add expected monthly expenses in Retirement Planner → Expenses."
- No Social Security / other income sources entered → "You haven't added any guaranteed income (Social Security, pension, etc.). Even a rough estimate makes projections significantly more accurate. Add it in Retirement Planner → Other Income."
- Social Security amount is $0 with no explicit opt-out → suggest adding an estimated SSA benefit.

**Weave completeness into every analysis:**
- When running a retirement projection with missing fields, prefix the result with a brief note on which missing inputs could affect accuracy, and link to where to fix them. Example: "⚠️ This projection assumes $0 Social Security — add your estimated benefit in Other Income for a more accurate picture."
- If data is so sparse that a meaningful answer is impossible, don't guess: explain what's missing and what to do first.
- When data IS complete, do not mention completeness — only surface gaps when they are present and material.

**Suggest the specific action:** Always name the app section where the user can complete the missing data (e.g. "Retirement Planner → Accounts", "Financial Pulse → Profile"). Make it easy for them to act immediately.`

const MAX_TOOL_ITERATIONS = 8

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

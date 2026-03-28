import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAdmin } from '@/lib/utils/auth'
import { NextResponse } from 'next/server'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

async function countRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  since?: string,
) {
  let q = admin.from(table).select('id', { count: 'exact', head: true })
  if (since) q = q.gte('created_at', since)
  const { count } = await q
  return count ?? 0
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { isAdmin } = await checkAdmin(supabase, user.id)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const now7 = daysAgo(7)
  const now30 = daysAgo(30)

  // --- 1. User growth (auth.users via admin API) ---
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 })
  const totalUsers = allUsers.length
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  let newThisWeek = 0
  let newThisMonth = 0
  let activeToday = 0
  let activeThisWeek = 0
  let activeThisMonth = 0

  for (const u of allUsers) {
    const created = u.created_at ? new Date(u.created_at).getTime() : 0
    const lastSign = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0
    const now7t = new Date(now7).getTime()
    const now30t = new Date(now30).getTime()
    const todayT = new Date(todayStart).getTime()

    if (created >= now7t) newThisWeek++
    if (created >= now30t) newThisMonth++
    if (lastSign >= todayT) activeToday++
    if (lastSign >= now7t) activeThisWeek++
    if (lastSign >= now30t) activeThisMonth++
  }

  // --- 2. App adoption ---

  // Financial Pulse
  const fpProfiles = await countRows(admin, 'fp_profiles')
  const fpPulseChecks = await countRows(admin, 'fp_pulse_checks')
  const fpPulseChecks7d = await countRows(admin, 'fp_pulse_checks', now7)
  const fpPulseChecks30d = await countRows(admin, 'fp_pulse_checks', now30)
  const fpScenarios = await countRows(admin, 'fp_saved_scenarios')

  // Retirement Planner
  const rpPlans = await countRows(admin, 'rp_retirement_plans')
  const rpAccounts = await countRows(admin, 'rp_accounts')
  const rpScenarios = await countRows(admin, 'rp_scenarios')

  // Property Investment
  const piProperties = await countRows(admin, 'pi_properties')
  const piImportLoads = await countRows(admin, 'pi_import_loads')

  // Partnerships
  const ptEntities = await countRows(admin, 'pt_entities')
  const ptMembers = await countRows(admin, 'pt_members')
  const ptInvestments = await countRows(admin, 'pt_investments')
  const ptDecisions = await countRows(admin, 'pt_decisions')

  // --- 3. AI Assistant usage (agent_request_logs — admin RLS allows SELECT) ---
  const aiTotal = await countRows(admin, 'agent_request_logs')
  const ai7d = await countRows(admin, 'agent_request_logs', now7)
  const ai30d = await countRows(admin, 'agent_request_logs', now30)

  // Error count
  const { count: aiErrors } = await admin
    .from('agent_request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'error')
  const errorCount = aiErrors ?? 0

  // Provider breakdown
  const { data: providerRows } = await admin
    .from('agent_request_logs')
    .select('provider')
  const providerCounts: Record<string, number> = {}
  for (const r of providerRows ?? []) {
    const p = r.provider || 'unknown'
    providerCounts[p] = (providerCounts[p] || 0) + 1
  }

  // Avg latency and tokens
  const { data: perfRows } = await admin
    .from('agent_request_logs')
    .select('duration_ms, input_tokens, output_tokens')
    .not('duration_ms', 'is', null)
    .limit(5000)
    .order('created_at', { ascending: false })

  let avgLatency = 0
  let avgInputTokens = 0
  let avgOutputTokens = 0
  if (perfRows && perfRows.length > 0) {
    const durations = perfRows.filter((r) => r.duration_ms != null)
    const inputs = perfRows.filter((r) => r.input_tokens != null)
    const outputs = perfRows.filter((r) => r.output_tokens != null)
    if (durations.length) avgLatency = Math.round(durations.reduce((s, r) => s + r.duration_ms, 0) / durations.length)
    if (inputs.length) avgInputTokens = Math.round(inputs.reduce((s, r) => s + r.input_tokens, 0) / inputs.length)
    if (outputs.length) avgOutputTokens = Math.round(outputs.reduce((s, r) => s + r.output_tokens, 0) / outputs.length)
  }

  // Top 5 users by request count
  const userRequestCounts: Record<string, number> = {}
  const { data: userIdRows } = await admin
    .from('agent_request_logs')
    .select('user_id')
  for (const r of userIdRows ?? []) {
    const uid = r.user_id
    userRequestCounts[uid] = (userRequestCounts[uid] || 0) + 1
  }
  const topUserIds = Object.entries(userRequestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Resolve emails for top users
  const topUsersWithEmail: { userId: string; email: string; count: number }[] = []
  for (const [uid, count] of topUserIds) {
    const match = allUsers.find((u) => u.id === uid)
    topUsersWithEmail.push({
      userId: uid,
      email: match?.email ?? uid.slice(0, 8) + '…',
      count,
    })
  }

  // --- 4. Engagement ---
  const feedbackTotal = await countRows(admin, 'feedback')
  const feedback7d = await countRows(admin, 'feedback', now7)
  const feedback30d = await countRows(admin, 'feedback', now30)

  const { count: betaInvited } = await admin
    .from('beta_access')
    .select('id', { count: 'exact', head: true })
  const { count: betaAccepted } = await admin
    .from('beta_access')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')

  return NextResponse.json({
    users: {
      total: totalUsers,
      newThisWeek,
      newThisMonth,
      activeToday,
      activeThisWeek,
      activeThisMonth,
    },
    apps: {
      financialPulse: { profiles: fpProfiles, pulseChecks: fpPulseChecks, pulseChecks7d: fpPulseChecks7d, pulseChecks30d: fpPulseChecks30d, savedScenarios: fpScenarios },
      retirement: { plans: rpPlans, accounts: rpAccounts, scenarios: rpScenarios },
      property: { properties: piProperties, importLoads: piImportLoads },
      partnerships: { entities: ptEntities, members: ptMembers, investments: ptInvestments, decisions: ptDecisions },
    },
    ai: {
      totalRequests: aiTotal,
      requests7d: ai7d,
      requests30d: ai30d,
      errorCount,
      errorRate: aiTotal > 0 ? Math.round((errorCount / aiTotal) * 100) : 0,
      avgLatencyMs: avgLatency,
      avgInputTokens,
      avgOutputTokens,
      providerBreakdown: providerCounts,
      topUsers: topUsersWithEmail,
    },
    engagement: {
      feedbackTotal,
      feedback7d,
      feedback30d,
      betaInvited: betaInvited ?? 0,
      betaAccepted: betaAccepted ?? 0,
    },
  })
}

'use client'

import { useEffect, useState } from 'react'
import {
  Users, Activity, Bot, MessageSquare, TrendingUp, Building2, Landmark,
  Home, Handshake, Loader2, AlertCircle, Clock, Zap, FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface AnalyticsData {
  users: {
    total: number
    newThisWeek: number
    newThisMonth: number
    activeToday: number
    activeThisWeek: number
    activeThisMonth: number
  }
  apps: {
    financialPulse: { profiles: number; pulseChecks: number; pulseChecks7d: number; pulseChecks30d: number; savedScenarios: number }
    retirement: { plans: number; accounts: number; scenarios: number }
    property: { properties: number; importLoads: number }
    partnerships: { entities: number; members: number; investments: number; decisions: number }
  }
  ai: {
    totalRequests: number
    requests7d: number
    requests30d: number
    errorCount: number
    errorRate: number
    avgLatencyMs: number
    avgInputTokens: number
    avgOutputTokens: number
    providerBreakdown: Record<string, number>
    topUsers: { userId: string; email: string; count: number }[]
  }
  engagement: {
    feedbackTotal: number
    feedback7d: number
    feedback30d: number
    betaInvited: number
    betaAccepted: number
  }
}

function StatCard({
  label, value, sub, icon: Icon,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude',
  gemini: 'Gemini (OAuth)',
  'gemini-api-key': 'Gemini (Key)',
  webllm: 'WebLLM',
}

export function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load analytics (${r.status})`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading analytics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="h-4 w-4 mr-2" />
        {error ?? 'Failed to load analytics'}
      </div>
    )
  }

  const { users, apps, ai, engagement } = data
  const providerEntries = Object.entries(ai.providerBreakdown).sort((a, b) => b[1] - a[1])
  const maxProviderCount = providerEntries.length > 0 ? providerEntries[0][1] : 1

  return (
    <div className="space-y-8">
      {/* --- User Growth --- */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4.5 w-4.5" /> User Growth
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Users} label="Total Users" value={users.total} />
          <StatCard icon={TrendingUp} label="New This Week" value={users.newThisWeek} />
          <StatCard icon={TrendingUp} label="New This Month" value={users.newThisMonth} />
          <StatCard icon={Activity} label="Active Today" value={users.activeToday} />
          <StatCard icon={Activity} label="Active This Week" value={users.activeThisWeek} />
          <StatCard icon={Activity} label="Active This Month" value={users.activeThisMonth} />
        </div>
      </section>

      {/* --- App Adoption --- */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4.5 w-4.5" /> App Adoption
        </h2>

        {/* Financial Pulse */}
        <h3 className="text-sm font-medium text-muted-foreground mb-2 mt-4">Financial Pulse</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Profiles Created" value={apps.financialPulse.profiles} />
          <StatCard icon={Activity} label="Pulse Checks" value={apps.financialPulse.pulseChecks}
            sub={`${apps.financialPulse.pulseChecks7d} this week · ${apps.financialPulse.pulseChecks30d} this month`} />
          <StatCard icon={FileText} label="Saved Scenarios" value={apps.financialPulse.savedScenarios} />
        </div>

        {/* Retirement Planner */}
        <h3 className="text-sm font-medium text-muted-foreground mb-2 mt-4">Retirement Planner</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={Landmark} label="Plans" value={apps.retirement.plans} />
          <StatCard icon={Landmark} label="Accounts" value={apps.retirement.accounts} />
          <StatCard icon={FileText} label="Scenarios" value={apps.retirement.scenarios} />
        </div>

        {/* Property Investment */}
        <h3 className="text-sm font-medium text-muted-foreground mb-2 mt-4">Property Investment</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Home} label="Properties" value={apps.property.properties} />
          <StatCard icon={Building2} label="Import Batches" value={apps.property.importLoads} />
        </div>

        {/* Partnerships */}
        <h3 className="text-sm font-medium text-muted-foreground mb-2 mt-4">Partnerships</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Handshake} label="Entities" value={apps.partnerships.entities} />
          <StatCard icon={Users} label="Members" value={apps.partnerships.members} />
          <StatCard icon={TrendingUp} label="Investments" value={apps.partnerships.investments} />
          <StatCard icon={FileText} label="Decisions" value={apps.partnerships.decisions} />
        </div>
      </section>

      {/* --- AI Assistant --- */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Bot className="h-4.5 w-4.5" /> AI Assistant
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Bot} label="Total Requests" value={ai.totalRequests}
            sub={`${ai.requests7d} this week · ${ai.requests30d} this month`} />
          <StatCard icon={AlertCircle} label="Errors" value={ai.errorCount}
            sub={`${ai.errorRate}% error rate`} />
          <StatCard icon={Clock} label="Avg Latency" value={`${(ai.avgLatencyMs / 1000).toFixed(1)}s`} />
          <StatCard icon={Zap} label="Avg Tokens" value={ai.avgInputTokens + ai.avgOutputTokens}
            sub={`${ai.avgInputTokens} in · ${ai.avgOutputTokens} out`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Provider breakdown */}
          <Card className="py-4">
            <CardHeader className="px-4 py-0">
              <CardTitle className="text-sm">Provider Usage</CardTitle>
            </CardHeader>
            <CardContent className="px-4 space-y-2">
              {providerEntries.length === 0 && (
                <p className="text-xs text-muted-foreground">No data yet</p>
              )}
              {providerEntries.map(([provider, count]) => (
                <div key={provider} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{PROVIDER_LABELS[provider] ?? provider}</span>
                    <span className="text-muted-foreground">
                      {count} ({ai.totalRequests > 0 ? Math.round((count / ai.totalRequests) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(count / maxProviderCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top users */}
          <Card className="py-4">
            <CardHeader className="px-4 py-0">
              <CardTitle className="text-sm">Top Users by Requests</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {ai.topUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs text-right">Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ai.topUsers.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="text-xs font-mono">{u.email}</TableCell>
                        <TableCell className="text-xs text-right">
                          <Badge variant="secondary">{u.count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* --- Engagement --- */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5" /> Engagement
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={MessageSquare} label="Feedback (Total)" value={engagement.feedbackTotal}
            sub={`${engagement.feedback7d} this week · ${engagement.feedback30d} this month`} />
          <StatCard icon={Users} label="Beta Invited" value={engagement.betaInvited} />
          <StatCard icon={Activity} label="Beta Accepted" value={engagement.betaAccepted}
            sub={engagement.betaInvited > 0 ? `${Math.round((engagement.betaAccepted / engagement.betaInvited) * 100)}% conversion` : ''} />
        </div>
      </section>
    </div>
  )
}

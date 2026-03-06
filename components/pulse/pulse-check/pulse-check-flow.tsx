'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { REFLECTION_QUESTIONS, MOOD_EMOJIS, MOOD_LABELS } from '@/lib/constants/pulse-defaults'
import { computeResilienceScore, computeNetWorth } from '@/lib/utils/pulse-calculations'
import { BENCHMARK_DATA } from '@/lib/constants/benchmark-data'
import { EMPTY_PROFILE, type DemographicProfile, type PulseCheck } from '@/lib/demographics'

export function PulseCheckFlow() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [profile, setProfile] = useState<DemographicProfile | null>(null)
  const [pastChecks, setPastChecks] = useState<PulseCheck[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  const [netWorth, setNetWorth] = useState(0)
  const [reflectionQuestion] = useState(() => {
    const idx = new Date().getMonth() % REFLECTION_QUESTIONS.length
    return REFLECTION_QUESTIONS[idx]
  })
  const [reflectionAnswer, setReflectionAnswer] = useState('')
  const [mood, setMood] = useState(3)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [profileRes, checksRes] = await Promise.all([
        supabase.from('fp_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('fp_pulse_checks').select('*').eq('user_id', user.id).order('check_date', { ascending: false }).limit(12),
      ])

      const checks = (checksRes.data ?? []) as PulseCheck[]
      const lastCheck = checks[0] ?? null

      if (profileRes.data) {
        const d = profileRes.data
        const p: DemographicProfile = {
          ...EMPTY_PROFILE, ...d,
          debts: Array.isArray(d.debts) ? d.debts : [],
          subscriptions: Array.isArray(d.subscriptions) ? d.subscriptions : [],
          child_ages: Array.isArray(d.child_ages) ? d.child_ages : [],
          explored_scenarios: Array.isArray(d.explored_scenarios) ? d.explored_scenarios : [],
        }
        setProfile(p)
        const fromProfile = computeNetWorth(p)
        setNetWorth(lastCheck != null ? lastCheck.net_worth_snapshot : fromProfile)
      } else if (lastCheck != null) {
        setNetWorth(lastCheck.net_worth_snapshot)
      }
      if (checksRes.data) setPastChecks(checksRes.data as PulseCheck[])
      setLoading(false)
    }
    load()
  }, [supabase])

  const currentScore = profile ? computeResilienceScore(profile, BENCHMARK_DATA).total : 0
  const lastCheck = pastChecks[0]

  const getLocalDateString = useCallback(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!userId) return
    setSubmitting(true)
    const { error } = await supabase.from('fp_pulse_checks').insert({
      user_id: userId,
      check_date: getLocalDateString(),
      net_worth_snapshot: netWorth,
      reflection_question: reflectionQuestion,
      reflection_answer: reflectionAnswer || null,
      mood,
      resilience_score: currentScore,
    })
    if (error) {
      toast.error('Failed to save pulse check')
    } else {
      toast.success('Pulse Check saved!')
      router.push('/apps/pulse/dashboard')
    }
    setSubmitting(false)
  }, [userId, supabase, netWorth, reflectionQuestion, reflectionAnswer, mood, currentScore, router, getLocalDateString])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  const steps = [
    // Step 0: Net worth
    <div key="nw" className="space-y-4">
      <h2 className="text-lg font-bold">What&apos;s your approximate net worth today?</h2>
      <p className="text-sm text-muted-foreground">
        {profile ? 'Assets minus debts. We pre-filled from your profile — adjust if needed.' : 'Assets minus debts. Enter your best estimate.'}
      </p>
      {!profile && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Tip: <Link href="/apps/pulse/profile" className="underline hover:text-foreground">Create your profile</Link> first for pre-filled data and a resilience score.
        </p>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input className="pl-7 text-lg h-12" type="number" value={netWorth || ''} onChange={(e) => setNetWorth(Number(e.target.value))} />
      </div>
    </div>,

    // Step 1: Reflection
    <div key="reflect" className="space-y-4">
      <h2 className="text-lg font-bold">{reflectionQuestion}</h2>
      <p className="text-sm text-muted-foreground">Take a moment to reflect. There are no wrong answers.</p>
      <textarea
        className="w-full rounded-xl border bg-background p-3 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your thoughts here..."
        value={reflectionAnswer}
        onChange={(e) => setReflectionAnswer(e.target.value)}
      />
    </div>,

    // Step 2: Mood
    <div key="mood" className="space-y-4">
      <h2 className="text-lg font-bold">How do you feel about your finances right now?</h2>
      <div className="flex justify-center gap-3">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl border p-3 w-16 transition-all',
              mood === m ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 scale-110' : 'hover:bg-accent'
            )}
          >
            <span className="text-2xl">{MOOD_EMOJIS[m]}</span>
            <span className="text-[10px] text-muted-foreground">{MOOD_LABELS[m]}</span>
          </button>
        ))}
      </div>
    </div>,

    // Step 3: Summary
    <div key="summary" className="space-y-4">
      <h2 className="text-lg font-bold">Your Pulse Check</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Net Worth</p>
          <p className="text-lg font-bold">${netWorth.toLocaleString()}</p>
          {lastCheck && (
            <p className={cn('text-xs font-medium', netWorth >= lastCheck.net_worth_snapshot ? 'text-emerald-600' : 'text-red-500')}>
              {netWorth >= lastCheck.net_worth_snapshot ? '+' : ''}{(netWorth - lastCheck.net_worth_snapshot).toLocaleString()} since last
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Resilience Score</p>
          <p className="text-lg font-bold">{currentScore}</p>
          {lastCheck && (
            <p className={cn('text-xs font-medium', currentScore >= lastCheck.resilience_score ? 'text-emerald-600' : 'text-red-500')}>
              {currentScore >= lastCheck.resilience_score ? '+' : ''}{currentScore - lastCheck.resilience_score} since last
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Mood</p>
          <p className="text-2xl">{MOOD_EMOJIS[mood]}</p>
          <p className="text-xs text-muted-foreground">{MOOD_LABELS[mood]}</p>
        </div>
      </div>
    </div>,
  ]

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <Link href="/apps/pulse/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monthly Pulse Check</h1>
        <p className="text-sm text-muted-foreground">2 minutes to reflect on your financial progress.</p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={cn('h-2 w-2 rounded-full transition-colors', i <= step ? 'bg-orange-500' : 'bg-muted/50')} />
        ))}
      </div>

      {/* Current step */}
      <div className="rounded-xl border bg-card p-6">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < steps.length - 1 ? (
          <Button size="sm" onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" disabled={submitting} onClick={handleSubmit} className="bg-orange-600 hover:bg-orange-700 text-white">
            <CheckCircle2 className="h-4 w-4 mr-1" /> {submitting ? 'Saving...' : 'Save Pulse Check'}
          </Button>
        )}
      </div>
    </div>
  )
}

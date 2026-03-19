'use client'

import Link from 'next/link'
import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Target, Building2, Shield, Eye, EyeOff, ChevronDown, ChevronUp, Lock, ServerIcon, Globe, Lightbulb, Map, AlertTriangle, Activity, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FeedbackButton } from '@/components/feedback/feedback-button'
import { FontScaleToggle } from '@/components/layout/font-scale-toggle'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

const SECURITY_DETAILS = [
  {
    icon: Lock,
    title: 'End-to-end authentication via Supabase',
    detail: 'All authentication is handled by Supabase Auth — a dedicated, SOC 2-compliant auth service. Passwords are never stored in plain text and are hashed using bcrypt.',
  },
  {
    icon: Shield,
    title: 'Your data is yours only',
    detail: 'Every piece of financial data is scoped to your user account via row-level security (RLS) enforced in the database. No other user can read or write your data, even if they know your IDs.',
  },
  {
    icon: ServerIcon,
    title: 'No data sold or shared',
    detail: 'Your financial data — plans, accounts, projections — is never sold, shared, or used for advertising. It exists solely to power your planning experience.',
  },
  {
    icon: Target,
    title: 'Google Sign-In option',
    detail: 'When you use "Sign in with Google", we receive only a session token from Google. We do not request access to your Google Drive, Gmail, or any other Google service.',
  },
]

function LoginContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSecurityDetails, setShowSecurityDetails] = useState(false)
  const [showMobileMission, setShowMobileMission] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Decode the post-login destination and context flags
  const nextParam = searchParams.get('next') ?? '/'
  const isInvite = searchParams.get('invite') === '1'

  // Open sign-up form when coming from ?signup=1
  // Invite links default to sign-in (user may already have an account)
  useEffect(() => {
    if (searchParams.get('signup') === '1') setIsSignUp(true)
  }, [searchParams, isInvite])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // After email confirmation, send user to their intended destination
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
          },
        })
        if (error) throw error
        toast.success('Check your email to confirm your account!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        // Hard navigate so the browser sends the fresh session cookie to the
        // server in the very first request — avoids the race where router.push()
        // lands before the cookie is readable server-side, showing the
        // unauthenticated page briefly.
        window.location.href = nextParam
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Pass next through so the OAuth callback redirects correctly
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextParam)}`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      toast.error(error?.message ?? 'Sign in with Google failed')
      setLoading(false)
    }
  }

  const features = [
    {
      icon: Activity,
      title: 'Financial Pulse',
      description: 'Personal finance education with benchmarking, Financial Learning Lab, and monthly reflection',
    },
    {
      icon: Building2,
      title: 'Property Investment',
      description: 'Cap rate, cash-on-cash return, and loan amortization',
    },
    {
      icon: Target,
      title: 'Retirement Planner',
      description: 'Retirement projections, scenario modeling, risk and tax analysis',
    },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-slate-800 via-slate-800 to-blue-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Target className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">My Plan</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            Your complete financial planning suite
          </h1>
          <p className="mt-4 text-lg text-slate-200">
            Build financial intuition, model real estate investments, and plan your retirement — all in one private, secure platform.
          </p>

          <div className="mt-10 space-y-5">
            {features.map((feature) => (
              <div key={feature.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{feature.title}</p>
                  <p className="text-sm text-slate-300">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Philosophy section */}
        <div className="mt-10 border-t border-white/10 pt-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-5">Our Mission</p>
          <p className="text-xl font-bold leading-snug text-white mb-6">
            Financial clarity for everyone.
          </p>
          <div className="space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Democratizing financial knowledge</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Great planning tools shouldn&apos;t require a wealth manager. We want to make professional-grade analysis accessible to everyone, for free.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Build confidence, not dependency</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Every tool is built to teach you the <em>why</em> behind the numbers — so you can make informed decisions with confidence.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                <Map className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">One plan, complete picture</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                  Personal finance education, real estate, and retirement planning in one place — because your finances don&apos;t exist in silos.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mt-5">
            You can contribute to this mission by trying the app, using the tools in your planning, and sharing feedback. Your participation helps us improve the product for everyone — use the feedback button in the app to send suggestions and report issues.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Educational use only.</span>{' '}
            This platform provides financial modeling tools for informational and educational purposes. It is not financial, investment, or tax advice. Always do your own due diligence and consult a qualified financial professional before making financial decisions.
          </p>
        </div>

        {/* Privacy line */}
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Shield className="h-4 w-4 text-slate-500" />
          Your financial data is private and never shared.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16 bg-background">
        {/* Text size — above form for accessibility */}
        <div className="absolute top-4 right-6 lg:top-6 lg:right-10 flex items-center justify-end">
          <FontScaleToggle variant="inline" />
        </div>

        {/* Mobile brand */}
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-white">
            <Target className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold">My Plan</span>
        </div>

        {/* Mobile mission banner */}
        <div className="lg:hidden w-full max-w-sm mb-6 rounded-xl bg-slate-800 text-white overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMobileMission(!showMobileMission)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5"
            aria-expanded={showMobileMission}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Our Mission</p>
                <p className="text-sm font-bold text-white leading-snug">Financial clarity for everyone.</p>
              </div>
            </div>
            {showMobileMission
              ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            }
          </button>

          {showMobileMission && (
            <div className="px-4 pb-4 border-t border-white/10">
              <div className="space-y-4 pt-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Democratizing financial knowledge</p>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      Great planning tools shouldn&apos;t require a wealth manager. We want to make professional-grade analysis accessible to everyone, for free.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                    <Lightbulb className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Build confidence, not dependency</p>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      Every tool is built to teach you the <em>why</em> behind the numbers — so you can make informed decisions with confidence.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-emerald-300">
                    <Map className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">One plan, complete picture</p>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">
                      Personal finance education, real estate, and retirement planning in one place — because your finances don&apos;t exist in silos.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mt-4">
                You can contribute to this mission by trying the app, using the tools in your planning, and sharing feedback. Your participation helps us improve for everyone — use the feedback button in the app to send suggestions and report issues.
              </p>
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Educational use only.</span>{' '}
                  This platform provides financial modeling tools for informational and educational purposes. It is not financial, investment, or tax advice. Always consult a qualified financial professional before making financial decisions.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm">
          {/* Invitation context banner */}
          {isInvite && (
            <div className="mb-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3.5 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">You&apos;ve been invited to a team</p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className={`underline underline-offset-2 transition-colors ${!isSignUp ? 'font-semibold text-emerald-800 dark:text-emerald-200' : 'hover:text-emerald-900 dark:hover:text-emerald-200'}`}
                  >
                    Sign in
                  </button>
                  {' '}or{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className={`underline underline-offset-2 transition-colors ${isSignUp ? 'font-semibold text-emerald-800 dark:text-emerald-200' : 'hover:text-emerald-900 dark:hover:text-emerald-200'}`}
                  >
                    create a free account
                  </button>
                  {' '}to accept the invitation and collaborate on shared properties.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignUp
                ? 'Start planning your financial future today'
                : 'Sign in to your planning platform'}
            </p>
          </div>

          {/* Google sign-in — shown prominently first */}
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            className="w-full mb-4"
            size="lg"
            onClick={handleGoogleSignIn}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
          </Button>

          {/* Divider */}
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or use email</span>
            </div>
          </div>

          {/* Email / password form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  placeholder={isSignUp ? 'Min. 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
                <Link
                  href="/login/forgot-username"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot username?
                </Link>
                <Link
                  href="/login/forgot-password"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500"
              size="lg"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in with email'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? (
                <>Already have an account? <span className="font-medium text-foreground">Sign in</span></>
              ) : (
                <>Don&apos;t have an account? <span className="font-medium text-foreground">Sign up</span></>
              )}
            </button>
          </div>

          {/* Try without signing up */}
          <div className="mt-6 rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-4 py-3.5 text-center">
            <p className="text-xs text-violet-700 dark:text-violet-300 mb-2 font-medium">
              Not ready to create an account?
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-100 transition-colors"
            >
              Try without an account →
            </a>
            <p className="text-[11px] text-violet-600/70 dark:text-violet-400/70 mt-2">
              All tools available free. Data saved in your browser.
            </p>
          </div>

          {/* Security & privacy note */}
          <div className="mt-5 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your data is encrypted, never sold, and only accessible to you.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityDetails(!showSecurityDetails)}
                className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                aria-expanded={showSecurityDetails}
              >
                {showSecurityDetails ? <>Less <ChevronUp className="h-3 w-3" /></> : <>More <ChevronDown className="h-3 w-3" /></>}
              </button>
            </div>

            {showSecurityDetails && (
              <div className="mt-3 space-y-3 pt-3 border-t border-border">
                {SECURITY_DETAILS.map((item) => (
                  <div key={item.title} className="flex items-start gap-2.5">
                    <item.icon className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-foreground">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
      <FeedbackButton />
    </div>
  )
}

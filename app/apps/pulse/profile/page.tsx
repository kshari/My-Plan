'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { EMPTY_PROFILE, type DemographicProfile } from '@/lib/demographics'
import { ProfileForm } from '@/components/pulse/profile-form'

export default function ProfilePage() {
  const [profile, setProfile] = useState<DemographicProfile>(EMPTY_PROFILE)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('fp_profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (data) {
        setProfile({
          ...EMPTY_PROFILE,
          ...data,
          debts: Array.isArray(data.debts) ? data.debts : [],
          subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : [],
          child_ages: Array.isArray(data.child_ages) ? data.child_ages : [],
          explored_scenarios: Array.isArray(data.explored_scenarios) ? data.explored_scenarios : [],
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const save = useCallback(async (p: DemographicProfile) => {
    if (!userId) return
    const { id, user_id, created_at, updated_at, ...rest } = p as any
    const { error } = await supabase.from('fp_profiles').upsert(
      { ...rest, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile saved', { duration: 1500 })
    }
  }, [userId, supabase])

  const handleChange = useCallback((p: DemographicProfile) => {
    setProfile(p)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(p), 1200)
  }, [save])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/apps/pulse/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Your Financial Profile</h1>
      <p className="text-sm text-muted-foreground mb-6">
        This powers your benchmarks and Financial Learning Lab. Changes auto-save.
      </p>
      <ProfileForm profile={profile} onChange={handleChange} />
    </div>
  )
}

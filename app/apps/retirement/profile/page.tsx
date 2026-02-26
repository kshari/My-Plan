import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileForm from '@/components/retirement/profile-form'

export default async function RetirementProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/apps/retirement/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Retirement Plans
      </Link>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Profile Settings</h1>
        <ProfileForm />
      </div>
    </div>
  )
}

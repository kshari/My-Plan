import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProfileForm from '@/components/property/profile-form'

export default async function PropertyProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: { user: userDetails } } = await supabase.auth.getUser()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/apps/property/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Properties
      </Link>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Manage your account information and preferences
        </p>
        <ProfileForm user={userDetails} />
      </div>
    </div>
  )
}

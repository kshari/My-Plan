import { requireAuth } from '@/lib/utils/auth'
import { BACK_LINK } from '@/lib/constants/css'
import Link from 'next/link'
import ProfileForm from '@/components/retirement/profile-form'

export default async function RetirementProfilePage() {
  await requireAuth()

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/apps/retirement/dashboard"
        className={BACK_LINK}
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

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2 } from 'lucide-react'

export default async function PropertyHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/apps/property/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
            <Building2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Property Investment</h1>
          <p className="mt-2 text-muted-foreground">Manage your properties, financial scenarios, and loans</p>
        </div>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            My Plan Home
          </Link>
        </div>
      </div>
    </div>
  )
}

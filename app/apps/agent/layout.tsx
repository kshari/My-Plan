import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkAdmin } from '@/lib/utils/auth'
import { getFeatureFlags } from '@/lib/app-features'
import { AppShell } from '@/components/layout/app-shell'

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [features, { isAdmin }] = await Promise.all([
    getFeatureFlags(supabase, user.id),
    checkAdmin(supabase, user.id),
  ])
  if (!features.aiAgent) redirect('/')

  return (
    <AppShell userEmail={user.email ?? ''} isAdmin={isAdmin} features={features}>
      {children}
    </AppShell>
  )
}

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { checkAdmin } from "@/lib/utils/auth"
import { AppShell } from "@/components/layout/app-shell"

export default async function RetirementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { isAdmin } = await checkAdmin(supabase, user.id)

  return (
    <AppShell userEmail={user.email ?? ""} isAdmin={isAdmin}>
      {children}
    </AppShell>
  )
}

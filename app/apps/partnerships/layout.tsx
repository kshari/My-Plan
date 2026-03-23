import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PartnershipsShell } from "@/components/partnerships/partnerships-shell"
import type { PartnershipEntity } from "@/lib/types/partnerships"

export default async function PartnershipsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Fetch all entities where user is an active member (RLS handles filtering)
  const { data: entities } = await supabase
    .from("pt_entities")
    .select("*")
    .order("created_at", { ascending: false })

  const filteredEntities = (entities ?? []) as PartnershipEntity[]

  return (
    <PartnershipsShell
      userEmail={user.email ?? ""}
      entities={filteredEntities}
    >
      {children}
    </PartnershipsShell>
  )
}

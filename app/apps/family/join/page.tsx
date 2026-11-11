import { requireAuth } from "@/lib/utils/auth"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

interface Props { searchParams: Promise<{ token?: string }> }

export default async function JoinFamilyPage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) redirect("/apps/family")

  const { supabase, user } = await requireAuth()

  const { data: inv } = await supabase
    .from("fa_invitations")
    .select("*, fa_families(*)")
    .eq("invite_token", token)
    .eq("status", "pending")
    .single()

  if (!inv || new Date(inv.expires_at) < new Date()) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <h1 className="text-xl font-bold">Invalid or expired invite</h1>
        <p className="text-muted-foreground mt-2">Ask the family admin to send a new invite link.</p>
      </div>
    )
  }

  // Auto-accept: update the invitation and member record
  await supabase.from("fa_invitations").update({ status: "accepted" }).eq("id", inv.id)

  if (inv.member_id) {
    await supabase.from("fa_members").update({
      user_id: user.id,
      status: "active",
      joined_at: new Date().toISOString(),
    }).eq("id", inv.member_id)
  } else {
    await supabase.from("fa_members").insert({
      family_id: inv.family_id,
      user_id: user.id,
      display_name: user.email?.split("@")[0] ?? "Member",
      email: user.email,
      role: "member",
      status: "active",
      age_band: "adult",
      joined_at: new Date().toISOString(),
    })
  }

  redirect(`/apps/family/${inv.family_id}`)
}

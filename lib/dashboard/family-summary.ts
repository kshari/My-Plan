import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppSummary, MetricTone } from "./types"

export async function computeFamilySummary(
  supabase: SupabaseClient,
  userId: string
): Promise<AppSummary> {
  const appId = "family" as const

  // Get families where user is an active member
  const { data: memberships } = await supabase
    .from("fa_members")
    .select("family_id")
    .eq("user_id", userId)
    .eq("status", "active")

  const familyIds = (memberships ?? []).map((m: { family_id: string }) => m.family_id)
  const hasFamilies = familyIds.length > 0

  if (!hasFamilies) {
    return {
      app: appId,
      started: false,
      setup: {
        steps: [
          { label: "Create a family", done: false },
          { label: "Add members", done: false },
          { label: "Add interests", done: false },
          { label: "Add places", done: false },
        ],
        pctComplete: 0,
      },
      metrics: [],
      primaryCta: { label: "Get Started", href: "/apps/family" },
    }
  }

  const [
    { data: members },
    { data: suggestions },
    { data: trips },
    { data: interests },
    { data: places },
  ] = await Promise.all([
    supabase.from("fa_members").select("id").in("family_id", familyIds).in("status", ["active","placeholder"]),
    supabase.from("fa_suggestions").select("id,title,score").in("family_id", familyIds).neq("status", "dismissed").order("score", { ascending: false, nullsFirst: false }).limit(1),
    supabase.from("fa_trips").select("id,title,start_date").in("family_id", familyIds).neq("status", "cancelled").gte("start_date", new Date().toISOString().split("T")[0]).order("start_date").limit(1),
    supabase.from("fa_interests").select("id").in("family_id", familyIds),
    supabase.from("fa_places").select("id").in("family_id", familyIds),
  ])

  const memberCount = (members ?? []).length
  const topSuggestion = (suggestions ?? [])[0] as { id: string; title: string; score: number | null } | undefined
  const nextTrip = (trips ?? [])[0] as { id: string; title: string; start_date: string | null } | undefined
  const hasInterests = (interests ?? []).length > 0
  const hasPlaces = (places ?? []).length > 0

  const steps = [
    { label: "Create a family", done: true },
    { label: "Add members", done: memberCount > 1 },
    { label: "Set interests", done: hasInterests },
    { label: "Add places", done: hasPlaces },
  ]
  const donePct = Math.round((steps.filter((s) => s.done).length / steps.length) * 100)

  const topTone: MetricTone = topSuggestion ? "positive" : "neutral"
  const tripTone: MetricTone = nextTrip ? "positive" : "neutral"

  const metrics = [
    { label: "Members", value: String(memberCount), tone: "neutral" as MetricTone },
    {
      label: "Top suggestion",
      value: topSuggestion ? topSuggestion.title.slice(0, 20) : "None yet",
      tone: topTone,
    },
    {
      label: "Next trip",
      value: nextTrip?.start_date
        ? new Date(nextTrip.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "None planned",
      tone: tripTone,
    },
  ]

  return {
    app: appId,
    started: true,
    setup: { steps, pctComplete: donePct },
    metrics,
    primaryCta: { label: "Plan Activities", href: "/apps/family" },
  }
}

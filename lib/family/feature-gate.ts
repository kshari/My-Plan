import type { SupabaseClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getFeatureFlags } from "@/lib/app-features"

/** Returns a 403 response when the user lacks Family Activities access, otherwise null. */
export async function familyAppForbidden(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  const { familyApp } = await getFeatureFlags(supabase, userId)
  if (familyApp) return null
  return NextResponse.json({ error: "Family Activities is not enabled for your account" }, { status: 403 })
}

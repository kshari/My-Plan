import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getDecryptedCredential, getGeminiAccessToken, getPreferredModel } from "@/lib/agent/credentials"
import { INTEREST_TAG_LABELS } from "@/lib/constants/family"
import OpenAI from "openai"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { familyId } = await request.json().catch(() => ({}))
  if (!familyId) return NextResponse.json({ error: "familyId required" }, { status: 400 })

  // Verify membership
  const { data: member } = await supabase
    .from("fa_members").select("id").eq("family_id", familyId).eq("user_id", user.id).eq("status", "active").maybeSingle()
  if (!member) return NextResponse.json({ error: "Not a family member" }, { status: 403 })

  // Fetch context
  const [{ data: family }, { data: members }, { data: interests }, { data: availability }] = await Promise.all([
    supabase.from("fa_families").select("*").eq("id", familyId).single(),
    supabase.from("fa_members").select("*").eq("family_id", familyId).in("status", ["active","placeholder"]),
    supabase.from("fa_interests").select("*").eq("family_id", familyId),
    supabase.from("fa_availability").select("*").eq("family_id", familyId).eq("kind", "free").gte("end_ts", new Date().toISOString()).order("start_ts").limit(10),
  ])

  if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 })

  // Build prompt context
  const memberSummaries = (members ?? []).map((m) => {
    const memberInterests = (interests ?? []).filter((i) => i.member_id === m.id)
    const tags = memberInterests.map((i) => `${INTEREST_TAG_LABELS[i.tag as keyof typeof INTEREST_TAG_LABELS]} (weight ${i.weight}/5)`).join(", ")
    return `- ${m.display_name} (${m.age_band}): ${tags || "no interests set"}`
  }).join("\n")

  const freeWindows = (availability ?? []).slice(0, 5).map((a) => {
    const start = new Date(a.start_ts).toLocaleDateString()
    const end = new Date(a.end_ts).toLocaleDateString()
    return `${start}–${end}`
  }).join(", ")

  const prompt = `You are a family activity planner helping the ${family.name} family (based in ${family.home_location ?? "unknown location"}) discover great activities and trips.

Family members and their interests:
${memberSummaries}

${freeWindows ? `Upcoming free windows: ${freeWindows}` : ""}

Please suggest 5 diverse activity or trip ideas that would appeal to this family. For each suggestion, provide:
1. A short title (max 10 words)
2. A one-sentence description
3. The type: "day_activity", "weekend", or "vacation"
4. An estimated cost range in USD (as a number, the midpoint)
5. Why this matches the family's interests

Respond ONLY with a JSON array of objects with these exact fields:
[{
  "title": "string",
  "description": "string",
  "kind": "day_activity|weekend|vacation",
  "est_cost": number,
  "reason": "string"
}]`

  // Resolve credentials — try OpenAI, then Gemini
  let aiResponse: string | null = null
  try {
    const openaiKey = await getDecryptedCredential(supabase, user.id, "openai")
    if (openaiKey) {
      const openai = new OpenAI({ apiKey: openaiKey })
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1200,
      })
      aiResponse = completion.choices[0]?.message?.content ?? null
    } else {
      const accessToken = await getGeminiAccessToken(supabase, user.id)
      if (!accessToken) return NextResponse.json({ error: "No AI credentials configured. Set up your AI agent in Settings." }, { status: 503 })

      const { GoogleGenerativeAI } = await import("@google/generative-ai")
      const genai = new GoogleGenerativeAI(accessToken)
      const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" })
      const result = await model.generateContent(prompt)
      aiResponse = result.response.text()
    }
  } catch (e: any) {
    return NextResponse.json({ error: `AI request failed: ${e.message}` }, { status: 500 })
  }

  if (!aiResponse) return NextResponse.json({ error: "Empty AI response" }, { status: 500 })

  // Parse AI response
  let parsed: any[]
  try {
    const text = aiResponse.trim()
    // Handle both raw JSON array and {"suggestions": [...]} wrappers
    const arr = JSON.parse(text)
    parsed = Array.isArray(arr) ? arr : (arr.suggestions ?? arr.ideas ?? Object.values(arr)[0] ?? [])
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
  }

  // Insert suggestions
  const toInsert = parsed.slice(0, 5).map((s: any) => ({
    family_id: familyId,
    title: String(s.title ?? "AI Suggestion"),
    description: s.reason ? `${s.description ?? ""} ${s.reason}`.trim() : (s.description ?? null),
    kind: ["day_activity","weekend","vacation"].includes(s.kind) ? s.kind : "day_activity",
    est_cost: typeof s.est_cost === "number" ? s.est_cost : null,
    source: "ai" as const,
    status: "suggested" as const,
    created_by: user.id,
  }))

  const { data, error } = await supabase.from("fa_suggestions").insert(toInsert).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestions: data ?? [] })
}

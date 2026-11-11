import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")
  if (!query) return NextResponse.json({ error: "q is required" }, { status: 400 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 503 })

  try {
    // Autocomplete API — single type value only (no pipe-separated list)
    const acUrl = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
    acUrl.searchParams.set("input", query)
    // "geocode" covers cities + addresses; "establishment" covers businesses/attractions.
    // We pass no type filter so both come back.
    acUrl.searchParams.set("key", apiKey)

    const acRes = await fetch(acUrl.toString())
    if (!acRes.ok) throw new Error(`Autocomplete HTTP ${acRes.status}`)
    const acData = await acRes.json()

    if (acData.status === "OK") {
      const predictions = (acData.predictions ?? []).slice(0, 8)
      const results = predictions.map((p: any) => ({
        google_place_id: p.place_id,
        name: p.structured_formatting?.main_text ?? p.description,
        address: p.structured_formatting?.secondary_text ?? p.description,
        lat: null,
        lng: null,
        rating: null,
        price_level: null,
        photo_ref: null,
      }))
      return NextResponse.json({ results })
    }

    if (acData.status === "ZERO_RESULTS") {
      return NextResponse.json({ results: [] })
    }

    // Any other status (REQUEST_DENIED, INVALID_REQUEST, etc.) — fall back to Text Search
    console.warn("Autocomplete status:", acData.status, acData.error_message)
    const tsUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
    tsUrl.searchParams.set("query", query)
    tsUrl.searchParams.set("key", apiKey)
    const tsRes = await fetch(tsUrl.toString())
    const tsData = await tsRes.json()

    if (tsData.status !== "OK" && tsData.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: tsData.error_message ?? `Google API error: ${tsData.status}` },
        { status: 502 }
      )
    }

    const results = (tsData.results ?? []).slice(0, 8).map((p: any) => ({
      google_place_id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat ?? null,
      lng: p.geometry?.location?.lng ?? null,
      rating: p.rating ?? null,
      price_level: p.price_level ?? null,
      photo_ref: p.photos?.[0]?.photo_reference ?? null,
    }))
    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

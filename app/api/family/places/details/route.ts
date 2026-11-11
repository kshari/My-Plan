import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get("place_id")
  if (!placeId) return NextResponse.json({ error: "place_id is required" }, { status: 400 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 503 })

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
    url.searchParams.set("place_id", placeId)
    url.searchParams.set("fields", "place_id,name,formatted_address,geometry,rating,price_level,photos,types,opening_hours,editorial_summary")
    url.searchParams.set("key", apiKey)

    const res = await fetch(url.toString())
    const data = await res.json()

    if (data.status !== "OK") {
      return NextResponse.json({ error: data.error_message ?? data.status }, { status: 502 })
    }

    const p = data.result
    return NextResponse.json({
      google_place_id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      lat: p.geometry?.location?.lat ?? null,
      lng: p.geometry?.location?.lng ?? null,
      rating: p.rating ?? null,
      price_level: p.price_level ?? null,
      photo_ref: p.photos?.[0]?.photo_reference ?? null,
      description: p.editorial_summary?.overview ?? null,
      types: p.types ?? [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, Place } from "@/lib/types/family"
import {
  PLACE_CATEGORIES, PLACE_CATEGORY_LABELS, PRICE_LEVEL_LABELS, MONTHS, type PlaceCategory
} from "@/lib/constants/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Plus, Star, Trash2, X, Loader2, Check } from "lucide-react"

interface SearchResult {
  google_place_id: string
  name: string
  address: string
  lat: number | null
  lng: number | null
  rating: number | null
  price_level: number | null
  photo_ref: string | null
}

interface Props {
  family: Family
  myMember: FamilyMember | null
  initialPlaces: Place[]
  userId: string
}

const TIME_OF_DAY = ["morning", "afternoon", "evening", "any"] as const
const DEBOUNCE_MS = 280

export function PlacesClient({ family, myMember, initialPlaces, userId }: Props) {
  const supabase = createClient()
  const [places, setPlaces] = useState<Place[]>(initialPlaces)
  const [showAdd, setShowAdd] = useState(false)

  // Typeahead state
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [noResults, setNoResults] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState({
    name: "", address: "", category: "other" as PlaceCategory, notes: "",
    best_months: [] as number[], best_time_of_day: "any" as string,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [filterCat, setFilterCat] = useState("")

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Debounced search
  const triggerSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim() || q.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      setNoResults(false)
      setSearchError(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setSearchError(null)
      setNoResults(false)
      try {
        const res = await fetch(`/api/family/places/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        if (!res.ok || json.error) {
          setSearchError(json.error ?? "Search failed")
          setSearchResults([])
          setShowDropdown(false)
          return
        }
        const results: SearchResult[] = json.results ?? []
        setSearchResults(results)
        if (results.length > 0) {
          setShowDropdown(true)
          setNoResults(false)
        } else {
          setShowDropdown(false)
          setNoResults(true)
        }
      } catch (e: any) {
        setSearchError("Network error — check your connection")
        setShowDropdown(false)
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  function handleQueryChange(val: string) {
    setSearchQuery(val)
    setNoResults(false)
    if (selected) { setSelected(null); setForm((f) => ({ ...f, name: "", address: "" })) }
    triggerSearch(val)
  }

  async function selectResult(r: SearchResult) {
    setShowDropdown(false)
    setSearchQuery(r.name)
    setSearchResults([])

    // If lat/lng are missing (autocomplete prediction), fetch full details
    if (r.lat == null) {
      setLoadingDetails(true)
      try {
        const res = await fetch(`/api/family/places/details?place_id=${encodeURIComponent(r.google_place_id)}`)
        if (res.ok) {
          const detail = await res.json()
          const enriched: SearchResult = { ...r, ...detail }
          setSelected(enriched)
          setForm((f) => ({ ...f, name: enriched.name, address: enriched.address ?? "" }))
          return
        }
      } finally {
        setLoadingDetails(false)
      }
    }

    setSelected(r)
    setForm((f) => ({ ...f, name: r.name, address: r.address ?? "" }))
  }

  function clearSelection() {
    setSelected(null)
    setSearchQuery("")
    setSearchResults([])
    setShowDropdown(false)
    setNoResults(false)
    setSearchError(null)
    setForm((f) => ({ ...f, name: "", address: "" }))
  }

  async function savePlace() {
    if (!form.name.trim()) { setError("Name is required"); return }
    setSaving(true); setError("")
    try {
      const payload: any = {
        family_id: family.id,
        name: form.name.trim(),
        address: form.address.trim() || null,
        category: form.category,
        notes: form.notes || null,
        best_months: form.best_months.length ? form.best_months : null,
        best_time_of_day: form.best_time_of_day || null,
        created_by: userId,
      }
      if (selected) {
        Object.assign(payload, {
          google_place_id: selected.google_place_id,
          lat: selected.lat,
          lng: selected.lng,
          rating: selected.rating,
          price_level: selected.price_level,
          photo_ref: selected.photo_ref,
        })
      }
      const { data, error: pe } = await supabase.from("fa_places").insert(payload).select().single()
      if (pe || !data) { setError(pe?.message ?? "Failed to save"); return }
      setPlaces((prev) => [data as Place, ...prev])
      setForm({ name: "", address: "", category: "other", notes: "", best_months: [], best_time_of_day: "any" })
      clearSelection()
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  async function deletePlace(id: string) {
    if (!confirm("Remove this place?")) return
    await supabase.from("fa_places").delete().eq("id", id)
    setPlaces((prev) => prev.filter((p) => p.id !== id))
  }

  function toggleMonth(m: number) {
    setForm((f) => ({
      ...f,
      best_months: f.best_months.includes(m)
        ? f.best_months.filter((x) => x !== m)
        : [...f.best_months, m],
    }))
  }

  const filtered = filterCat ? places.filter((p) => p.category === filterCat) : places

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
            <span>/</span><span>Places</span>
          </div>
          <h1 className="text-2xl font-bold">Place Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Save destinations and activities for your family to consider.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1" /> Add Place
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Typeahead search */}
            <div className="space-y-1" ref={dropdownRef}>
              <Label>Search Google Places</Label>
              <div className="relative">
                {/* Input row */}
                <div className="flex items-center border rounded-md px-3 py-1.5 gap-2 bg-background focus-within:ring-2 focus-within:ring-ring">
                  {loadingDetails ? (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                  ) : selected ? (
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : searching ? (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                  ) : (
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <input
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    value={searchQuery}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="Type a place name, city, or landmark…"
                    autoComplete="off"
                  />
                  {(searchQuery || selected) && (
                    <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg bg-background shadow-md max-h-56 overflow-y-auto">
                    {searchResults.map((r) => (
                      <button
                        key={r.google_place_id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted border-b last:border-0 transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); selectResult(r) }}
                      >
                        <p className="text-sm font-medium leading-tight">{r.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Error or no-results hint */}
              {searchError && !searching && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  {searchError.includes("not configured")
                    ? "⚠️ Google Maps API key not configured — add GOOGLE_MAPS_API_KEY to .env.local"
                    : `⚠️ ${searchError}`}
                </p>
              )}
              {noResults && !searching && searchQuery.length >= 2 && (
                <p className="text-xs text-muted-foreground mt-1">No places found for "{searchQuery}"</p>
              )}

              {/* Selected place chip */}
              {selected && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 mt-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selected.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
                  </div>
                  {selected.rating != null && (
                    <span className="text-xs flex items-center gap-0.5 text-amber-600 shrink-0">
                      <Star className="w-3 h-3" />{selected.rating}
                    </span>
                  )}
                  {selected.price_level != null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {PRICE_LEVEL_LABELS[selected.price_level as 0|1|2|3|4]}
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Or skip search and enter a name manually below.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Place name"
                />
              </div>
              <div className="space-y-1">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Auto-filled from search, or enter manually"
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PlaceCategory }))}
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{PLACE_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Best months to visit</Label>
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => toggleMonth(i + 1)}
                    className={`px-2 py-1 rounded text-xs border ${form.best_months.includes(i + 1) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Best time of day</Label>
              <div className="flex gap-2">
                {TIME_OF_DAY.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, best_time_of_day: t }))}
                    className={`px-3 py-1.5 rounded text-sm border capitalize ${form.best_time_of_day === t ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes about this place..."
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={savePlace} disabled={saving || loadingDetails}>
                {saving ? "Saving..." : "Save Place"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); clearSelection() }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat("")}
          className={`px-3 py-1 rounded-full text-sm border ${!filterCat ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
        >
          All ({places.length})
        </button>
        {PLACE_CATEGORIES.filter((c) => places.some((p) => p.category === c)).map((c) => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            className={`px-3 py-1 rounded-full text-sm border ${filterCat === c ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            {PLACE_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Places grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="relative">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{PLACE_CATEGORY_LABELS[p.category as PlaceCategory] ?? p.category}</p>
                  {p.address && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />{p.address}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {p.rating != null && (
                      <span className="text-xs flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-500" />{p.rating}
                      </span>
                    )}
                    {p.price_level != null && (
                      <span className="text-xs text-muted-foreground">
                        {PRICE_LEVEL_LABELS[p.price_level as 0|1|2|3|4]}
                      </span>
                    )}
                    {p.best_months && p.best_months.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Best: {p.best_months.map((m) => MONTHS[m - 1]).join(", ")}
                      </span>
                    )}
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">{p.notes}</p>}
                </div>
                <button onClick={() => deletePlace(p.id)} className="text-muted-foreground hover:text-destructive ml-2 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-muted-foreground text-sm py-12">
            No places saved yet — search and add your first destination!
          </p>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, Trip, Suggestion, ChecklistItem } from "@/lib/types/family"
import { TRIP_STATUS_LABELS, TRIP_STATUSES, type TripStatus } from "@/lib/constants/family"
import { buildLogisticsLinks } from "@/lib/family/logistics-links"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus, Plane, CalendarDays, MapPin, ExternalLink, Check, X,
  Trash2, ChevronDown, ChevronRight
} from "lucide-react"
import { format } from "date-fns"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  initialTrips: Trip[]
  shortlistedSuggestions: Suggestion[]
  userId: string
}

export function TripsClient({ family, myMember, members, initialTrips, shortlistedSuggestions, userId }: Props) {
  const supabase = createClient()
  const [trips, setTrips] = useState<Trip[]>(initialTrips)
  const [showAdd, setShowAdd] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "", destination: "", start_date: "", end_date: "",
    suggestion_id: "", attendee_ids: [] as string[],
  })
  const [checklistInput, setChecklistInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function toggleAttendee(id: string) {
    setForm((f) => ({
      ...f,
      attendee_ids: f.attendee_ids.includes(id)
        ? f.attendee_ids.filter((a) => a !== id)
        : [...f.attendee_ids, id],
    }))
  }

  async function createTrip() {
    if (!form.title.trim()) { setError("Title is required"); return }
    setSaving(true); setError("")
    try {
      const { data, error: te } = await supabase.from("fa_trips").insert({
        family_id: family.id,
        title: form.title.trim(),
        destination: form.destination || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        suggestion_id: form.suggestion_id || null,
        attendee_ids: form.attendee_ids.length ? form.attendee_ids : null,
        checklist: [],
        created_by: userId,
      }).select().single()
      if (te || !data) { setError(te?.message ?? "Failed"); return }
      setTrips((prev) => [...prev, data as Trip])
      setForm({ title: "", destination: "", start_date: "", end_date: "", suggestion_id: "", attendee_ids: [] })
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: TripStatus) {
    const { data } = await supabase.from("fa_trips").update({ status }).eq("id", id).select().single()
    if (data) setTrips((prev) => prev.map((t) => t.id === id ? data as Trip : t))
  }

  async function toggleChecklistItem(trip: Trip, itemId: string) {
    const updated = trip.checklist.map((c) =>
      c.id === itemId ? { ...c, done: !c.done } : c
    )
    const { data } = await supabase.from("fa_trips").update({ checklist: updated }).eq("id", trip.id).select().single()
    if (data) setTrips((prev) => prev.map((t) => t.id === trip.id ? data as Trip : t))
  }

  async function addChecklistItem(trip: Trip, text: string) {
    if (!text.trim()) return
    const item: ChecklistItem = { id: crypto.randomUUID(), text: text.trim(), done: false }
    const updated = [...trip.checklist, item]
    const { data } = await supabase.from("fa_trips").update({ checklist: updated }).eq("id", trip.id).select().single()
    if (data) setTrips((prev) => prev.map((t) => t.id === trip.id ? data as Trip : t))
  }

  async function removeChecklistItem(trip: Trip, itemId: string) {
    const updated = trip.checklist.filter((c) => c.id !== itemId)
    const { data } = await supabase.from("fa_trips").update({ checklist: updated }).eq("id", trip.id).select().single()
    if (data) setTrips((prev) => prev.map((t) => t.id === trip.id ? data as Trip : t))
  }

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))
  const activeMembers = members.filter((m) => m.status === "active" || m.status === "placeholder")

  const statusBadgeStyles: Record<TripStatus, string> = {
    planning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
    confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30",
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
            <span>/</span><span>Trips</span>
          </div>
          <h1 className="text-2xl font-bold">Trips & Shortlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan trips and get logistics links for flights and hotels.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-4 h-4 mr-1" /> Plan Trip
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Trip Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Summer Beach Trip" />
              </div>
              <div className="space-y-1">
                <Label>Destination</Label>
                <Input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} placeholder="e.g. Miami, FL" />
              </div>
              <div className="space-y-1">
                <Label>From shortlisted suggestion</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.suggestion_id}
                  onChange={(e) => {
                    const s = shortlistedSuggestions.find((x) => x.id === e.target.value)
                    setForm((f) => ({
                      ...f,
                      suggestion_id: e.target.value,
                      title: s ? s.title : f.title,
                      start_date: s?.proposed_start ?? f.start_date,
                      end_date: s?.proposed_end ?? f.end_date,
                    }))
                  }}
                >
                  <option value="">— None —</option>
                  {shortlistedSuggestions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Attendees</Label>
              <div className="flex gap-2 flex-wrap">
                {activeMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleAttendee(m.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${form.attendee_ids.includes(m.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={createTrip} disabled={saving}>{saving ? "Saving..." : "Create Trip"}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {trips.map((trip) => {
          const isExpanded = expandedId === trip.id
          const links = trip.destination && family.home_location
            ? buildLogisticsLinks(
                family.home_location,
                trip.destination,
                trip.start_date,
                trip.end_date,
                trip.attendee_ids?.length ?? activeMembers.length,
              )
            : null
          const attendees = (trip.attendee_ids ?? []).map((id) => memberById[id]).filter(Boolean)
          const checkDone = trip.checklist.filter((c) => c.done).length
          const checkTotal = trip.checklist.length

          return (
            <Card key={trip.id}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : trip.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <CardTitle className="text-base">{trip.title}</CardTitle>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {trip.destination && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.destination}</span>}
                        {trip.start_date && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(trip.start_date), "MMM d")}{trip.end_date ? ` – ${format(new Date(trip.end_date), "MMM d, yyyy")}` : ""}
                          </span>
                        )}
                        {checkTotal > 0 && <span>{checkDone}/{checkTotal} tasks</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusBadgeStyles[trip.status]}`}>
                      {TRIP_STATUS_LABELS[trip.status]}
                    </span>
                    <select
                      className="text-xs border rounded px-1.5 py-1 bg-background"
                      value={trip.status}
                      onChange={(e) => updateStatus(trip.id, e.target.value as TripStatus)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {TRIP_STATUSES.map((s) => (
                        <option key={s} value={s}>{TRIP_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Attendees */}
                  {attendees.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {attendees.map((m) => (
                        <span key={m!.id} className="text-xs bg-muted px-2 py-1 rounded-full">{m!.display_name}</span>
                      ))}
                    </div>
                  )}

                  {/* Logistics links */}
                  {links && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flights from {family.home_location}</p>
                      <div className="flex gap-2 flex-wrap">
                        <a href={links.flights.google} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            <Plane className="w-3 h-3" /> Google Flights <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                        <a href={links.flights.skyscanner} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            <Plane className="w-3 h-3" /> Skyscanner <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hotels in {trip.destination}</p>
                      <div className="flex gap-2 flex-wrap">
                        <a href={links.lodging.googleHotels} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            Google Hotels <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                        <a href={links.lodging.airbnb} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            Airbnb <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                        <a href={links.lodging.booking} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                            Booking.com <ExternalLink className="w-3 h-3" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Checklist */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Checklist</p>
                    <div className="space-y-1">
                      {trip.checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleChecklistItem(trip, item.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${item.done ? "bg-primary border-primary" : "border-muted-foreground"}`}
                          >
                            {item.done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </button>
                          <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                          <button onClick={() => removeChecklistItem(trip, item.id)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Add checklist item..."
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addChecklistItem(trip, (e.target as HTMLInputElement).value)
                            ;(e.target as HTMLInputElement).value = ""
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
        {trips.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">No trips yet — plan your first adventure!</p>
        )}
      </div>
    </div>
  )
}

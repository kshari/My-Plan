"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, Availability } from "@/lib/types/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Plus, Trash2, Users } from "lucide-react"
import { format, parseISO, isWithinInterval } from "date-fns"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  initialAvailability: Availability[]
}

interface NewWindow {
  member_id: string
  kind: "free" | "busy"
  start_ts: string
  end_ts: string
  title: string
}

export function AvailabilityClient({ family, myMember, members, initialAvailability }: Props) {
  const supabase = createClient()
  const [availability, setAvailability] = useState<Availability[]>(initialAvailability)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewWindow>({
    member_id: myMember?.id ?? members[0]?.id ?? "",
    kind: "free",
    start_ts: "",
    end_ts: "",
    title: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Compute "everyone free" windows — overlapping free windows across all active members
  const everyoneFree = useMemo(() => {
    const activeIds = members.filter((m) => m.status === "active").map((m) => m.id)
    if (activeIds.length < 2) return []
    const freeByMember: Record<string, { start: Date; end: Date }[]> = {}
    for (const id of activeIds) freeByMember[id] = []
    for (const a of availability) {
      if (a.kind === "free" && activeIds.includes(a.member_id)) {
        freeByMember[a.member_id].push({ start: new Date(a.start_ts), end: new Date(a.end_ts) })
      }
    }
    // Find intersections across all members (simplified: compare first member windows against others)
    const base = freeByMember[activeIds[0]] ?? []
    return base.filter((w) =>
      activeIds.slice(1).every((id) =>
        (freeByMember[id] ?? []).some(
          (ow) => ow.start <= w.end && ow.end >= w.start
        )
      )
    )
  }, [availability, members])

  async function addWindow() {
    if (!form.start_ts || !form.end_ts) { setError("Start and end dates are required"); return }
    if (form.end_ts <= form.start_ts) { setError("End must be after start"); return }
    setSaving(true); setError("")
    try {
      const { data, error: ae } = await supabase.from("fa_availability").insert({
        family_id: family.id,
        member_id: form.member_id,
        source: "manual",
        kind: form.kind,
        start_ts: form.start_ts,
        end_ts: form.end_ts,
        title: form.title || null,
      }).select().single()
      if (ae || !data) { setError(ae?.message ?? "Failed to add"); return }
      setAvailability((prev) => [...prev, data as Availability].sort((a, b) => a.start_ts.localeCompare(b.start_ts)))
      setForm({ member_id: form.member_id, kind: "free", start_ts: "", end_ts: "", title: "" })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteWindow(id: string) {
    await supabase.from("fa_availability").delete().eq("id", id)
    setAvailability((prev) => prev.filter((a) => a.id !== id))
  }

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
            <span>/</span><span>Availability</span>
          </div>
          <h1 className="text-2xl font-bold">Availability</h1>
          <p className="text-sm text-muted-foreground mt-1">Add free & busy windows for each member. The app uses these to recommend the best times.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Add Window
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Member</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.member_id}
                  onChange={(e) => setForm((f) => ({ ...f, member_id: e.target.value }))}
                >
                  {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <div className="flex gap-2">
                  {(["free","busy"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setForm((f) => ({ ...f, kind: k }))}
                      className={`px-3 py-1.5 rounded text-sm border capitalize ${form.kind === k ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start</Label>
                <Input type="datetime-local" value={form.start_ts} onChange={(e) => setForm((f) => ({ ...f, start_ts: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End</Label>
                <Input type="datetime-local" value={form.end_ts} onChange={(e) => setForm((f) => ({ ...f, end_ts: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Label (optional)</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Spring break" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={addWindow} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Everyone-free windows */}
      {everyoneFree.length > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Users className="w-4 h-4" /> Everyone Free ({everyoneFree.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {everyoneFree.map((w, i) => (
              <div key={i} className="text-sm py-1 flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                <span>{format(w.start, "MMM d, yyyy")} – {format(w.end, "MMM d, yyyy")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-member windows */}
      <div className="space-y-4">
        {members.map((m) => {
          const windows = availability.filter((a) => a.member_id === m.id)
          if (windows.length === 0) return null
          return (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{m.display_name}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {windows.map((a) => (
                  <div key={a.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${a.kind === "free" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {a.kind}
                      </span>
                      <span className="text-sm">
                        {format(parseISO(a.start_ts), "MMM d")} – {format(parseISO(a.end_ts), "MMM d, yyyy")}
                        {a.title && ` · ${a.title}`}
                      </span>
                    </div>
                    <button onClick={() => deleteWindow(a.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
        {availability.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No availability windows yet — add some to improve recommendations.</p>
        )}
      </div>
    </div>
  )
}

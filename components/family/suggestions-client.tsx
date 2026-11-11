"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, Suggestion, SuggestionVote, Place, ScoreBreakdown } from "@/lib/types/family"
import {
  ACTIVITY_KIND_LABELS, SUGGESTION_STATUSES, SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_STYLES, type SuggestionStatus
} from "@/lib/constants/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  ThumbsUp, ThumbsDown, Plus, Sparkles, ChevronDown, ChevronRight,
  Lightbulb, Loader2
} from "lucide-react"
import { format } from "date-fns"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  initialSuggestions: Suggestion[]
  initialVotes: SuggestionVote[]
  places: Place[]
  userId: string
}

const KIND_OPTIONS = ["day_activity", "weekend", "vacation"] as const

export function SuggestionsClient({
  family, myMember, members, initialSuggestions, initialVotes, places, userId
}: Props) {
  const supabase = createClient()
  const { familyId } = useParams() as { familyId: string }

  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions)
  const [votes, setVotes] = useState<SuggestionVote[]>(initialVotes)
  const [showAdd, setShowAdd] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<SuggestionStatus | "">("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "", description: "", kind: "day_activity" as string,
    place_id: "", proposed_start: "", proposed_end: "", est_cost: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // My member record
  const myMemberRecord = members.find((m) => m.user_id === userId)

  // Tally votes per suggestion
  const tallies = useMemo(() => {
    const map: Record<string, { up: number; down: number; myVote: 1 | -1 | null }> = {}
    for (const s of suggestions) {
      map[s.id] = { up: 0, down: 0, myVote: null }
    }
    for (const v of votes) {
      if (!map[v.suggestion_id]) continue
      if (v.vote === 1) map[v.suggestion_id].up++
      else map[v.suggestion_id].down--
      if (myMemberRecord && v.member_id === myMemberRecord.id) {
        map[v.suggestion_id].myVote = v.vote as 1 | -1
      }
    }
    return map
  }, [votes, suggestions, myMemberRecord])

  async function castVote(suggestionId: string, vote: 1 | -1) {
    if (!myMemberRecord) return
    const existing = tallies[suggestionId]?.myVote
    if (existing === vote) {
      // Remove vote
      await fetch(`/api/family/${familyId}/suggestions/${suggestionId}/votes`, { method: "DELETE" })
      setVotes((prev) => prev.filter((v) => !(v.suggestion_id === suggestionId && v.member_id === myMemberRecord.id)))
    } else {
      const res = await fetch(`/api/family/${familyId}/suggestions/${suggestionId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      })
      if (res.ok) {
        const data = await res.json()
        setVotes((prev) => [
          ...prev.filter((v) => !(v.suggestion_id === suggestionId && v.member_id === myMemberRecord.id)),
          data,
        ])
      }
    }
  }

  async function addSuggestion() {
    if (!form.title.trim()) { setError("Title is required"); return }
    setSaving(true); setError("")
    try {
      const { data, error: se } = await supabase.from("fa_suggestions").insert({
        family_id: family.id,
        title: form.title.trim(),
        description: form.description || null,
        kind: form.kind,
        place_id: form.place_id || null,
        proposed_start: form.proposed_start || null,
        proposed_end: form.proposed_end || null,
        est_cost: form.est_cost ? parseFloat(form.est_cost) : null,
        source: "manual",
        status: "suggested",
        created_by: userId,
      }).select().single()
      if (se || !data) { setError(se?.message ?? "Failed to add"); return }
      setSuggestions((prev) => [data as Suggestion, ...prev])
      setForm({ title: "", description: "", kind: "day_activity", place_id: "", proposed_start: "", proposed_end: "", est_cost: "" })
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: SuggestionStatus) {
    const { data } = await supabase.from("fa_suggestions").update({ status }).eq("id", id).select().single()
    if (data) setSuggestions((prev) => prev.map((s) => s.id === id ? data as Suggestion : s))
  }

  async function fetchAiIdeas() {
    setAiLoading(true)
    try {
      const res = await fetch(`/api/family/suggestions/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.suggestions?.length) {
          setSuggestions((prev) => [...json.suggestions, ...prev])
        }
      }
    } finally {
      setAiLoading(false)
    }
  }

  const filtered = filterStatus
    ? suggestions.filter((s) => s.status === filterStatus)
    : suggestions.filter((s) => s.status !== "dismissed")

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
            <span>/</span><span>Suggestions</span>
          </div>
          <h1 className="text-2xl font-bold">Activity Suggestions</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchAiIdeas} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            AI Ideas
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekend camping trip" />
              </div>
              <div className="space-y-1">
                <Label>Kind</Label>
                <div className="flex gap-2 flex-wrap">
                  {KIND_OPTIONS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setForm((f) => ({ ...f, kind: k }))}
                      className={`px-3 py-1.5 rounded text-sm border ${form.kind === k ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                    >
                      {ACTIVITY_KIND_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Linked Place</Label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.place_id}
                  onChange={(e) => setForm((f) => ({ ...f, place_id: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Proposed start</Label>
                <Input type="date" value={form.proposed_start} onChange={(e) => setForm((f) => ({ ...f, proposed_start: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Proposed end</Label>
                <Input type="date" value={form.proposed_end} onChange={(e) => setForm((f) => ({ ...f, proposed_end: e.target.value }))} />
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Details..." />
              </div>
              <div className="space-y-1">
                <Label>Est. cost ($)</Label>
                <Input type="number" value={form.est_cost} onChange={(e) => setForm((f) => ({ ...f, est_cost: e.target.value }))} placeholder="0" />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={addSuggestion} disabled={saving}>{saving ? "Saving..." : "Add Suggestion"}</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus("")}
          className={`px-3 py-1 rounded-full text-sm border ${!filterStatus ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
        >
          Active ({suggestions.filter((s) => s.status !== "dismissed").length})
        </button>
        {SUGGESTION_STATUSES.map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1 rounded-full text-sm border ${filterStatus === st ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
          >
            {SUGGESTION_STATUS_LABELS[st]} ({suggestions.filter((s) => s.status === st).length})
          </button>
        ))}
      </div>

      {/* Suggestions list */}
      <div className="space-y-3">
        {filtered.map((s) => {
          const t = tallies[s.id] ?? { up: 0, down: 0, myVote: null }
          const isExpanded = expandedId === s.id
          return (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Votes */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <button
                      onClick={() => castVote(s.id, 1)}
                      className={`p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${t.myVote === 1 ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <span className={`text-xs font-semibold ${(t.up + t.down) > 0 ? "text-emerald-600" : (t.up + t.down) < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                      {t.up + t.down}
                    </span>
                    <button
                      onClick={() => castVote(s.id, -1)}
                      className={`p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors ${t.myVote === -1 ? "text-rose-500" : "text-muted-foreground"}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground capitalize">{ACTIVITY_KIND_LABELS[s.kind]}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${SUGGESTION_STATUS_STYLES[s.status]}`}>
                            {SUGGESTION_STATUS_LABELS[s.status]}
                          </span>
                          {s.source !== "manual" && (
                            <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                              {s.source === "ai" ? <Sparkles className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                              {s.source}
                            </span>
                          )}
                          {s.score != null && (
                            <span className="text-xs font-semibold text-primary">Score: {Math.round(s.score)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {s.score_breakdown && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                          >
                            Why? {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        )}
                        <select
                          className="text-xs border rounded px-1.5 py-1 bg-background"
                          value={s.status}
                          onChange={(e) => updateStatus(s.id, e.target.value as SuggestionStatus)}
                        >
                          {SUGGESTION_STATUSES.map((st) => (
                            <option key={st} value={st}>{SUGGESTION_STATUS_LABELS[st]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {s.description && <p className="text-sm text-muted-foreground mt-1">{s.description}</p>}

                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                      {s.proposed_start && (
                        <span>{format(new Date(s.proposed_start), "MMM d")}{s.proposed_end ? ` – ${format(new Date(s.proposed_end), "MMM d, yyyy")}` : ""}</span>
                      )}
                      {s.est_cost != null && <span>Est. ${s.est_cost.toLocaleString()}</span>}
                    </div>

                    {/* Score breakdown */}
                    {isExpanded && s.score_breakdown && (
                      <div className="mt-3 bg-muted/50 rounded-lg p-3 text-xs space-y-1.5">
                        <p className="font-semibold mb-1">Score Breakdown</p>
                        {Object.entries(s.score_breakdown as ScoreBreakdown).filter(([k]) => k !== "reasons").map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                            <span className="font-medium">{typeof v === "number" ? Math.round(v as number) : v}</span>
                          </div>
                        ))}
                        {(s.score_breakdown as ScoreBreakdown).reasons?.length > 0 && (
                          <div className="mt-2">
                            <p className="font-semibold mb-1">Why this?</p>
                            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                              {(s.score_breakdown as ScoreBreakdown).reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">
            No suggestions yet — add one or click "AI Ideas" to generate some!
          </p>
        )}
      </div>
    </div>
  )
}

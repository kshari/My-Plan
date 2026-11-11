"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember } from "@/lib/types/family"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Plus, MapPin, X } from "lucide-react"

interface Props {
  families: Family[]
  myMemberships: FamilyMember[]
  userId: string
  userEmail: string
}

export function FamilyListClient({ families, myMemberships, userId, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [showCreate, setShowCreate] = useState(families.length === 0)
  const [name, setName] = useState("")
  const [homeLocation, setHomeLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleCreate() {
    if (!name.trim()) { setError("Family name is required"); return }
    setSaving(true)
    setError("")
    try {
      const { data: family, error: fe } = await supabase
        .from("fa_families")
        .insert({ name: name.trim(), home_location: homeLocation || null, created_by: userId })
        .select()
        .single()
      if (fe || !family) { setError(fe?.message ?? "Failed to create"); return }

      await supabase.from("fa_members").insert({
        family_id: family.id,
        user_id: userId,
        display_name: userEmail.split("@")[0],
        email: userEmail,
        role: "admin",
        status: "active",
        age_band: "adult",
        joined_at: new Date().toISOString(),
      })
      router.push(`/apps/family/${family.id}`)
    } finally {
      setSaving(false)
    }
  }

  const membershipMap = Object.fromEntries(myMemberships.map((m) => [m.family_id, m]))

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Family Activity Planner</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan activities and trips together</p>
        </div>
        {families.length > 0 && (
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showCreate ? "Cancel" : "New Family"}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a Family Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Family Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Smiths" />
            </div>
            <div className="space-y-1">
              <Label>Home Base (City, State)</Label>
              <Input value={homeLocation} onChange={(e) => setHomeLocation(e.target.value)} placeholder="e.g. Austin, TX" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? "Creating..." : "Create Family"}
              </Button>
              {families.length > 0 && (
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {families.length > 0 && (
        <div className="grid gap-4">
          {families.map((f) => {
            const myRole = membershipMap[f.id]?.role ?? "member"
            return (
              <Card
                key={f.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/apps/family/${f.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{f.name}</p>
                      {f.home_location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {f.home_location}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-1 rounded">
                    {myRole}
                  </span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {families.length === 0 && !showCreate && (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No families yet</p>
          <p className="text-sm mt-1">Create a family to start planning together</p>
        </div>
      )}
    </div>
  )
}

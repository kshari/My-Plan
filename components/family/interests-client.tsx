"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Family, FamilyMember, Interest } from "@/lib/types/family"
import {
  INTEREST_TAG_GROUPS, INTEREST_TAG_LABELS, type InterestTag,
} from "@/lib/constants/family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"

interface Props {
  family: Family
  myMember: FamilyMember | null
  members: FamilyMember[]
  initialInterests: Interest[]
  userId: string
}

export function InterestsClient({ family, myMember, members, initialInterests, userId }: Props) {
  const supabase = createClient()
  const [interests, setInterests] = useState<Interest[]>(initialInterests)
  const [activeMemberId, setActiveMemberId] = useState<string>(
    myMember?.id ?? members[0]?.id ?? ""
  )

  const memberInterestMap: Record<string, Record<InterestTag, number>> = {}
  for (const m of members) {
    memberInterestMap[m.id] = {} as Record<InterestTag, number>
  }
  for (const i of interests) {
    if (memberInterestMap[i.member_id]) {
      memberInterestMap[i.member_id][i.tag as InterestTag] = i.weight
    }
  }

  async function toggleTag(tag: InterestTag, weight: number) {
    if (!activeMemberId) return
    const existing = interests.find((i) => i.member_id === activeMemberId && i.tag === tag)

    if (existing) {
      if (existing.weight === weight) {
        // remove
        await supabase.from("fa_interests").delete().eq("id", existing.id)
        setInterests((prev) => prev.filter((i) => i.id !== existing.id))
      } else {
        // update weight
        const { data } = await supabase.from("fa_interests")
          .update({ weight })
          .eq("id", existing.id)
          .select()
          .single()
        if (data) setInterests((prev) => prev.map((i) => i.id === data.id ? data as Interest : i))
      }
    } else {
      const { data } = await supabase.from("fa_interests").insert({
        family_id: family.id,
        member_id: activeMemberId,
        tag,
        weight,
      }).select().single()
      if (data) setInterests((prev) => [...prev, data as Interest])
    }
  }

  const activeMember = members.find((m) => m.id === activeMemberId)

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href={`/apps/family/${family.id}`} className="hover:text-foreground">{family.name}</Link>
          <span>/</span><span>Interests</span>
        </div>
        <h1 className="text-2xl font-bold">Member Interests</h1>
        <p className="text-sm text-muted-foreground mt-1">Select activities each member enjoys — used to generate recommendations.</p>
      </div>

      {/* Member tabs */}
      <div className="flex gap-2 flex-wrap">
        {members.map((m) => {
          const count = Object.keys(memberInterestMap[m.id] ?? {}).length
          return (
            <button
              key={m.id}
              onClick={() => setActiveMemberId(m.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${activeMemberId === m.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
            >
              {m.display_name}
              {count > 0 && <span className="ml-1.5 text-xs opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {activeMember && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            Editing interests for <strong>{activeMember.display_name}</strong> — click a tag to add, click stars to rate 1–5
          </p>
          {INTEREST_TAG_GROUPS.map((group) => (
            <Card key={group.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {group.tags.map((tag) => {
                  const currentWeight = memberInterestMap[activeMemberId]?.[tag]
                  const active = currentWeight != null
                  return (
                    <div key={tag} className="flex items-center gap-1">
                      <button
                        onClick={() => toggleTag(tag, active ? (currentWeight < 5 ? currentWeight + 1 : 1) : 3)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}
                      >
                        {INTEREST_TAG_LABELS[tag]}
                        {active && (
                          <span className="ml-1.5 text-xs font-semibold">
                            {"★".repeat(currentWeight)}
                          </span>
                        )}
                      </button>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import { SCORING_WEIGHTS, MAX_SCORE, type InterestTag } from "@/lib/constants/family"
import type { Place, Interest, Availability, ScoreBreakdown } from "@/lib/types/family"

// ── Place → tags mapping (best-effort)
const PLACE_CATEGORY_TAGS: Record<string, InterestTag[]> = {
  park: ["hiking", "national_parks", "kid_friendly"],
  beach: ["beach", "swimming", "surfing", "kid_friendly"],
  museum: ["museums", "history", "art", "science", "educational"],
  theme_park: ["theme_parks", "kid_friendly", "teen_activities"],
  restaurant: ["food_tours"],
  zoo: ["zoos", "kid_friendly", "educational"],
  aquarium: ["aquariums", "kid_friendly", "educational"],
  ski_resort: ["skiing", "snowboarding", "adventure"],
  water_park: ["water_parks", "swimming", "kid_friendly"],
  campground: ["camping", "hiking", "adventure"],
  city: ["food_tours", "history", "art", "shopping", "international"],
  landmark: ["history", "art", "educational"],
  stadium: ["sports_events"],
  other: [],
}

interface RecoInput {
  place: Place | null
  members: { id: string; age_band: string }[]
  interests: Interest[]
  availability: Availability[]
  proposedStart?: string | null
  proposedEnd?: string | null
  estCost?: number | null
  alreadyDismissed?: boolean
}

export function scoreRecommendation(input: RecoInput): { score: number; breakdown: ScoreBreakdown } {
  const reasons: string[] = []

  // 1. Interest match
  const memberCount = input.members.length || 1
  let totalInterestScore = 0
  if (input.place) {
    const placeTags = PLACE_CATEGORY_TAGS[input.place.category] ?? []
    const memberInterestWeights: number[] = []
    for (const m of input.members) {
      const memberInterests = input.interests.filter((i) => i.member_id === m.id)
      const matched = memberInterests.filter((i) => placeTags.includes(i.tag as InterestTag))
      const totalWeight = matched.reduce((s, i) => s + i.weight, 0)
      const maxWeight = placeTags.length * 5
      memberInterestWeights.push(maxWeight > 0 ? totalWeight / maxWeight : 0)
    }
    const avgMatchFraction = memberInterestWeights.reduce((s, v) => s + v, 0) / memberCount
    totalInterestScore = avgMatchFraction * 100

    if (totalInterestScore > 60) reasons.push(`Matches interests of most family members`)
    else if (totalInterestScore > 30) reasons.push(`Partially matches family interests`)
  } else {
    totalInterestScore = 50 // neutral for manual suggestions without a place
  }

  // 2. Season fit
  let seasonScore = 50
  if (input.place?.best_months && input.proposedStart) {
    const month = new Date(input.proposedStart).getMonth() + 1
    seasonScore = input.place.best_months.includes(month) ? 100 : 20
    if (seasonScore === 100) reasons.push(`${new Date(input.proposedStart).toLocaleString("default", { month: "long" })} is a great time to visit`)
  } else if (input.place?.best_months) {
    const now = new Date().getMonth() + 1
    seasonScore = input.place.best_months.includes(now) ? 100 : 40
    if (seasonScore === 100) reasons.push(`This month is ideal for this destination`)
  }

  // 3. Availability fit
  let availScore = 50
  if (input.proposedStart && input.proposedEnd && input.availability.length > 0) {
    const start = new Date(input.proposedStart)
    const end = new Date(input.proposedEnd)
    const freeWindows = input.availability.filter((a) => a.kind === "free")
    const busyWindows = input.availability.filter((a) => a.kind === "busy")
    const hasFreeOverlap = freeWindows.some(
      (a) => new Date(a.start_ts) <= end && new Date(a.end_ts) >= start
    )
    const hasBusyConflict = busyWindows.some(
      (a) => new Date(a.start_ts) <= end && new Date(a.end_ts) >= start
    )
    if (hasFreeOverlap && !hasBusyConflict) { availScore = 100; reasons.push("Fits well with family availability") }
    else if (hasBusyConflict) { availScore = 10; reasons.push("Conflicts with some family schedules") }
    else { availScore = 50 }
  }

  // 4. Budget fit
  let budgetScore = 70
  if (input.estCost != null && input.place?.price_level != null) {
    const priceCost = input.place.price_level * 100
    budgetScore = input.estCost <= priceCost ? 100 : Math.max(0, 100 - ((input.estCost - priceCost) / priceCost) * 50)
  }

  // 5. Novelty
  const noveltyScore = input.alreadyDismissed ? 0 : 100

  // Weighted total
  const total =
    totalInterestScore * SCORING_WEIGHTS.interestMatch +
    seasonScore * SCORING_WEIGHTS.seasonFit +
    availScore * SCORING_WEIGHTS.availabilityFit +
    budgetScore * SCORING_WEIGHTS.budgetFit +
    noveltyScore * SCORING_WEIGHTS.novelty

  return {
    score: Math.round(Math.min(MAX_SCORE, total)),
    breakdown: {
      interestMatch: Math.round(totalInterestScore),
      seasonFit: Math.round(seasonScore),
      availabilityFit: Math.round(availScore),
      budgetFit: Math.round(budgetScore),
      novelty: Math.round(noveltyScore),
      reasons,
    },
  }
}

/**
 * Given a list of saved places, generates scored suggestion records (not yet persisted).
 */
export function generateRuleBasedSuggestions(
  familyId: string,
  createdBy: string,
  places: Place[],
  members: { id: string; age_band: string }[],
  interests: Interest[],
  availability: Availability[],
): Array<{
  family_id: string
  place_id: string
  title: string
  kind: string
  source: "rule"
  score: number
  score_breakdown: ScoreBreakdown
  status: "suggested"
  created_by: string
}> {
  return places.map((place) => {
    const { score, breakdown } = scoreRecommendation({
      place,
      members,
      interests,
      availability,
    })
    return {
      family_id: familyId,
      place_id: place.id,
      title: `Visit ${place.name}`,
      kind: "day_activity",
      source: "rule" as const,
      score,
      score_breakdown: breakdown,
      status: "suggested" as const,
      created_by: createdBy,
    }
  }).sort((a, b) => b.score - a.score)
}

import type {
  InterestTag, AgeBand, FamilyRole, ActivityKind,
  SuggestionStatus, TripStatus, PlaceCategory,
} from '@/lib/constants/family'

export type { InterestTag, AgeBand, FamilyRole, ActivityKind, SuggestionStatus, TripStatus, PlaceCategory }

export interface Family {
  id: string
  name: string
  home_location: string | null
  home_lat: number | null
  home_lng: number | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string | null
  display_name: string
  email: string | null
  role: FamilyRole
  status: 'active' | 'invited' | 'placeholder' | 'removed'
  age_band: AgeBand
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

export interface Interest {
  id: string
  family_id: string
  member_id: string
  tag: InterestTag
  weight: 1 | 2 | 3 | 4 | 5
  created_at: string
}

export interface Availability {
  id: string
  family_id: string
  member_id: string
  source: 'manual' | 'google'
  kind: 'free' | 'busy'
  start_ts: string
  end_ts: string
  title: string | null
  created_at: string
}

export interface Place {
  id: string
  family_id: string
  name: string
  category: PlaceCategory
  google_place_id: string | null
  address: string | null
  lat: number | null
  lng: number | null
  photo_ref: string | null
  rating: number | null
  price_level: number | null
  best_months: number[] | null
  best_time_of_day: 'morning' | 'afternoon' | 'evening' | 'any' | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface ScoreBreakdown {
  interestMatch: number
  seasonFit: number
  availabilityFit: number
  budgetFit: number
  novelty: number
  reasons: string[]
}

export interface Suggestion {
  id: string
  family_id: string
  place_id: string | null
  title: string
  description: string | null
  kind: ActivityKind
  proposed_start: string | null
  proposed_end: string | null
  est_cost: number | null
  source: 'rule' | 'ai' | 'manual'
  score: number | null
  score_breakdown: ScoreBreakdown | null
  status: SuggestionStatus
  created_by: string
  created_at: string
  place?: Place
}

export interface SuggestionVote {
  id: string
  suggestion_id: string
  member_id: string
  family_id: string
  vote: 1 | -1
  created_at: string
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Trip {
  id: string
  family_id: string
  suggestion_id: string | null
  title: string
  destination: string | null
  start_date: string | null
  end_date: string | null
  status: TripStatus
  attendee_ids: string[] | null
  checklist: ChecklistItem[]
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface FamilyInvitation {
  id: string
  family_id: string
  member_id: string | null
  invited_by: string
  invite_email: string | null
  invite_token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  created_at: string
}

// ── Interest tags ────────────────────────────────────────────────────────────

export const INTEREST_TAGS = [
  // Outdoors
  'hiking', 'camping', 'beach', 'swimming', 'fishing', 'cycling', 'skiing',
  'snowboarding', 'kayaking', 'surfing', 'rock_climbing', 'national_parks',
  // Culture & learning
  'museums', 'history', 'art', 'science', 'theater', 'concerts', 'food_tours',
  // Leisure
  'theme_parks', 'water_parks', 'zoos', 'aquariums', 'sports_events', 'golf',
  'spa', 'shopping', 'movies', 'gaming', 'cooking_classes',
  // Travel style
  'road_trips', 'international', 'cruises', 'backpacking', 'luxury', 'budget',
  // Family-specific
  'kid_friendly', 'teen_activities', 'educational', 'adventure',
] as const
export type InterestTag = (typeof INTEREST_TAGS)[number]

export const INTEREST_TAG_LABELS: Record<InterestTag, string> = {
  hiking: 'Hiking', camping: 'Camping', beach: 'Beach', swimming: 'Swimming',
  fishing: 'Fishing', cycling: 'Cycling', skiing: 'Skiing',
  snowboarding: 'Snowboarding', kayaking: 'Kayaking', surfing: 'Surfing',
  rock_climbing: 'Rock Climbing', national_parks: 'National Parks',
  museums: 'Museums', history: 'History', art: 'Art & Galleries',
  science: 'Science', theater: 'Theater', concerts: 'Concerts',
  food_tours: 'Food Tours', theme_parks: 'Theme Parks',
  water_parks: 'Water Parks', zoos: 'Zoos', aquariums: 'Aquariums',
  sports_events: 'Sports Events', golf: 'Golf', spa: 'Spa & Wellness',
  shopping: 'Shopping', movies: 'Movies', gaming: 'Gaming',
  cooking_classes: 'Cooking Classes', road_trips: 'Road Trips',
  international: 'International Travel', cruises: 'Cruises',
  backpacking: 'Backpacking', luxury: 'Luxury', budget: 'Budget',
  kid_friendly: 'Kid Friendly', teen_activities: 'Teen Activities',
  educational: 'Educational', adventure: 'Adventure',
}

export const INTEREST_TAG_GROUPS: { label: string; tags: InterestTag[] }[] = [
  { label: 'Outdoors', tags: ['hiking','camping','beach','swimming','fishing','cycling','skiing','snowboarding','kayaking','surfing','rock_climbing','national_parks'] },
  { label: 'Culture & Learning', tags: ['museums','history','art','science','theater','concerts','food_tours'] },
  { label: 'Leisure', tags: ['theme_parks','water_parks','zoos','aquariums','sports_events','golf','spa','shopping','movies','gaming','cooking_classes'] },
  { label: 'Travel Style', tags: ['road_trips','international','cruises','backpacking','luxury','budget'] },
  { label: 'Family', tags: ['kid_friendly','teen_activities','educational','adventure'] },
]

// ── Activity kinds ────────────────────────────────────────────────────────────

export const ACTIVITY_KINDS = ['day_activity', 'weekend', 'vacation'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  day_activity: 'Day Activity',
  weekend: 'Weekend Trip',
  vacation: 'Vacation',
}

// ── Age bands ─────────────────────────────────────────────────────────────────

export const AGE_BANDS = ['adult', 'teen', 'child'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  adult: 'Adult',
  teen: 'Teen (13–17)',
  child: 'Child (under 13)',
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export const FAMILY_ROLES = ['admin', 'member', 'observer'] as const
export type FamilyRole = (typeof FAMILY_ROLES)[number]

// ── Statuses ──────────────────────────────────────────────────────────────────

export const SUGGESTION_STATUSES = ['suggested', 'shortlisted', 'planned', 'dismissed'] as const
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number]

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  suggested: 'Suggested',
  shortlisted: 'Shortlisted',
  planned: 'Planned',
  dismissed: 'Dismissed',
}

export const SUGGESTION_STATUS_STYLES: Record<SuggestionStatus, string> = {
  suggested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  shortlisted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  planned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  dismissed: 'bg-muted text-muted-foreground',
}

export const TRIP_STATUSES = ['planning', 'confirmed', 'completed', 'cancelled'] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  planning: 'Planning',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// ── Place categories ──────────────────────────────────────────────────────────

export const PLACE_CATEGORIES = [
  'park', 'beach', 'museum', 'theme_park', 'restaurant', 'hotel',
  'landmark', 'zoo', 'aquarium', 'stadium', 'campground', 'ski_resort',
  'water_park', 'city', 'other',
] as const
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  park: 'Park', beach: 'Beach', museum: 'Museum', theme_park: 'Theme Park',
  restaurant: 'Restaurant', hotel: 'Hotel', landmark: 'Landmark',
  zoo: 'Zoo', aquarium: 'Aquarium', stadium: 'Stadium',
  campground: 'Campground', ski_resort: 'Ski Resort',
  water_park: 'Water Park', city: 'City / Town', other: 'Other',
}

export const PRICE_LEVELS = [0, 1, 2, 3, 4] as const
export type PriceLevel = (typeof PRICE_LEVELS)[number]

export const PRICE_LEVEL_LABELS: Record<PriceLevel, string> = {
  0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$',
}

// ── Month names ───────────────────────────────────────────────────────────────

export const MONTHS = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
] as const

// ── Scoring config ────────────────────────────────────────────────────────────

export const SCORING_WEIGHTS = {
  interestMatch: 0.40,   // how well place tags match member interests
  seasonFit: 0.25,        // best_months overlap with proposed dates
  availabilityFit: 0.20,  // free window alignment
  budgetFit: 0.10,        // est_cost vs family budget preference
  novelty: 0.05,          // not recently dismissed
} as const

export const MAX_SCORE = 100

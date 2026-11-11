/**
 * Property analysis default values.
 * Single source of truth for property-related defaults.
 */

// ── Loan Defaults ──
export const DEFAULT_INTEREST_RATE_MIN = 4.0
export const DEFAULT_INTEREST_RATE_MAX = 7.0
/** Default rate for dashboard ROI / quick analysis (e.g. 25% down model). */
export const DEFAULT_ANALYSIS_INTEREST_RATE = 6.0
export const DEFAULT_DOWN_PAYMENT_PCT = 25
export const DEFAULT_DOWN_PAYMENT_MIN = 20
export const DEFAULT_DOWN_PAYMENT_MAX = 30
export const DEFAULT_CLOSING_COST_PCT = 3
/** Buyer-side purchase closing costs (title, transfer taxes, inspection, recording). */
export const DEFAULT_PURCHASE_CLOSING_COST_PCT = 2  // % of purchase price
/** Loan-specific closing costs (origination, appraisal, points). */
export const DEFAULT_LOAN_CLOSING_COST_PCT = 1      // % of loan amount
/** Default sale cost (realtor commission + closing) as % of sale price. Applied to IRR sale proceeds. */
export const DEFAULT_SALE_COST_PCT = 7
export const LOAN_TERMS = [15, 20, 30] as const
export const DEFAULT_LOAN_TERM = 30
export const MAX_INTEREST_RATE_SLIDER = 15
export const MAX_DOWN_PAYMENT_SLIDER = 50

// ── Scenario Analysis Ranges ──
export const DEFAULT_PRICE_CHANGE_MIN = -15
export const DEFAULT_PRICE_CHANGE_MAX = 10
export const DEFAULT_INCOME_CHANGE_MIN = -10
export const DEFAULT_INCOME_CHANGE_MAX = 10
export const DEFAULT_EXPENSE_CHANGE_MIN = -10
export const DEFAULT_EXPENSE_CHANGE_MAX = 10
export const SLIDER_RANGE_MIN = -20
export const SLIDER_RANGE_MAX_PRICE = 30
export const SLIDER_RANGE_MAX_INCOME_EXPENSE = 20

// ── Default Property Values (fallbacks) ──
export const DEFAULT_ASKING_PRICE = 1_000_000
export const DEFAULT_GROSS_INCOME = 120_000
export const DEFAULT_OPERATING_EXPENSES = 40_000
/** Default expense ratio (e.g. 40%) when deriving Est. NOI from estimated rent only. */
export const DEFAULT_EXPENSE_RATIO = 0.4

// ── Calculation Constants ──
export const IRR_INITIAL_GUESS = 0.1
export const IRR_TOLERANCE = 0.0001
export const IRR_MAX_ITERATIONS = 100
export const BALANCE_THRESHOLD = 0.01
export const SCENARIO_COMPARISON_TOLERANCE = 0.01
export const THRESHOLD_ANALYSIS_STEP = 0.1
export const SLIDER_STEP = 0.5
export const THRESHOLD_ANALYSIS_RANGE = 50
export const THRESHOLD_ANALYSIS_MAX_RATE = 15
export const MONTHS_PER_YEAR = 12

// ── Property Types ──
export const PROPERTY_TYPES = [
  'Single Family',
  'Multi Family',
  'Apartment',
  'Commercial',
  'Other',
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

// ── Property status (for list filter and forms: Available, Sold, Leased) ──
export const PROPERTY_STATUSES = ['Available', 'Sold', 'Leased'] as const
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number]

/** @deprecated Use PROPERTY_STATUSES for new code. Kept for backward compatibility with existing listing_status values in DB. */
export const LISTING_STATUSES = [...PROPERTY_STATUSES] as const
export type ListingStatus = PropertyStatus

// ── Deal Lifecycle Stages ──────────────────────────────────────────────────────

export const DEAL_STAGES = [
  'lead', 'analyzing', 'offer', 'contract', 'closing',
  'rehab', 'market', 'operate', 'exit', 'dead',
] as const
export type DealStage = (typeof DEAL_STAGES)[number]

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead:      'Lead',
  analyzing: 'Underwriting',
  offer:     'Offer / Negotiate',
  contract:  'Under Contract',
  closing:   'Closing',
  rehab:     'Renovation',
  market:    'Lease-Up / List',
  operate:   'Managing',
  exit:      'Exited / Sold',
  dead:      'Dead / Passed',
}

export const DEAL_STAGE_DESCRIPTIONS: Record<DealStage, string> = {
  lead:      'Potential deal identified — sourcing, initial review, contact established.',
  analyzing: 'Running the numbers — underwriting, scenario modeling, cap rate, IRR.',
  offer:     'Offer submitted or under negotiation with seller.',
  contract:  'Under contract — due diligence period in progress.',
  closing:   'DD complete, financing locked — moving toward settlement.',
  rehab:     'Property owned — renovation or make-ready work in progress.',
  market:    'Renovation done — listing for rent or sale.',
  operate:   'Tenants in place — active management, rent collection, maintenance.',
  exit:      'Property sold, portfolio closed, or deal fully wound down.',
  dead:      'Deal passed, rejected, or no longer pursued.',
}

/** Badge color classes per stage. Used in pipeline board and lists. */
export const DEAL_STAGE_BADGE_STYLES: Record<DealStage, string> = {
  lead:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  analyzing: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  offer:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  contract:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  closing:   'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  rehab:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  market:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  operate:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  exit:      'bg-muted text-muted-foreground',
  dead:      'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

/** Active pipeline stages (excludes terminal stages exit/dead). */
export const ACTIVE_DEAL_STAGES = DEAL_STAGES.filter(
  (s) => s !== 'exit' && s !== 'dead'
) as DealStage[]

// ── Contact Types ─────────────────────────────────────────────────────────────

export const CONTACT_TYPES = [
  'agent', 'lender', 'contractor', 'property_manager',
  'inspector', 'attorney', 'title', 'appraiser',
  'insurance', 'tenant', 'wholesaler', 'other',
] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  agent:             'Agent / Realtor',
  lender:            'Lender / Mortgage',
  contractor:        'Contractor',
  property_manager:  'Property Manager',
  inspector:         'Inspector',
  attorney:          'Attorney',
  title:             'Title Company',
  appraiser:         'Appraiser',
  insurance:         'Insurance',
  tenant:            'Tenant',
  wholesaler:        'Wholesaler',
  other:             'Other',
}

// ── Stage checklist templates (seeded when entering a stage) ─────────────────

export const STAGE_CHECKLIST_TEMPLATES: Partial<Record<DealStage, Array<{ title: string; kind: 'task' | 'milestone' }>>> = {
  analyzing: [
    { title: 'Pull comparable sales (comps)', kind: 'task' },
    { title: 'Run cap rate & cash-on-cash scenarios', kind: 'task' },
    { title: 'Estimate rehab budget', kind: 'task' },
    { title: 'Verify rental market rents', kind: 'task' },
  ],
  offer: [
    { title: 'Draft and submit offer', kind: 'milestone' },
    { title: 'Review seller counteroffer', kind: 'task' },
    { title: 'Confirm financing pre-approval', kind: 'task' },
  ],
  contract: [
    { title: 'Order home inspection', kind: 'task' },
    { title: 'Order appraisal', kind: 'task' },
    { title: 'Open title / escrow', kind: 'task' },
    { title: 'Secure financing / rate lock', kind: 'milestone' },
    { title: 'Review title report', kind: 'task' },
    { title: 'Confirm insurance quote', kind: 'task' },
    { title: 'DD deadline', kind: 'milestone' },
  ],
  closing: [
    { title: 'Final walkthrough', kind: 'task' },
    { title: 'Sign closing documents', kind: 'milestone' },
    { title: 'Wire funds / down payment', kind: 'milestone' },
    { title: 'Record deed', kind: 'milestone' },
  ],
  rehab: [
    { title: 'Get contractor bids', kind: 'task' },
    { title: 'Award contracts', kind: 'task' },
    { title: 'Rehab start', kind: 'milestone' },
    { title: 'Mid-project walk', kind: 'task' },
    { title: 'Final inspection / punchlist', kind: 'task' },
    { title: 'Rehab complete', kind: 'milestone' },
  ],
  market: [
    { title: 'List property / market for rent', kind: 'milestone' },
    { title: 'Schedule showings', kind: 'task' },
    { title: 'Screen tenants / qualify buyers', kind: 'task' },
    { title: 'Execute lease / PSA', kind: 'milestone' },
  ],
  operate: [
    { title: 'Tenant move-in', kind: 'milestone' },
    { title: 'Set up rent collection', kind: 'task' },
    { title: 'Assign property manager', kind: 'task' },
  ],
}

// ── Rehab categories ─────────────────────────────────────────────────────────

export const REHAB_CATEGORIES = [
  'Roof', 'HVAC', 'Plumbing', 'Electrical', 'Kitchen',
  'Bathrooms', 'Flooring', 'Painting', 'Windows / Doors',
  'Foundation / Structural', 'Landscaping', 'Other',
] as const
export type RehabCategory = (typeof REHAB_CATEGORIES)[number]

export const REHAB_STATUSES = ['planned', 'in_progress', 'done'] as const
export type RehabStatus = (typeof REHAB_STATUSES)[number]

// ── Lease statuses ────────────────────────────────────────────────────────────

export const LEASE_STATUSES = ['upcoming', 'active', 'expired', 'terminated'] as const
export type LeaseStatus = (typeof LEASE_STATUSES)[number]

// ── Work order statuses ────────────────────────────────────────────────────────

export const WORK_ORDER_STATUSES = ['open', 'in_progress', 'closed'] as const
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number]

// ── Rent payment statuses ─────────────────────────────────────────────────────

export const RENT_PAYMENT_STATUSES = ['due', 'paid', 'late', 'waived'] as const
export type RentPaymentStatus = (typeof RENT_PAYMENT_STATUSES)[number]

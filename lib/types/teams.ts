export interface Team {
  id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface TeamInvitation {
  id: string
  team_id: string
  invited_by: string
  invite_email: string | null
  invite_token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  created_at: string
}

export interface PropertyExpenseBreakdown {
  property_taxes?: number | null
  insurance?: number | null
  cdd?: number | null
  hoa?: number | null
  maintenance?: number | null
  property_management?: number | null
  other?: number | null
}

export interface SharedProperty {
  id: number
  team_id: string
  shared_by: string
  shared_at: string
  last_updated_by: string | null
  source_property_id: number | null
  address: string | null
  city: string | null
  county: string | null
  type: string | null
  'Number of Units': number | null
  'Has HOA': boolean | null
  swimming_pool: boolean | null
  'Asking Price': number | null
  current_market_value: number | null
  listing_status: string | null
  source: string | null
  mls_number: string | null
  listing_url: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  lot_size: string | null
  community: string | null
  plan_name: string | null
  notes: string | null
  additional_info: string | null
  created_at: string
  /** Financial fields populated by joining the base scenario (not stored on the property row) */
  'Gross Income'?: number | null
  'Operating Expenses'?: number | null
  estimated_rent?: number | null
  estimated_cash_flow?: number | null
}

/** A financial scenario row (pi_financial_scenarios or team_shared_scenarios) */
export interface Scenario {
  id: number
  'Scenario Name': string | null
  'Purchase Price': number | null
  'Current Market Value': number | null
  'Gross Income': number | null
  'Operating Expenses': number | null
  'Vacancy Rate': number | null
  'Property Management Rate': number | null
  'Income Increase': number | null
  'Expenses Increase': number | null
  'Property Value Increase': number | null
  'Has Loan': boolean | null
  'Down Payment Percentage': number | null
  'Down Payment Amount': number | null
  'Interest Rate': number | null
  'Loan Term': number | null
  'Closing Costs': number | null
  'Purchase Closing Costs': number | null
  expense_breakdown: PropertyExpenseBreakdown | null
  is_base: boolean
  created_at: string
}

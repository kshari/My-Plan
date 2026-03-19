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
  'Gross Income': number | null
  'Operating Expenses': number | null
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
  estimated_rent: number | null
  estimated_cash_flow: number | null
  notes: string | null
  additional_info: string | null
  created_at: string
}

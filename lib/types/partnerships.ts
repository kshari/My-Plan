// ─── Partnerships Module Types ─────────────────────────────────────────────

export type EntityType = 'llc' | 'lp' | 'corporation' | 'trust' | 'informal' | 'other'
export type EntityStatus = 'forming' | 'active' | 'dissolved'
export type MemberRole = 'admin' | 'member' | 'observer'
export type MemberStatus = 'active' | 'invited' | 'placeholder' | 'removed'
export type MembershipStatus = 'pending' | 'confirmed' | 'declined'
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export type InvestmentType = 'real_estate' | 'private_equity' | 'stock' | 'business' | 'fund' | 'other'
export type InvestmentStatus = 'active' | 'on_hold' | 'exited' | 'cancelled'
export type WorkflowStage = 'ideation' | 'due_diligence' | 'decision' | 'capital_collection' | 'execution' | 'management' | 'exit'
export type TransactionType = 'income' | 'expense' | 'capital_call' | 'distribution' | 'transfer'
export type CapitalCallStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type DistributionType = 'return_of_capital' | 'profit' | 'guaranteed_payment'
export type DecisionType = 'vote' | 'discussion' | 'announcement'
export type VotingMethod = 'simple_majority' | 'supermajority' | 'unanimous' | 'weighted'
export type DecisionStatus = 'draft' | 'open' | 'closed' | 'approved' | 'rejected'
export type DocType = 'k1' | 'operating_agreement' | 'subscription_agreement' | 'tax_return' | 'receipt' | 'contract' | 'statement' | 'other'
export type CapitalEventType = 'contribution' | 'distribution' | 'return_of_capital' | 'fee' | 'correction'

export interface PartnershipEntity {
  id: string
  name: string
  entity_type: EntityType
  description: string | null
  state_of_formation: string | null
  ein: string | null
  formation_date: string | null
  fiscal_year_end: string | null
  status: EntityStatus
  cash_balance: number
  cash_balance_as_of: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface PartnershipMember {
  id: string
  entity_id: string
  user_id: string | null
  display_name: string
  email: string | null
  role: MemberRole
  ownership_pct: number
  status: MemberStatus
  membership_status: MembershipStatus
  name_confirmed: boolean
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

export interface PartnershipInvitation {
  id: string
  entity_id: string
  member_id: string | null
  invited_by: string
  invite_email: string | null
  invite_token: string
  status: InvitationStatus
  expires_at: string
  created_at: string
}

export interface PartnershipInvestment {
  id: string
  entity_id: string
  name: string
  investment_type: InvestmentType
  description: string | null
  investment_manager: string | null
  ticker: string | null
  target_amount: number | null
  num_shares: number | null
  market_price_per_share: number | null
  current_stage: WorkflowStage
  status: InvestmentStatus
  acquired_date: string | null
  exit_date: string | null
  exit_amount: number | null
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export interface InvestmentStage {
  id: string
  investment_id: string
  stage: WorkflowStage
  entered_at: string
  entered_by: string
  notes: string | null
}

export interface PartnershipTransaction {
  id: string
  entity_id: string
  investment_id: string | null
  type: TransactionType
  category: string | null
  description: string | null
  amount: number
  transaction_date: string
  recorded_by: string
  receipt_document_id: string | null
  created_at: string
}

export interface CapitalCall {
  id: string
  entity_id: string
  investment_id: string | null
  member_id: string
  amount: number
  due_date: string | null
  status: CapitalCallStatus
  paid_amount: number
  paid_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Distribution {
  id: string
  entity_id: string
  investment_id: string | null
  member_id: string
  amount: number
  distribution_date: string
  type: DistributionType
  notes: string | null
  created_by: string
  created_at: string
}

export interface CapTableEntry {
  id: string
  entity_id: string
  member_id: string
  ownership_pct: number
  capital_contributed: number
  distributions_received: number
  effective_date: string
  notes: string | null
  recorded_by: string
  created_at: string
}

export interface PartnershipDecision {
  id: string
  entity_id: string
  investment_id: string | null
  title: string
  description: string | null
  decision_type: DecisionType
  voting_method: VotingMethod
  status: DecisionStatus
  deadline: string | null
  outcome: string | null
  created_by: string
  created_at: string
  closed_at: string | null
}

export interface DecisionOption {
  id: string
  decision_id: string
  label: string
  sort_order: number
}

export interface Vote {
  id: string
  decision_id: string
  option_id: string
  member_id: string
  weight: number | null
  comment: string | null
  voted_at: string
}

export interface DecisionComment {
  id: string
  decision_id: string
  member_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface PartnershipDocument {
  id: string
  entity_id: string
  investment_id: string | null
  name: string
  doc_type: DocType
  storage_path: string
  file_size: number | null
  mime_type: string | null
  tax_year: number | null
  uploaded_by: string
  created_at: string
}

export interface CapitalEvent {
  id: string
  entity_id: string
  member_id: string
  event_type: CapitalEventType
  amount: number
  effective_date: string
  investment_id: string | null
  capital_call_id: string | null
  notes: string | null
  recorded_by: string
  created_at: string
}

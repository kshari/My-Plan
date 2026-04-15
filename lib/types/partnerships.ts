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

// ─── Accounting Types ─────────────────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type AccountSubtype =
  | 'cash' | 'ar' | 'investment' | 'prepaid' | 'fixed_asset' | 'other_asset'
  | 'ap' | 'note_payable' | 'accrued' | 'deferred_rev' | 'other_liab'
  | 'partner_capital' | 'retained_earnings' | 'current_income'
  | 'revenue' | 'capital_gain' | 'other_income'
  | 'operating_expense' | 'interest_expense' | 'tax_expense' | 'depreciation' | 'other_expense'
  | 'cogs'

export type JournalEntryStatus = 'draft' | 'posted' | 'voided'
export type JournalEntryType = 'manual' | 'closing'
export type CapitalMethod = 'tax' | 'GAAP' | 'section704' | 'other'

export interface FiscalYear {
  id: string
  entity_id: string
  label: string
  start_date: string
  end_date: string
  tax_year: number
  is_closed: boolean
  closed_at: string | null
  created_by: string
  created_at: string
}

export interface Account {
  id: string
  entity_id: string
  account_code: string
  name: string
  type: AccountType
  subtype: AccountSubtype | null
  parent_id: string | null
  member_id: string | null
  is_system: boolean
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  // joined
  member?: { display_name: string } | null
  children?: Account[]
}

export interface JournalLine {
  id: string
  journal_entry_id: string
  entity_id: string
  account_id: string
  debit: number
  credit: number
  memo: string | null
  line_order: number
  // joined
  account?: Account
}

export interface JournalEntry {
  id: string
  entity_id: string
  fiscal_year_id: string | null
  entry_date: string
  description: string
  status: JournalEntryStatus
  entry_type: JournalEntryType
  reference_type: string | null
  reference_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  // joined
  lines?: JournalLine[]
  fiscal_year?: FiscalYear | null
}

export interface K1JsonItem {
  code: string
  description: string
  amount: number
}

export interface K1Allocation {
  id: string
  entity_id: string
  member_id: string
  fiscal_year_id: string
  ownership_pct: number
  capital_method: CapitalMethod
  // Capital account analysis
  beginning_capital: number
  contributions: number
  net_income_allocated: number
  withdrawals: number
  ending_capital: number
  // K-1 boxes
  box_1_ordinary_income: number
  box_2_net_rental_re_income: number
  box_3_other_net_rental_income: number
  box_4_guaranteed_payments_svc: number
  box_5_guaranteed_payments_cap: number
  box_6_net_1231_gain: number
  box_7_other_income: number
  box_9a_lt_capital_gain: number
  box_9b_collectibles_gain: number
  box_9c_unrec_1250_gain: number
  box_10_net_1231_gain_28: number
  box_11_other_income_loss: K1JsonItem[]
  box_12_section_179: number
  box_13_other_deductions: K1JsonItem[]
  box_15_credits: K1JsonItem[]
  box_17_amt_items: K1JsonItem[]
  box_18_tax_exempt: K1JsonItem[]
  box_19a_distributions_cash: number
  box_19c_distributions_prop: number
  box_20_other_info: K1JsonItem[]
  // Status
  is_final: boolean
  finalized_at: string | null
  notes: string | null
  generated_by: string | null
  generated_at: string
  created_at: string
  // joined
  member?: { display_name: string; email: string | null }
  fiscal_year?: FiscalYear
}

// ─── Report types (computed, not persisted) ───────────────────────────────────

export interface ReportLineItem {
  account_id: string
  account_code: string
  name: string
  subtype: AccountSubtype | null
  balance: number          // positive = normal balance direction
  debit_total: number
  credit_total: number
  indent: number           // 0 = section header, 1 = account, 2 = sub-account
}

export interface ReportSection {
  title: string
  lines: ReportLineItem[]
  total: number
}

export interface BalanceSheetReport {
  as_of: string
  assets: ReportSection[]
  assets_total: number
  liabilities: ReportSection[]
  liabilities_total: number
  equity: ReportSection[]
  equity_total: number
  liabilities_equity_total: number
  is_balanced: boolean
}

export interface IncomeStatementReport {
  start_date: string
  end_date: string
  revenue: ReportSection[]
  revenue_total: number
  expenses: ReportSection[]
  expenses_total: number
  net_income: number
}

export interface CashFlowReport {
  start_date: string
  end_date: string
  operating: { label: string; amount: number }[]
  operating_total: number
  investing: { label: string; amount: number }[]
  investing_total: number
  financing: { label: string; amount: number }[]
  financing_total: number
  net_change: number
  beginning_cash: number
  ending_cash: number
}

export interface PartnersCapitalRow {
  member_id: string
  member_name: string
  ownership_pct: number
  beginning_capital: number
  contributions: number
  net_income_allocated: number
  distributions: number
  ending_capital: number
}

export interface PartnersCapitalReport {
  start_date: string
  end_date: string
  rows: PartnersCapitalRow[]
  totals: Omit<PartnersCapitalRow, 'member_id' | 'member_name' | 'ownership_pct'>
}

export interface TrialBalanceLine {
  account_id: string
  account_code: string
  name: string
  type: AccountType
  debit_total: number
  credit_total: number
  net_debit: number
  net_credit: number
}

export interface TrialBalanceReport {
  as_of: string
  lines: TrialBalanceLine[]
  total_debits: number
  total_credits: number
  is_balanced: boolean
}

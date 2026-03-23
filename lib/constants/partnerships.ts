// ─── Partnerships Module Constants ─────────────────────────────────────────

import type { EntityType, WorkflowStage, InvestmentType, DocType, DecisionType, VotingMethod } from '@/lib/types/partnerships'

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  llc: 'LLC',
  lp: 'Limited Partnership (LP)',
  corporation: 'Corporation',
  trust: 'Trust',
  informal: 'Informal Group',
  other: 'Other',
}

export const ENTITY_TYPES = Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
})) as { value: EntityType; label: string }[]

export const WORKFLOW_STAGES: WorkflowStage[] = [
  'ideation',
  'due_diligence',
  'decision',
  'capital_collection',
  'execution',
  'management',
  'exit',
]

export const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  ideation: 'Ideation',
  due_diligence: 'Due Diligence',
  decision: 'Decision',
  capital_collection: 'Capital Collection',
  execution: 'Execution',
  management: 'Management',
  exit: 'Exit',
}

export const WORKFLOW_STAGE_DESCRIPTIONS: Record<WorkflowStage, string> = {
  ideation: 'Investment idea being explored and shared with the group',
  due_diligence: 'Researching the opportunity — financials, legal, market analysis',
  decision: 'Group is voting on whether to proceed',
  capital_collection: 'Investment approved — collecting capital contributions from members',
  execution: 'Capital collected — closing, onboarding, or purchasing',
  management: 'Investment is active and being managed',
  exit: 'Investment has been sold, liquidated, or wound down',
}

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  real_estate: 'Real Estate',
  private_equity: 'Private Equity',
  stock: 'Public Stock',
  business: 'New Business',
  fund: 'Fund',
  other: 'Other',
}

export const INVESTMENT_TYPES = Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
})) as { value: InvestmentType; label: string }[]

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  k1: 'K-1 Tax Form',
  operating_agreement: 'Operating Agreement',
  subscription_agreement: 'Subscription Agreement',
  tax_return: 'Tax Return',
  receipt: 'Receipt',
  contract: 'Contract',
  statement: 'Financial Statement',
  other: 'Other',
}

export const DOC_TYPES = Object.entries(DOC_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
})) as { value: DocType; label: string }[]

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  vote: 'Formal Vote',
  discussion: 'Discussion',
  announcement: 'Announcement',
}

export const VOTING_METHOD_LABELS: Record<VotingMethod, string> = {
  simple_majority: 'Simple Majority (>50%)',
  supermajority: 'Supermajority (>66%)',
  unanimous: 'Unanimous (100%)',
  weighted: 'Weighted by Ownership %',
}

export const TRANSACTION_CATEGORIES = {
  income: [
    'Rental Income',
    'Dividend',
    'Interest',
    'Capital Gain',
    'Business Revenue',
    'Other Income',
  ],
  expense: [
    'Legal & Formation',
    'Accounting & Tax',
    'Property Management',
    'Maintenance & Repair',
    'Insurance',
    'HOA',
    'Property Tax',
    'Utilities',
    'Marketing',
    'Other Expense',
  ],
}

export const PARTNERSHIPS_ROOT = '/apps/partnerships'
export const PARTNERSHIPS_STORAGE_BUCKET = 'partnership-documents'

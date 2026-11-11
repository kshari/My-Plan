import type { DealStage, ContactType, RehabStatus, LeaseStatus, WorkOrderStatus, RentPaymentStatus } from '@/lib/constants/property-defaults'

export type { DealStage, ContactType, RehabStatus, LeaseStatus, WorkOrderStatus, RentPaymentStatus }

// ── Contact ───────────────────────────────────────────────────────────────────

export interface Contact {
  id: string
  user_id: string
  name: string
  contact_type: ContactType
  company: string | null
  email: string | null
  phone: string | null
  market: string | null
  rating: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Deal contact (join) ───────────────────────────────────────────────────────

export interface DealContact {
  id: string
  property_id: number
  contact_id: string
  user_id: string
  role: string | null
  notes: string | null
  created_at: string
  contact?: Contact
}

// ── Deal stage history ────────────────────────────────────────────────────────

export interface DealStageHistoryEntry {
  id: string
  property_id: number
  user_id: string
  stage: DealStage
  entered_at: string
  entered_by: string
  notes: string | null
}

// ── Deal task ─────────────────────────────────────────────────────────────────

export interface DealTask {
  id: string
  property_id: number
  user_id: string
  title: string
  description: string | null
  stage: DealStage | null
  kind: 'task' | 'milestone'
  due_date: string | null
  completed: boolean
  completed_at: string | null
  sort_order: number
  created_at: string
}

// ── Rehab item ────────────────────────────────────────────────────────────────

export interface RehabItem {
  id: string
  property_id: number
  user_id: string
  category: string
  description: string
  contractor_contact_id: string | null
  budget_amount: number
  actual_amount: number | null
  status: RehabStatus
  sort_order: number
  created_at: string
  updated_at: string
  contractor?: Contact
}

// ── Lease ─────────────────────────────────────────────────────────────────────

export interface Lease {
  id: string
  property_id: number
  user_id: string
  unit_label: string | null
  tenant_contact_id: string | null
  monthly_rent: number
  deposit: number | null
  start_date: string
  end_date: string | null
  status: LeaseStatus
  notes: string | null
  created_at: string
  updated_at: string
  tenant?: Contact
}

// ── Rent payment ──────────────────────────────────────────────────────────────

export interface RentPayment {
  id: string
  lease_id: string
  user_id: string
  due_date: string
  amount: number
  paid_date: string | null
  status: RentPaymentStatus
  notes: string | null
  created_at: string
}

// ── Work order ────────────────────────────────────────────────────────────────

export interface WorkOrder {
  id: string
  property_id: number
  user_id: string
  title: string
  description: string | null
  contractor_contact_id: string | null
  cost: number | null
  status: WorkOrderStatus
  opened_at: string
  closed_at: string | null
  created_at: string
  updated_at: string
  contractor?: Contact
}

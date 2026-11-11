-- Property Investor Lifecycle
-- Adds deal-stage machine, contacts/network, tasks, rehab, leases, rent payments, work orders

-- ── 1. Contacts directory (must be created before pi_properties FK) ──────────

CREATE TABLE IF NOT EXISTS pi_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  contact_type text NOT NULL DEFAULT 'other'
               CHECK (contact_type IN ('agent','lender','contractor','property_manager','inspector',
                                       'attorney','title','appraiser','insurance','tenant',
                                       'wholesaler','other')),
  company      text,
  email        text,
  phone        text,
  market       text,
  rating       smallint CHECK (rating BETWEEN 1 AND 5),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON pi_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_contacts_user_id ON pi_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_pi_contacts_type ON pi_contacts(user_id, contact_type);

-- ── 2. Extend pi_properties with lifecycle fields ─────────────────────────────

ALTER TABLE pi_properties
  ADD COLUMN IF NOT EXISTS deal_stage        text NOT NULL DEFAULT 'lead'
    CHECK (deal_stage IN ('lead','analyzing','offer','contract','closing','rehab','market','operate','exit','dead')),
  ADD COLUMN IF NOT EXISTS stage_updated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS source_contact_id uuid REFERENCES pi_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pi_properties_deal_stage ON pi_properties(user_id, deal_stage);

-- ── 3. Deal stage history ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_deal_stage_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage       text NOT NULL
              CHECK (stage IN ('lead','analyzing','offer','contract','closing','rehab','market','operate','exit','dead')),
  entered_at  timestamptz NOT NULL DEFAULT now(),
  entered_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes       text
);

ALTER TABLE pi_deal_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stage history" ON pi_deal_stage_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_stage_history_prop ON pi_deal_stage_history(property_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_stage_history_user ON pi_deal_stage_history(user_id);

-- ── 4. Deal contacts (link professionals to a deal) ───────────────────────────

CREATE TABLE IF NOT EXISTS pi_deal_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES pi_contacts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, contact_id)
);

ALTER TABLE pi_deal_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal contacts" ON pi_deal_contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_contacts_prop ON pi_deal_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_contacts_contact ON pi_deal_contacts(contact_id);

-- ── 5. Deal tasks / milestones ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_deal_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  stage        text CHECK (stage IN ('lead','analyzing','offer','contract','closing','rehab','market','operate','exit','dead')),
  kind         text NOT NULL DEFAULT 'task' CHECK (kind IN ('task','milestone')),
  due_date     date,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_deal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deal tasks" ON pi_deal_tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_tasks_prop ON pi_deal_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_pi_deal_tasks_user ON pi_deal_tasks(user_id);

-- ── 6. Rehab / renovation items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_rehab_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category              text NOT NULL DEFAULT 'other',
  description           text NOT NULL,
  contractor_contact_id uuid REFERENCES pi_contacts(id) ON DELETE SET NULL,
  budget_amount         numeric(12,2) NOT NULL DEFAULT 0,
  actual_amount         numeric(12,2),
  status                text NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned','in_progress','done')),
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_rehab_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rehab items" ON pi_rehab_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_rehab_items_prop ON pi_rehab_items(property_id);

-- ── 7. Leases ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_leases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id        bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_label         text,
  tenant_contact_id  uuid REFERENCES pi_contacts(id) ON DELETE SET NULL,
  monthly_rent       numeric(10,2) NOT NULL DEFAULT 0,
  deposit            numeric(10,2),
  start_date         date NOT NULL,
  end_date           date,
  status             text NOT NULL DEFAULT 'upcoming'
                     CHECK (status IN ('upcoming','active','expired','terminated')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leases" ON pi_leases
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_leases_prop ON pi_leases(property_id);
CREATE INDEX IF NOT EXISTS idx_pi_leases_user ON pi_leases(user_id);

-- ── 8. Rent payments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_rent_payments (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id  uuid NOT NULL REFERENCES pi_leases(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date  date NOT NULL,
  amount    numeric(10,2) NOT NULL,
  paid_date date,
  status    text NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','late','waived')),
  notes     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rent payments" ON pi_rent_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_rent_payments_lease ON pi_rent_payments(lease_id);

-- ── 9. Work orders ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pi_work_orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id           bigint NOT NULL REFERENCES pi_properties(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text,
  contractor_contact_id uuid REFERENCES pi_contacts(id) ON DELETE SET NULL,
  cost                  numeric(10,2),
  status                text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','closed')),
  opened_at             timestamptz NOT NULL DEFAULT now(),
  closed_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pi_work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own work orders" ON pi_work_orders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_pi_work_orders_prop ON pi_work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_pi_work_orders_user ON pi_work_orders(user_id);

-- ── 10. Backfill deal_stage from listing_status ───────────────────────────────

UPDATE pi_properties
SET deal_stage = CASE
  WHEN listing_status = 'Sold'   THEN 'exit'
  WHEN listing_status = 'Leased' THEN 'operate'
  ELSE 'lead'
END,
stage_updated_at = now()
WHERE deal_stage = 'lead';

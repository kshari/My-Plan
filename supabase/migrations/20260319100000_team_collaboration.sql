-- ─── Team Collaboration for Property Sharing ─────────────────────────────────
-- Tables: teams, team_members, team_invitations,
--         team_shared_properties, team_shared_scenarios, team_shared_loans
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- 2. team_members ──────────────────────────────────────────────────────────────
CREATE TABLE team_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- 3. team_invitations ──────────────────────────────────────────────────────────
CREATE TABLE team_invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email text,
  invite_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 4. team_shared_properties ────────────────────────────────────────────────────
-- Mirrors pi_properties but team-scoped instead of user-scoped
CREATE TABLE team_shared_properties (
  id                   serial PRIMARY KEY,
  team_id              uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- provenance
  shared_by            uuid NOT NULL REFERENCES auth.users(id),
  shared_at            timestamptz NOT NULL DEFAULT now(),
  last_updated_by      uuid REFERENCES auth.users(id),
  source_property_id   integer,  -- reference to originating pi_properties.id (informational)
  -- property fields (mirrors pi_properties)
  address              text,
  city                 text,
  county               text,
  type                 text,
  "Number of Units"    integer,
  "Has HOA"            boolean,
  swimming_pool        boolean,
  "Asking Price"       numeric,
  "Gross Income"       numeric,
  "Operating Expenses" numeric,
  listing_status       text,
  source               text,
  mls_number           text,
  listing_url          text,
  bedrooms             integer,
  bathrooms            numeric,
  sqft                 numeric,
  lot_size             text,
  community            text,
  plan_name            text,
  estimated_rent       numeric,
  estimated_cash_flow  numeric,
  notes                text,
  additional_info      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_shared_properties ENABLE ROW LEVEL SECURITY;

-- 5. team_shared_scenarios ─────────────────────────────────────────────────────
CREATE TABLE team_shared_scenarios (
  id                          serial PRIMARY KEY,
  shared_property_id          integer NOT NULL REFERENCES team_shared_properties(id) ON DELETE CASCADE,
  shared_by                   uuid NOT NULL REFERENCES auth.users(id),
  last_updated_by             uuid REFERENCES auth.users(id),
  "Scenario Name"             text,
  "Purchase Price"            numeric,
  "Gross Income"              numeric,
  "Operating Expenses"        numeric,
  "Cap Rate"                  numeric,
  "Net Income"                numeric,
  "Taxable Income After Depreciation" numeric,
  "Income Increase"           numeric,
  "Expenses Increase"         numeric,
  "Property Value Increase"   numeric,
  "Has Loan"                  boolean,
  "Loan Term"                 integer,
  "Down Payment Percentage"   numeric,
  "Down Payment Amount"       numeric,
  "Interest Rate"             numeric,
  "Closing Costs"             numeric,
  "Purchase Closing Costs"    numeric,
  expense_breakdown           jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_shared_scenarios ENABLE ROW LEVEL SECURITY;

-- 6. team_shared_loans ─────────────────────────────────────────────────────────
CREATE TABLE team_shared_loans (
  id                    serial PRIMARY KEY,
  shared_scenario_id    integer NOT NULL REFERENCES team_shared_scenarios(id) ON DELETE CASCADE,
  "Loan Term"           integer,
  "Down Payment Percentage" numeric,
  "Down Payment Amount" numeric,
  "Purchase Price"      numeric,
  "Interest Rate"       numeric,
  "Monthly Mortgage"    numeric,
  "Monthly Principal"   numeric,
  "Monthly Interest"    numeric,
  "Closing Costs"       numeric,
  "Annual Mortgage"     numeric,
  "Annual Principal"    numeric,
  "Annual Interest"     numeric,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_shared_loans ENABLE ROW LEVEL SECURITY;

-- ─── Helper: fast membership check ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_team_member(tid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = tid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION team_member_role(tid uuid)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role FROM team_members WHERE team_id = tid AND user_id = auth.uid() LIMIT 1;
$$;

-- ─── RLS: teams ───────────────────────────────────────────────────────────────
CREATE POLICY "Team members can view team"
  ON teams FOR SELECT
  USING (is_team_member(id));

CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Owner or admin can update team"
  ON teams FOR UPDATE
  USING (team_member_role(id) IN ('owner','admin'));

CREATE POLICY "Owner can delete team"
  ON teams FOR DELETE
  USING (team_member_role(id) = 'owner');

-- ─── RLS: team_members ────────────────────────────────────────────────────────
CREATE POLICY "Team members can view members"
  ON team_members FOR SELECT
  USING (is_team_member(team_id));

-- Owners/admins can add members; users can add themselves when accepting an invite
CREATE POLICY "Owner or admin can insert members"
  ON team_members FOR INSERT
  WITH CHECK (
    team_member_role(team_id) IN ('owner','admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "Owner or admin can update member roles"
  ON team_members FOR UPDATE
  USING (team_member_role(team_id) IN ('owner','admin'));

-- Owners/admins can remove anyone; members can remove themselves (leave team)
CREATE POLICY "Remove member"
  ON team_members FOR DELETE
  USING (
    team_member_role(team_id) IN ('owner','admin')
    OR user_id = auth.uid()
  );

-- ─── RLS: team_invitations ────────────────────────────────────────────────────
CREATE POLICY "Team members can view invitations"
  ON team_invitations FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Owner or admin can create invitations"
  ON team_invitations FOR INSERT
  WITH CHECK (team_member_role(team_id) IN ('owner','admin'));

CREATE POLICY "Owner or admin can update invitations"
  ON team_invitations FOR UPDATE
  USING (team_member_role(team_id) IN ('owner','admin'));

-- Allow any authenticated user to read an invitation by token (for join flow)
CREATE POLICY "Anyone can read pending invitation by token"
  ON team_invitations FOR SELECT
  USING (status = 'pending' AND expires_at > now());

-- ─── RLS: team_shared_properties ─────────────────────────────────────────────
CREATE POLICY "Team members can view shared properties"
  ON team_shared_properties FOR SELECT
  USING (is_team_member(team_id));

CREATE POLICY "Team members can insert shared properties"
  ON team_shared_properties FOR INSERT
  WITH CHECK (is_team_member(team_id) AND shared_by = auth.uid());

CREATE POLICY "Team members can update shared properties"
  ON team_shared_properties FOR UPDATE
  USING (is_team_member(team_id));

CREATE POLICY "Team members can delete shared properties"
  ON team_shared_properties FOR DELETE
  USING (is_team_member(team_id));

-- ─── RLS: team_shared_scenarios ──────────────────────────────────────────────
CREATE POLICY "Team members can manage shared scenarios"
  ON team_shared_scenarios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_shared_properties tsp
      WHERE tsp.id = team_shared_scenarios.shared_property_id
        AND is_team_member(tsp.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_shared_properties tsp
      WHERE tsp.id = team_shared_scenarios.shared_property_id
        AND is_team_member(tsp.team_id)
    )
  );

-- ─── RLS: team_shared_loans ──────────────────────────────────────────────────
CREATE POLICY "Team members can manage shared loans"
  ON team_shared_loans FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM team_shared_scenarios tss
      JOIN team_shared_properties tsp ON tsp.id = tss.shared_property_id
      WHERE tss.id = team_shared_loans.shared_scenario_id
        AND is_team_member(tsp.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM team_shared_scenarios tss
      JOIN team_shared_properties tsp ON tsp.id = tss.shared_property_id
      WHERE tss.id = team_shared_loans.shared_scenario_id
        AND is_team_member(tsp.team_id)
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_team_members_user_id   ON team_members(user_id);
CREATE INDEX idx_team_members_team_id   ON team_members(team_id);
CREATE INDEX idx_team_invitations_token ON team_invitations(invite_token);
CREATE INDEX idx_team_invitations_email ON team_invitations(invite_email);
CREATE INDEX idx_team_shared_props_team ON team_shared_properties(team_id);
CREATE INDEX idx_team_shared_scenarios_prop ON team_shared_scenarios(shared_property_id);
CREATE INDEX idx_team_shared_loans_scenario ON team_shared_loans(shared_scenario_id);

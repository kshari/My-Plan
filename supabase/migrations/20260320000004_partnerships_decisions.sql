-- ─── Partnerships Module — Decisions & Voting ────────────────────────────────
-- Tables: pt_decisions, pt_decision_options, pt_votes, pt_decision_comments
-- Phase 5
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. pt_decisions ─────────────────────────────────────────────────────────────
CREATE TABLE pt_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       uuid NOT NULL REFERENCES pt_entities(id) ON DELETE CASCADE,
  investment_id   uuid REFERENCES pt_investments(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  decision_type   text NOT NULL DEFAULT 'vote'
                  CHECK (decision_type IN ('vote','discussion','announcement')),
  voting_method   text NOT NULL DEFAULT 'simple_majority'
                  CHECK (voting_method IN ('simple_majority','supermajority','unanimous','weighted')),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('draft','open','closed','approved','rejected')),
  deadline        timestamptz,
  outcome         text,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz
);

ALTER TABLE pt_decisions ENABLE ROW LEVEL SECURITY;

-- 2. pt_decision_options ──────────────────────────────────────────────────────
CREATE TABLE pt_decision_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES pt_decisions(id) ON DELETE CASCADE,
  label       text NOT NULL,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE pt_decision_options ENABLE ROW LEVEL SECURITY;

-- 3. pt_votes ─────────────────────────────────────────────────────────────────
CREATE TABLE pt_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES pt_decisions(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES pt_decision_options(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  weight      numeric(7,4),
  comment     text,
  voted_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_id, member_id)
);

ALTER TABLE pt_votes ENABLE ROW LEVEL SECURITY;

-- 4. pt_decision_comments ─────────────────────────────────────────────────────
CREATE TABLE pt_decision_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL REFERENCES pt_decisions(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES pt_members(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_decision_comments ENABLE ROW LEVEL SECURITY;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

-- pt_decisions
CREATE POLICY "decisions_select" ON pt_decisions
  FOR SELECT USING (is_entity_member(entity_id));

CREATE POLICY "decisions_insert" ON pt_decisions
  FOR INSERT WITH CHECK (is_entity_member(entity_id));

CREATE POLICY "decisions_update" ON pt_decisions
  FOR UPDATE USING (entity_member_role(entity_id) = 'admin'
    OR created_by = auth.uid()
  );

CREATE POLICY "decisions_delete" ON pt_decisions
  FOR DELETE USING (entity_member_role(entity_id) = 'admin');

-- pt_decision_options (access via parent decision)
CREATE POLICY "options_select" ON pt_decision_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pt_decisions d WHERE d.id = decision_id AND is_entity_member(d.entity_id))
  );

CREATE POLICY "options_insert" ON pt_decision_options
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM pt_decisions d WHERE d.id = decision_id AND is_entity_member(d.entity_id))
  );

CREATE POLICY "options_delete" ON pt_decision_options
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM pt_decisions d WHERE d.id = decision_id
      AND entity_member_role(d.entity_id) = 'admin')
  );

-- pt_votes (members can insert their own vote)
CREATE POLICY "votes_select" ON pt_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pt_decisions d WHERE d.id = decision_id AND is_entity_member(d.entity_id))
  );

CREATE POLICY "votes_insert" ON pt_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pt_decisions d
      JOIN pt_members m ON m.entity_id = d.entity_id
      WHERE d.id = decision_id
        AND m.id = member_id
        AND m.user_id = auth.uid()
        AND d.status = 'open'
    )
  );

CREATE POLICY "votes_update" ON pt_votes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM pt_members m WHERE m.id = member_id AND m.user_id = auth.uid()
    )
  );

-- pt_decision_comments
CREATE POLICY "comments_select" ON pt_decision_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pt_decisions d WHERE d.id = decision_id AND is_entity_member(d.entity_id))
  );

CREATE POLICY "comments_insert" ON pt_decision_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM pt_decisions d
      JOIN pt_members m ON m.entity_id = d.entity_id
      WHERE d.id = decision_id AND m.id = member_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "comments_update" ON pt_decision_comments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM pt_members m WHERE m.id = member_id AND m.user_id = auth.uid())
  );

CREATE POLICY "comments_delete" ON pt_decision_comments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM pt_members m WHERE m.id = member_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM pt_decisions d WHERE d.id = decision_id AND entity_member_role(d.entity_id) = 'admin'
    )
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX pt_decisions_entity_id_idx ON pt_decisions (entity_id);
CREATE INDEX pt_decisions_investment_id_idx ON pt_decisions (investment_id);
CREATE INDEX pt_votes_decision_id_idx ON pt_votes (decision_id);
CREATE INDEX pt_decision_comments_decision_id_idx ON pt_decision_comments (decision_id);

-- Family Activity Planner — Planning tables

-- fa_interests
CREATE TABLE IF NOT EXISTS fa_interests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES fa_members(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  weight      smallint NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, tag)
);
ALTER TABLE fa_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interests_all" ON fa_interests FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_interests_member_idx ON fa_interests (member_id);
CREATE INDEX fa_interests_family_idx ON fa_interests (family_id);

-- fa_availability
CREATE TABLE IF NOT EXISTS fa_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES fa_members(id) ON DELETE CASCADE,
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','google')),
  kind        text NOT NULL DEFAULT 'free' CHECK (kind IN ('free','busy')),
  start_ts    timestamptz NOT NULL,
  end_ts      timestamptz NOT NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fa_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability_all" ON fa_availability FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_availability_member_idx ON fa_availability (member_id);
CREATE INDEX fa_availability_family_idx ON fa_availability (family_id);
CREATE INDEX fa_availability_range_idx ON fa_availability (family_id, start_ts, end_ts);

-- fa_places
CREATE TABLE IF NOT EXISTS fa_places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  name            text NOT NULL,
  category        text NOT NULL DEFAULT 'other',
  google_place_id text,
  address         text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  photo_ref       text,
  rating          numeric(3,1),
  price_level     smallint CHECK (price_level BETWEEN 0 AND 4),
  best_months     int[],
  best_time_of_day text CHECK (best_time_of_day IN ('morning','afternoon','evening','any')),
  notes           text,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fa_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places_all" ON fa_places FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_places_family_idx ON fa_places (family_id);

-- fa_suggestions
CREATE TABLE IF NOT EXISTS fa_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  place_id        uuid REFERENCES fa_places(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  kind            text NOT NULL DEFAULT 'day_activity' CHECK (kind IN ('day_activity','weekend','vacation')),
  proposed_start  date,
  proposed_end    date,
  est_cost        numeric(10,2),
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('rule','ai','manual')),
  score           numeric(5,2),
  score_breakdown jsonb,
  status          text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','shortlisted','planned','dismissed')),
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fa_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestions_all" ON fa_suggestions FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_suggestions_family_idx ON fa_suggestions (family_id);
CREATE INDEX fa_suggestions_status_idx ON fa_suggestions (family_id, status);

-- fa_suggestion_votes
CREATE TABLE IF NOT EXISTS fa_suggestion_votes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id  uuid NOT NULL REFERENCES fa_suggestions(id) ON DELETE CASCADE,
  member_id      uuid NOT NULL REFERENCES fa_members(id) ON DELETE CASCADE,
  family_id      uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  vote           smallint NOT NULL CHECK (vote IN (-1, 1)),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, member_id)
);
ALTER TABLE fa_suggestion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_all" ON fa_suggestion_votes FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_votes_suggestion_idx ON fa_suggestion_votes (suggestion_id);

-- fa_trips
CREATE TABLE IF NOT EXISTS fa_trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     uuid NOT NULL REFERENCES fa_families(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES fa_suggestions(id) ON DELETE SET NULL,
  title         text NOT NULL,
  destination   text,
  start_date    date,
  end_date      date,
  status        text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','confirmed','completed','cancelled')),
  attendee_ids  uuid[],
  checklist     jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes         text,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fa_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_all" ON fa_trips FOR ALL USING (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid())) WITH CHECK (is_family_member(family_id) OR EXISTS (SELECT 1 FROM fa_families WHERE id = family_id AND created_by = auth.uid()));
CREATE INDEX fa_trips_family_idx ON fa_trips (family_id);

-- ─── Partnerships — Add num_shares to pt_investments ──────────────────────────
-- Tracks the number of shares / units purchased for any investment type.
-- Nullable because shares are not applicable to every investment
-- (e.g. a real-estate property typically has no share count).
-- Uses numeric(18,6) to support fractional shares (mutual funds, crypto, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pt_investments
  ADD COLUMN IF NOT EXISTS num_shares numeric(18,6) NULL;

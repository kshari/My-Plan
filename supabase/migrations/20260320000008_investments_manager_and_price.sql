-- ─── Partnerships — Investment Manager + Market Price per Share ───────────────
-- investment_manager:       free-text name of the fund manager, broker, or
--                           operator overseeing this investment (nullable)
-- market_price_per_share:   current / latest known market price per share or
--                           unit (nullable; purchase price is derived on the
--                           client as target_amount / num_shares)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE pt_investments
  ADD COLUMN IF NOT EXISTS investment_manager    text           NULL,
  ADD COLUMN IF NOT EXISTS market_price_per_share numeric(15,4) NULL;

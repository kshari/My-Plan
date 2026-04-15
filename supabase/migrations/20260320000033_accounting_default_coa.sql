-- ─── Partnerships Accounting — Phase 4 ───────────────────────────────────────
-- Default Chart of Accounts + entity/member hooks
-- ─────────────────────────────────────────────────────────────────────────────

-- Function: create default COA for a new entity (~25 standard accounts)
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_entity_id uuid, p_created_by uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pt_accounts (entity_id, account_code, name, type, subtype, is_system, created_by) VALUES
    -- ── Assets ──────────────────────────────────────────────────────────────
    (p_entity_id, '1000', 'Cash & Cash Equivalents',   'asset', 'cash',          true, p_created_by),
    (p_entity_id, '1100', 'Accounts Receivable',        'asset', 'ar',            true, p_created_by),
    (p_entity_id, '1200', 'Investments',                'asset', 'investment',    true, p_created_by),
    (p_entity_id, '1300', 'Prepaid Expenses',           'asset', 'prepaid',       true, p_created_by),
    (p_entity_id, '1500', 'Fixed Assets',               'asset', 'fixed_asset',   true, p_created_by),
    (p_entity_id, '1510', 'Accumulated Depreciation',   'asset', 'fixed_asset',   true, p_created_by),
    (p_entity_id, '1900', 'Other Assets',               'asset', 'other_asset',   true, p_created_by),
    -- ── Liabilities ─────────────────────────────────────────────────────────
    (p_entity_id, '2000', 'Accounts Payable',           'liability', 'ap',            true, p_created_by),
    (p_entity_id, '2100', 'Notes Payable / Loans',      'liability', 'note_payable',  true, p_created_by),
    (p_entity_id, '2200', 'Accrued Liabilities',        'liability', 'accrued',       true, p_created_by),
    (p_entity_id, '2300', 'Deferred Revenue',           'liability', 'deferred_rev',  true, p_created_by),
    (p_entity_id, '2900', 'Other Liabilities',          'liability', 'other_liab',    true, p_created_by),
    -- ── Equity ──────────────────────────────────────────────────────────────
    (p_entity_id, '3000', 'Partners'' Capital',         'equity', 'partner_capital', true, p_created_by),
    (p_entity_id, '3500', 'Retained Earnings',          'equity', 'retained_earnings', true, p_created_by),
    (p_entity_id, '3900', 'Current Year Income',        'equity', 'current_income', true, p_created_by),
    -- ── Income ──────────────────────────────────────────────────────────────
    (p_entity_id, '4000', 'Investment Income',          'income', 'revenue',        true, p_created_by),
    (p_entity_id, '4100', 'Interest Income',            'income', 'revenue',        true, p_created_by),
    (p_entity_id, '4200', 'Dividend Income',            'income', 'revenue',        true, p_created_by),
    (p_entity_id, '4300', 'Capital Gains',              'income', 'capital_gain',   true, p_created_by),
    (p_entity_id, '4400', 'Management Fees Received',   'income', 'revenue',        true, p_created_by),
    (p_entity_id, '4900', 'Other Income',               'income', 'other_income',   true, p_created_by),
    -- ── Expenses ────────────────────────────────────────────────────────────
    (p_entity_id, '5000', 'Management Fees',            'expense', 'operating_expense', true, p_created_by),
    (p_entity_id, '5100', 'Legal & Professional Fees',  'expense', 'operating_expense', true, p_created_by),
    (p_entity_id, '5200', 'Administrative Expenses',    'expense', 'operating_expense', true, p_created_by),
    (p_entity_id, '5300', 'Interest Expense',           'expense', 'interest_expense',  true, p_created_by),
    (p_entity_id, '5400', 'Tax Expenses',               'expense', 'tax_expense',        true, p_created_by),
    (p_entity_id, '5500', 'Depreciation & Amortization','expense', 'depreciation',       true, p_created_by),
    (p_entity_id, '5900', 'Other Expenses',             'expense', 'other_expense',      true, p_created_by);
END;
$$;

-- Function: create per-partner capital account when a member is added
CREATE OR REPLACE FUNCTION create_partner_capital_account(p_entity_id uuid, p_member_id uuid, p_display_name text, p_created_by uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_next_code text;
  v_seq       int;
BEGIN
  -- Find next available code in 3001-3499 range
  SELECT COALESCE(MAX(account_code::int), 3000) + 1
    INTO v_seq
    FROM pt_accounts
   WHERE entity_id = p_entity_id
     AND account_code ~ '^\d+$'
     AND account_code::int BETWEEN 3001 AND 3499;

  v_next_code := v_seq::text;

  INSERT INTO pt_accounts (entity_id, account_code, name, type, subtype, parent_id, member_id, is_system, created_by)
  SELECT p_entity_id,
         v_next_code,
         p_display_name || ' — Capital Account',
         'equity',
         'partner_capital',
         (SELECT id FROM pt_accounts WHERE entity_id = p_entity_id AND account_code = '3000'),
         p_member_id,
         true,
         p_created_by;
END;
$$;

-- Function: create current-year fiscal year for a new entity
CREATE OR REPLACE FUNCTION create_default_fiscal_year(p_entity_id uuid, p_created_by uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  INSERT INTO pt_fiscal_years (entity_id, label, start_date, end_date, tax_year, created_by)
  VALUES (
    p_entity_id,
    'FY ' || v_year,
    make_date(v_year, 1, 1),
    make_date(v_year, 12, 31),
    v_year,
    p_created_by
  )
  ON CONFLICT (entity_id, tax_year) DO NOTHING;
END;
$$;

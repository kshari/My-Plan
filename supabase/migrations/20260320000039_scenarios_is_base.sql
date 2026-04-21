-- Phase 1: Add is_base column to scenario tables
ALTER TABLE pi_financial_scenarios
  ADD COLUMN IF NOT EXISTS is_base BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE team_shared_scenarios
  ADD COLUMN IF NOT EXISTS is_base BOOLEAN NOT NULL DEFAULT false;

-- Partial unique index: each property has at most one base scenario
CREATE UNIQUE INDEX IF NOT EXISTS pi_financial_scenarios_base_unique
  ON pi_financial_scenarios ("Property ID")
  WHERE is_base = true;

CREATE UNIQUE INDEX IF NOT EXISTS team_shared_scenarios_base_unique
  ON team_shared_scenarios (shared_property_id)
  WHERE is_base = true;

-- Backfill Base scenarios for pi_properties that don't have one yet
INSERT INTO pi_financial_scenarios (
  "Property ID",
  "Scenario Name",
  "Purchase Price",
  "Gross Income",
  "Operating Expenses",
  expense_breakdown,
  "Vacancy Rate",
  "Property Management Rate",
  "Income Increase",
  "Expenses Increase",
  "Property Value Increase",
  "Has Loan",
  "Down Payment Percentage",
  "Down Payment Amount",
  "Interest Rate",
  "Loan Term",
  "Closing Costs",
  "Purchase Closing Costs",
  is_base
)
SELECT
  p.id,
  'Base',
  COALESCE(p."Asking Price", 0),
  COALESCE(p."Gross Income", 0) * 12,
  COALESCE(p."Operating Expenses", 0) * 12,
  p.expense_breakdown,
  COALESCE(p.vacancy_rate, 5),
  0,
  COALESCE(p.income_increase, 3),
  COALESCE(p.expenses_increase, 3),
  COALESCE(p.property_value_increase, 3),
  true,
  25,
  COALESCE(p."Asking Price", 0) * 0.25,
  7.0,
  30,
  COALESCE(p."Asking Price", 0) * 0.03,
  0,
  true
FROM pi_properties p
WHERE NOT EXISTS (
  SELECT 1 FROM pi_financial_scenarios s
  WHERE s."Property ID" = p.id
    AND s.is_base = true
);

-- Backfill Base scenarios for team_shared_properties that don't have one yet
INSERT INTO team_shared_scenarios (
  shared_property_id,
  shared_by,
  "Scenario Name",
  "Purchase Price",
  "Gross Income",
  "Operating Expenses",
  "Vacancy Rate",
  "Property Management Rate",
  "Income Increase",
  "Expenses Increase",
  "Property Value Increase",
  "Has Loan",
  "Down Payment Percentage",
  "Down Payment Amount",
  "Interest Rate",
  "Loan Term",
  "Closing Costs",
  "Purchase Closing Costs",
  is_base
)
SELECT
  p.id,
  p.shared_by,
  'Base',
  COALESCE(p."Asking Price", 0),
  COALESCE(p."Gross Income", 0) * 12,
  COALESCE(p."Operating Expenses", 0) * 12,
  5,
  0,
  3,
  3,
  3,
  true,
  25,
  COALESCE(p."Asking Price", 0) * 0.25,
  7.0,
  30,
  COALESCE(p."Asking Price", 0) * 0.03,
  0,
  true
FROM team_shared_properties p
WHERE NOT EXISTS (
  SELECT 1 FROM team_shared_scenarios s
  WHERE s.shared_property_id = p.id
    AND s.is_base = true
);

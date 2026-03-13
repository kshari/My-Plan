# Retirement App — Variables & Default Values Reference

> Auto-generated reference of all centralized constants used in the retirement planner.
> Source files live in `lib/constants/`.

---

## Personal & Demographics
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_AGE` | **40** | Starting age for calculator |
| `DEFAULT_RETIREMENT_AGE` | **65** | Target retirement age |
| `DEFAULT_LIFE_EXPECTANCY` | **90** | Plan-through age |
| `DEFAULT_SPOUSE_LIFE_EXPECTANCY` | **90** | Spouse plan-through age |
| `DEFAULT_MAX_PROJECTION_AGE` | **100** | Upper bound for projection loop |
| `DEFAULT_FILING_STATUS` | **Single** | Tax filing status |

---

## Growth & Economic Rates
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_GROWTH_RATE_PRE_RETIREMENT` | **10%** (0.10) | Investment return before retirement |
| `DEFAULT_GROWTH_RATE_DURING_RETIREMENT` | **5%** (0.05) | Investment return during retirement |
| `DEFAULT_INFLATION_RATE` | **3%** (0.03) | Annual inflation |
| `DEFAULT_DEBT_INTEREST_RATE` | **6%** (0.06) | Borrowing cost for expense coverage |
| `DEFAULT_LOAN_RATE` | **10%** (0.10) | Loan rate (defaults popup) |
| `DEFAULT_CAPITAL_GAINS_TAX_RATE` | **20%** (0.20) | Blended cap gains rate (defaults popup) |
| `DEFAULT_INCOME_TAX_RATE_RETIREMENT` | **25%** (0.25) | Income tax rate in retirement (defaults popup) |

*Percentage-form variants for UI inputs:*

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_GROWTH_RATE_PRE_RETIREMENT_PCT` | **10** | Pre-retirement growth (UI %) |
| `DEFAULT_GROWTH_RATE_DURING_RETIREMENT_PCT` | **5** | During-retirement growth (UI %) |
| `DEFAULT_INFLATION_RATE_PCT` | **3** | Inflation (UI %) |

---

## SSA (Social Security) — Calculator Defaults
`lib/constants/retirement-defaults.ts`

> **Sources:** SSA Monthly Statistical Snapshot, Oct 2024 (ssa.gov/policy/docs/quickfacts/stat_snapshot/2024-10.html); SSA Annual Statistical Supplement 2024 (ssa.gov/policy/docs/statcomps/supplement/2024/5a.html)

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_SSA_START_AGE` | **65** | Age to start SSA income |
| `SSA_EARLIEST_ELIGIBILITY_AGE` | **62** | Earliest age to claim SSA (minimum enforced in calculator) |
| `DEFAULT_SSA_ANNUAL_BENEFIT` | **$23,100** | Avg retired worker $1,924/mo (SSA Monthly Snapshot, Oct 2024) |
| `DEFAULT_SPOUSE_SSA_BENEFIT` | **$20,500** | Avg women retired worker ~$1,714/mo (SSA Statistical Supplement 2024) |

---

## Healthcare / Medicare — Calculator Defaults
`lib/constants/retirement-defaults.ts`

> **Sources:** CMS/KFF Plan Year 2024 QHP Premiums Report (cms.gov/files/document/2024-qhp-premiums-choice-report.pdf); CMS 2025 Medicare Parts A & B Premiums fact sheet (cms.gov/newsroom/fact-sheets/2025-medicare-parts-b-premiums-and-deductibles); Medigap Plan G average premiums 2025

| Variable | Default | Description |
|---|---|---|
| `MEDICARE_ELIGIBILITY_AGE` | **65** | Age Medicare coverage begins |
| `DEFAULT_PRE_MEDICARE_ANNUAL_PREMIUM` | **$20,400** | ACA benchmark silver plan, unsubsidized ~$1,700/mo for age 60 (CMS/KFF 2024) |
| `DEFAULT_POST_MEDICARE_ANNUAL_PREMIUM` | **$4,500** | Medicare Part B $185/mo + Medigap Plan G avg ~$192/mo = $377/mo (CMS/Medigap 2025) |
| `DEFAULT_HEALTHCARE_INFLATION_RATE` | **5%** (0.05) | Annual premium inflation applied in projection engine — midpoint of KFF 2024 Employer Survey (~4.4%/yr) and ACA marketplace trend (~7%/yr) |

---

## SSA — Calculation Engine Constants
`lib/constants/ssa-constants.ts`

> **Sources:** SSA Monthly Statistical Snapshot, Oct 2024; SSA Annual Statistical Supplement 2024 (same sources as Calculator Defaults above)

| Variable | Default | Description |
|---|---|---|
| `SSA_FULL_RETIREMENT_AGE` | **67** | Full retirement age (FRA) |
| `SSA_EARLY_CLAIMING_REDUCTION_PER_YEAR` | **6.67%** (0.0667) | Benefit cut per year before FRA |
| `SSA_MAX_EARLY_REDUCTION` | **30%** (0.30) | Max cumulative reduction (claiming at 62) |
| `SSA_MIN_CLAIMING_MULTIPLIER` | **0.70** | Minimum benefit multiplier |
| `SSA_DELAYED_CREDIT_PER_YEAR` | **8%** (0.08) | Bonus per year delaying past FRA |
| `SSA_MAX_DELAYED_BONUS` | **24%** (0.24) | Max bonus (delaying to 70) |
| `SSA_WAGE_BASE` | **$168,600** | 2024 taxable wage cap |
| `SSA_BEND_POINT_1` | **$50,000** | First PIA bend point |
| `SSA_BEND_POINT_2` | **$100,000** | Second PIA bend point |
| `SSA_RATE_TIER_1` | **40%** (0.40) | Replacement rate tier 1 |
| `SSA_RATE_TIER_2` | **30%** (0.30) | Replacement rate tier 2 |
| `SSA_RATE_TIER_3` | **20%** (0.20) | Replacement rate tier 3 |
| `SSA_SPOUSE_BENEFIT_MULTIPLIER` | **0.75** | Spouse benefit as fraction of primary |
| `SSA_MIN_BENEFIT_PLANNER` | **$15,000** | Minimum planner SSA floor |
| `SSA_MIN_BENEFIT_SPOUSE` | **$10,000** | Minimum spouse SSA floor |
| `SSA_MAX_BENEFIT_PLANNER` | **$45,000** | Maximum planner SSA cap |
| `SSA_MAX_BENEFIT_SPOUSE` | **$35,000** | Maximum spouse SSA cap |
| `SSA_DEFAULT_PLANNER_BENEFIT` | **$23,100** | Fallback planner benefit — avg retired worker $1,924/mo (SSA, Oct 2024) |
| `SSA_DEFAULT_SPOUSE_BENEFIT` | **$20,500** | Fallback spouse benefit — avg women retired worker ~$1,714/mo (SSA 2024) |
| `SSA_COLA_RATE` | **2.5%** (0.025) | Annual COLA applied to SSA in projection engine — SSA 2025 COLA (ssa.gov/OACT/COLA/colaseries.html); 10-yr avg ~2.6% |

---

## Savings & Spending (Quick Calculator)
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_CURRENT_SAVINGS` | **$200,000** | Starting savings |
| `DEFAULT_ANNUAL_CONTRIBUTION` | **$20,000** | Annual contribution |
| `DEFAULT_MONTHLY_EXPENSES` | **$6,000** | Monthly spending in retirement |

---

## Toggles
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_ENABLE_BORROWING` | **false** | Allow borrowing to cover shortfall |
| `DEFAULT_INCLUDE_SSA` | **true** | Include SSA income |
| `DEFAULT_INCLUDE_SPOUSE` | **false** | Include spouse in plan |
| `DEFAULT_PLANNER_SSA_INCOME` | **true** | Include planner SSA income |
| `DEFAULT_SPOUSE_SSA_INCOME` | **false** | Include spouse SSA income |

---

## Withdrawal Strategy
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `SAFE_WITHDRAWAL_RATE` | **4%** (0.04) | Classic 4% rule |
| `DEFAULT_FIXED_DOLLAR_WITHDRAWAL` | **$50,000** | Fixed dollar withdrawal amount |
| `DEFAULT_FIXED_PERCENTAGE_RATE` | **4%** (0.04) | Fixed percentage withdrawal |
| `GUARDRAIL_CEILING` | **6%** (0.06) | Max withdrawal in guardrails strategy |
| `GUARDRAIL_FLOOR` | **3%** (0.03) | Min withdrawal in guardrails strategy |
| `ROTH_CONVERSION_FRACTION` | **10%** (0.10) | Annual Roth conversion fraction |
| `ROTH_CONVERSION_MAX` | **$10,000** | Annual Roth conversion cap |
| `QCD_MAX_ANNUAL` | **$100,000** | IRS annual QCD limit |
| `QCD_FRACTION_OF_RMD` | **0.50** | Fraction of RMD used for QCD |

---

## RMD (Required Minimum Distributions)
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `RMD_START_AGE` | **73** | Age RMDs begin |
| `RMD_LIFE_EXPECTANCY_FACTOR_AT_73` | **27.4** | IRS life expectancy factor at 73 |

---

## Risk Score Thresholds
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `SCORE_ON_TRACK_THRESHOLD` | **80** | Confidence >= 80 = on track (green) |
| `SCORE_CLOSE_THRESHOLD` | **60** | Confidence >= 60 = close (amber) |
| `SCORE_MEDIUM_RISK_THRESHOLD` | **75** | Medium risk cutoff |
| `SCORE_AT_RISK_THRESHOLD` | **50** | At risk cutoff (red) |

---

## Analysis Score Weights
`lib/constants/retirement-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `SCORE_WEIGHT_LONGEVITY` | **50%** (0.50) | Longevity weight in overall score |
| `SCORE_WEIGHT_TAX_EFFICIENCY` | **15%** (0.15) | Tax efficiency weight |
| `SCORE_WEIGHT_INFLATION` | **10%** (0.10) | Inflation weight |
| `SCORE_WEIGHT_MEDICAL` | **10%** (0.10) | Medical weight |
| `SCORE_WEIGHT_CASHFLOW` | **15%** (0.15) | Cashflow weight |
| `SCORE_WEIGHT_SCENARIO_LONGEVITY` | **50%** (0.50) | Scenario sustainability weight |
| `SCORE_WEIGHT_SCENARIO_SCORE` | **25%** (0.25) | Scenario individual score weight |

---

## 2024 Federal Tax — Standard Deductions
`lib/constants/tax-brackets.ts`

| Filing Status | Deduction |
|---|---|
| Single | **$14,600** |
| Married Filing Jointly | **$29,200** |
| Married Filing Separately | **$14,600** |
| Head of Household | **$21,900** |

---

## 2024 Federal Tax — Calculation Fallback Rates
`lib/constants/tax-brackets.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_MARGINAL_TAX_RATE` | **22%** (0.22) | Fallback marginal rate |
| `DEFAULT_ESTIMATED_TAX_RATE` | **20%** (0.20) | Estimated effective tax on withdrawals |
| `DEFAULT_ROTH_CONVERSION_TAX_RATE` | **15%** (0.15) | Tax on Roth conversions |
| `DEFAULT_TAXABLE_ACCOUNT_RATIO` | **30%** (0.30) | Assumed taxable account withdrawal share |
| `SSA_TAXABLE_PORTION` | **50%** (0.50) | Taxable portion of SSA income |
| `TOP_MARGINAL_RATE` | **37%** (0.37) | Highest federal income tax rate |

---

## 2024 Federal Income Tax Brackets
`lib/constants/tax-brackets.ts` — `INCOME_TAX_BRACKETS`

| Rate | Single | Married Filing Jointly | Married Filing Separately | Head of Household |
|---|---|---|---|---|
| 10% | $0 – $11,600 | $0 – $23,200 | $0 – $11,600 | $0 – $16,550 |
| 12% | $11,600 – $47,150 | $23,200 – $94,300 | $11,600 – $47,150 | $16,550 – $63,100 |
| 22% | $47,150 – $100,525 | $94,300 – $201,050 | $47,150 – $100,525 | $63,100 – $100,500 |
| 24% | $100,525 – $191,950 | $201,050 – $383,900 | $100,525 – $191,950 | $100,500 – $191,950 |
| 32% | $191,950 – $243,725 | $383,900 – $487,450 | $191,950 – $243,725 | $191,950 – $243,700 |
| 35% | $243,725 – $609,350 | $487,450 – $731,200 | $243,725 – $365,600 | $243,700 – $609,350 |
| 37% | $609,350+ | $731,200+ | $365,600+ | $609,350+ |

---

## 2024 Long-Term Capital Gains Brackets
`lib/constants/tax-brackets.ts` — `CAPITAL_GAINS_BRACKETS`

| Rate | Single | Married Filing Jointly | Married Filing Separately | Head of Household |
|---|---|---|---|---|
| 0% | $0 – $47,025 | $0 – $94,350 | $0 – $47,125 | $0 – $63,100 |
| 15% | $47,025 – $518,900 | $94,350 – $583,750 | $47,125 – $291,850 | $63,100 – $523,050 |
| 20% | $518,900+ | $583,750+ | $291,850+ | $523,050+ |

---

## Account Types
`lib/constants/account-types.ts`

| Constant | Value | Tax Treatment |
|---|---|---|
| `ACCOUNT_TYPE_401K` | `401k` | Tax-deferred |
| `ACCOUNT_TYPE_IRA` | `IRA` | Tax-deferred |
| `ACCOUNT_TYPE_ROTH_IRA` | `Roth IRA` | Tax-free |
| `ACCOUNT_TYPE_HSA` | `HSA` | Tax-free |
| `ACCOUNT_TYPE_TAXABLE` | `Taxable` | Capital gains |
| `ACCOUNT_TYPE_OTHER` | `Other` | Varies |

---

## Default Expense Categories
`lib/constants/account-types.ts` — `DEFAULT_EXPENSE_CATEGORIES`

| Category | Annual Amount |
|---|---|
| Housing (Rent/Mortgage) | **$36,000** |
| Healthcare & Insurance | **$12,000** |
| Food & Groceries | **$9,600** |
| Transportation | **$6,000** |
| Utilities & Services | **$4,800** |
| Personal & Leisure | **$3,600** |

---

## Monte Carlo Simulation
`lib/constants/monte-carlo.ts`

| Variable | Default | Description |
|---|---|---|
| `MC_DEFAULT_NUM_SIMULATIONS` | **1,000** | Number of simulation runs |
| `MC_STD_DEV_PRE_RETIREMENT` | **15%** (0.15) | Return volatility before retirement |
| `MC_STD_DEV_DURING_RETIREMENT` | **12%** (0.12) | Return volatility during retirement |
| `MC_NEGATIVE_CASHFLOW_FAILURE_THRESHOLD` | **20%** (0.20) | Failure if >20% years have negative cashflow |
| `MC_PERCENTILE_P5` | **0.05** | Worst 5% of scenarios |
| `MC_PERCENTILE_P25` | **0.25** | 25th percentile |
| `MC_PERCENTILE_P75` | **0.75** | 75th percentile |
| `MC_PERCENTILE_P90` | **0.90** | 90th percentile |
| `MC_PERCENTILE_P95` | **0.95** | Best 5% of scenarios |

---

## Timing & UX
`lib/constants/timing.ts`

| Variable | Default | Description |
|---|---|---|
| `DEBOUNCE_SAVE_MS` | **800 ms** | Auto-save debounce delay |
| `TOAST_DURATION_SHORT` | **3,000 ms** | Short toast notification |
| `TOAST_DURATION_LONG` | **5,000 ms** | Long toast notification |
| `SAVED_INDICATOR_MS` | **2,000 ms** | "Saved" checkmark display time |
| `API_RATE_LIMIT_MS` | **200 ms** | Delay between API batches |
| `MARKET_DATA_CACHE_MS` | **300,000 ms** (5 min) | Market data cache duration |
| `MARKET_DATA_BATCH_SIZE` | **5** | Concurrent API requests |

---

## Property Analysis Defaults
`lib/constants/property-defaults.ts`

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_INTEREST_RATE_MIN` | **4.0%** | Min interest rate for scenarios |
| `DEFAULT_INTEREST_RATE_MAX` | **7.0%** | Max interest rate for scenarios |
| `DEFAULT_DOWN_PAYMENT_PCT` | **25%** | Default down payment |
| `DEFAULT_DOWN_PAYMENT_MIN` | **20%** | Min down payment for scenarios |
| `DEFAULT_DOWN_PAYMENT_MAX` | **30%** | Max down payment for scenarios |
| `DEFAULT_CLOSING_COST_PCT` | **3%** | Closing cost percentage |
| `LOAN_TERMS` | **[15, 20, 30]** | Available loan term options (years) |
| `DEFAULT_LOAN_TERM` | **30** | Default loan term (years) |
| `DEFAULT_ASKING_PRICE` | **$1,000,000** | Fallback property price |
| `DEFAULT_GROSS_INCOME` | **$120,000** | Fallback gross rental income |
| `DEFAULT_OPERATING_EXPENSES` | **$40,000** | Fallback operating expenses |
| `IRR_INITIAL_GUESS` | **0.1** | IRR calculation starting guess |
| `IRR_TOLERANCE` | **0.0001** | IRR convergence tolerance |
| `IRR_MAX_ITERATIONS` | **100** | IRR max iterations |
| `BALANCE_THRESHOLD` | **0.01** | Minimum balance threshold |
| `MONTHS_PER_YEAR` | **12** | Months per year constant |
| `PROPERTY_TYPES` | **[Single Family, Multi Family, Apartment, Commercial, Other]** | Available property types |

---

## Formatting Utilities
`lib/utils/formatting.ts`

| Function | Description | Example |
|---|---|---|
| `formatCurrency(value)` | Full currency, no decimals | `formatCurrency(1234567)` → `$1,234,567` |
| `formatCurrencyShort(value)` | Compact for charts | `formatCurrencyShort(1500000)` → `$1.5M` |
| `formatPercent(value, decimals?)` | Decimal to percent string | `formatPercent(0.075)` → `7.50%` |
| `formatNumber(value, decimals?)` | Number with commas | `formatNumber(50000)` → `50,000` |

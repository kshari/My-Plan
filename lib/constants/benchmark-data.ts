import type { BenchmarkRow } from '@/lib/demographics'

/**
 * Static benchmark data from Federal Reserve SCF 2022 and BLS.
 * Used as fallback in try mode and seeded into fp_benchmarks for auth mode.
 */
export const BENCHMARK_DATA: BenchmarkRow[] = [
  // Net Worth by age
  { metric: 'net_worth', age_min: 18, age_max: 34, household_type: 'all', region: null, percentile_25: 8_700, percentile_50: 39_000, percentile_75: 130_000, percentile_90: 299_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'net_worth', age_min: 35, age_max: 44, household_type: 'all', region: null, percentile_25: 30_700, percentile_50: 135_600, percentile_75: 370_000, percentile_90: 850_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'net_worth', age_min: 45, age_max: 54, household_type: 'all', region: null, percentile_25: 54_000, percentile_50: 247_200, percentile_75: 715_000, percentile_90: 1_500_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'net_worth', age_min: 55, age_max: 64, household_type: 'all', region: null, percentile_25: 72_000, percentile_50: 364_500, percentile_75: 1_000_000, percentile_90: 2_200_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'net_worth', age_min: 65, age_max: 99, household_type: 'all', region: null, percentile_25: 95_000, percentile_50: 409_900, percentile_75: 1_170_000, percentile_90: 2_700_000, source: 'Federal Reserve SCF 2022', year: 2022 },

  // Retirement Savings by age
  { metric: 'retirement_savings', age_min: 18, age_max: 34, household_type: 'all', region: null, percentile_25: 2_600, percentile_50: 18_800, percentile_75: 63_000, percentile_90: 140_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'retirement_savings', age_min: 35, age_max: 44, household_type: 'all', region: null, percentile_25: 10_500, percentile_50: 45_000, percentile_75: 155_000, percentile_90: 380_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'retirement_savings', age_min: 45, age_max: 54, household_type: 'all', region: null, percentile_25: 22_000, percentile_50: 115_000, percentile_75: 340_000, percentile_90: 800_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'retirement_savings', age_min: 55, age_max: 64, household_type: 'all', region: null, percentile_25: 35_000, percentile_50: 185_000, percentile_75: 530_000, percentile_90: 1_200_000, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'retirement_savings', age_min: 65, age_max: 99, household_type: 'all', region: null, percentile_25: 30_000, percentile_50: 200_000, percentile_75: 560_000, percentile_90: 1_400_000, source: 'Federal Reserve SCF 2022', year: 2022 },

  // Emergency Fund (months of expenses) by age
  { metric: 'emergency_months', age_min: 18, age_max: 34, household_type: 'all', region: null, percentile_25: 0.5, percentile_50: 1.5, percentile_75: 3.5, percentile_90: 6.0, source: 'Bankrate / BLS estimate', year: 2024 },
  { metric: 'emergency_months', age_min: 35, age_max: 44, household_type: 'all', region: null, percentile_25: 0.8, percentile_50: 2.0, percentile_75: 4.5, percentile_90: 8.0, source: 'Bankrate / BLS estimate', year: 2024 },
  { metric: 'emergency_months', age_min: 45, age_max: 54, household_type: 'all', region: null, percentile_25: 1.0, percentile_50: 2.5, percentile_75: 6.0, percentile_90: 12.0, source: 'Bankrate / BLS estimate', year: 2024 },
  { metric: 'emergency_months', age_min: 55, age_max: 64, household_type: 'all', region: null, percentile_25: 1.2, percentile_50: 3.0, percentile_75: 8.0, percentile_90: 15.0, source: 'Bankrate / BLS estimate', year: 2024 },
  { metric: 'emergency_months', age_min: 65, age_max: 99, household_type: 'all', region: null, percentile_25: 2.0, percentile_50: 5.0, percentile_75: 12.0, percentile_90: 24.0, source: 'Bankrate / BLS estimate', year: 2024 },

  // Savings Rate (% of income) by age
  { metric: 'savings_rate', age_min: 18, age_max: 34, household_type: 'all', region: null, percentile_25: 2, percentile_50: 6, percentile_75: 13, percentile_90: 22, source: 'BLS Consumer Expenditure Survey', year: 2023 },
  { metric: 'savings_rate', age_min: 35, age_max: 44, household_type: 'all', region: null, percentile_25: 3, percentile_50: 8, percentile_75: 15, percentile_90: 25, source: 'BLS Consumer Expenditure Survey', year: 2023 },
  { metric: 'savings_rate', age_min: 45, age_max: 54, household_type: 'all', region: null, percentile_25: 4, percentile_50: 10, percentile_75: 18, percentile_90: 28, source: 'BLS Consumer Expenditure Survey', year: 2023 },
  { metric: 'savings_rate', age_min: 55, age_max: 64, household_type: 'all', region: null, percentile_25: 5, percentile_50: 12, percentile_75: 20, percentile_90: 30, source: 'BLS Consumer Expenditure Survey', year: 2023 },
  { metric: 'savings_rate', age_min: 65, age_max: 99, household_type: 'all', region: null, percentile_25: 4, percentile_50: 10, percentile_75: 18, percentile_90: 26, source: 'BLS Consumer Expenditure Survey', year: 2023 },

  // Debt-to-Income Ratio by age
  { metric: 'dti_ratio', age_min: 18, age_max: 34, household_type: 'all', region: null, percentile_25: 8, percentile_50: 22, percentile_75: 38, percentile_90: 55, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'dti_ratio', age_min: 35, age_max: 44, household_type: 'all', region: null, percentile_25: 10, percentile_50: 25, percentile_75: 40, percentile_90: 58, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'dti_ratio', age_min: 45, age_max: 54, household_type: 'all', region: null, percentile_25: 6, percentile_50: 18, percentile_75: 34, percentile_90: 50, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'dti_ratio', age_min: 55, age_max: 64, household_type: 'all', region: null, percentile_25: 4, percentile_50: 14, percentile_75: 28, percentile_90: 44, source: 'Federal Reserve SCF 2022', year: 2022 },
  { metric: 'dti_ratio', age_min: 65, age_max: 99, household_type: 'all', region: null, percentile_25: 2, percentile_50: 8, percentile_75: 20, percentile_90: 36, source: 'Federal Reserve SCF 2022', year: 2022 },
]

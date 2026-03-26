/**
 * Tool definitions for OpenAI / Gemini / Claude so the model can request app
 * updates, read data, and trigger calculations.
 *
 * Keep in sync with lib/agent/actions.ts allowlist (mutate category) and
 * lib/agent/tool-executor.ts (read/calculate categories).
 *
 * category:
 *   'mutate'    — writes data; surfaced to user for confirmation before applying
 *   'read'      — fetches data from the DB; executed automatically in the tool loop
 *   'calculate' — runs a computation; executed automatically in the tool loop
 */

export type ToolCategory = 'mutate' | 'read' | 'calculate'

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // mutate
  update_fp_profile: 'mutate',
  update_rp_plan: 'mutate',
  update_rp_account: 'mutate',
  update_rp_expense: 'mutate',
  update_rp_other_income: 'mutate',
  create_rp_scenario: 'mutate',
  // read
  get_pulse_check_history: 'read',
  get_retirement_scenario_projection: 'read',
  // calculate
  calculate_future_value: 'calculate',
  calculate_retirement_projection: 'calculate',
  run_monte_carlo: 'calculate',
  calculate_tax_estimate: 'calculate',
  calculate_debt_payoff: 'calculate',
}

export const AGENT_TOOLS_OPENAI = [
  // ── Mutate ──────────────────────────────────────────────────────────────────

  {
    type: 'function' as const,
    function: {
      name: 'update_fp_profile',
      description: 'Update the user Financial Pulse profile fields.',
      parameters: {
        type: 'object',
        properties: {
          updates: {
            type: 'object',
            properties: {
              age: { type: 'number', description: 'Age in years' },
              state: { type: 'string', description: 'US state abbreviation (e.g. CA, NY)' },
              household_type: { type: 'string', enum: ['single', 'married', 'married_with_children'] },
              household_size: { type: 'number' },
              annual_gross_income: { type: 'number' },
              filing_status: { type: 'string', enum: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'] },
              total_retirement_savings: { type: 'number' },
              total_non_retirement_savings: { type: 'number' },
              monthly_expenses: { type: 'number' },
              monthly_savings: { type: 'number' },
              home_value: { type: 'number' },
              mortgage_balance: { type: 'number' },
            },
          },
        },
        required: ['updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_rp_plan',
      description: 'Update a retirement plan.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          updates: {
            type: 'object',
            properties: {
              plan_name: { type: 'string' },
              birth_year: { type: 'number' },
              life_expectancy: { type: 'number' },
              filing_status: { type: 'string' },
              include_spouse: { type: 'boolean' },
              spouse_birth_year: { type: 'number' },
              spouse_life_expectancy: { type: 'number' },
            },
          },
        },
        required: ['plan_id', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_rp_account',
      description: 'Update a retirement account.',
      parameters: {
        type: 'object',
        properties: {
          account_id: { type: 'number', description: 'Account ID from context' },
          updates: {
            type: 'object',
            properties: {
              account_name: { type: 'string' },
              owner: { type: 'string' },
              balance: { type: 'number' },
              account_type: { type: 'string' },
              annual_contribution: { type: 'number' },
            },
          },
        },
        required: ['account_id', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_rp_expense',
      description: 'Update a retirement expense.',
      parameters: {
        type: 'object',
        properties: {
          expense_id: { type: 'number', description: 'Expense ID from context' },
          updates: {
            type: 'object',
            properties: {
              expense_name: { type: 'string' },
              amount_before_65: { type: 'number' },
              amount_after_65: { type: 'number' },
            },
          },
        },
        required: ['expense_id', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_rp_other_income',
      description: 'Update a retirement other income source (Social Security, pension, etc.).',
      parameters: {
        type: 'object',
        properties: {
          income_id: { type: 'number', description: 'Other income ID from context' },
          updates: {
            type: 'object',
            properties: {
              income_name: { type: 'string' },
              annual_amount: { type: 'number' },
              start_age: { type: 'number' },
              end_age: { type: 'number' },
              cola: { type: 'number', description: 'Cost of living adjustment percent' },
            },
          },
        },
        required: ['income_id', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_rp_scenario',
      description: 'Create a new scenario for a retirement plan.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          scenario_name: { type: 'string' },
        },
        required: ['plan_id', 'scenario_name'],
      },
    },
  },
  // ── Read ─────────────────────────────────────────────────────────────────────

  {
    type: 'function' as const,
    function: {
      name: 'get_pulse_check_history',
      description:
        'Retrieve the full pulse check history for the user (net worth snapshots, mood, resilience scores). ' +
        'The conversation context only shows the latest 5; call this tool when the user asks about trends or history beyond that.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of records to return. Defaults to 50.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_retirement_scenario_projection',
      description:
        'Retrieve the stored year-by-year retirement projection details for a specific plan and scenario. ' +
        'Returns cash flow, net worth, tax, and income breakdowns per year. ' +
        'Use this before running a new projection to check if data already exists.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          scenario_id: { type: 'number', description: 'Scenario ID from context' },
        },
        required: ['plan_id', 'scenario_id'],
      },
    },
  },
  // ── Calculate ────────────────────────────────────────────────────────────────

  {
    type: 'function' as const,
    function: {
      name: 'calculate_future_value',
      description:
        'Calculate the future value of a lump-sum investment with optional monthly contributions using compound interest. ' +
        'Returns the future value, total contributions, and total growth.',
      parameters: {
        type: 'object',
        properties: {
          principal: { type: 'number', description: 'Starting amount in dollars' },
          annual_rate: { type: 'number', description: 'Annual growth rate as a decimal (e.g. 0.07 for 7%)' },
          years: { type: 'number', description: 'Number of years to project' },
          monthly_contribution: {
            type: 'number',
            description: 'Optional monthly contribution amount in dollars. Defaults to 0.',
          },
        },
        required: ['principal', 'annual_rate', 'years'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_retirement_projection',
      description:
        'Run the full retirement projection engine for the given plan and scenario. ' +
        'Returns key metrics: confidence score, portfolio value at retirement, estimated monthly income, ' +
        'years money lasts, and total taxes paid. ' +
        'Call this for retirement readiness questions, "when can I retire", or "will I run out of money". ' +
        'WHAT-IF SIMULATIONS: When a user asks "What if I retire at X?" or "What if I spend more/less?" or "What if returns are Y%?", ' +
        'pass the requested value as an override parameter (retirement_age, monthly_expenses_override, return_rate_override). ' +
        'The override runs a temporary simulation — it does NOT save anything. Never call mutation tools for what-if questions.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          scenario_id: { type: 'number', description: 'Scenario ID from context' },
          retirement_age: {
            type: 'number',
            description: 'Override retirement age for a what-if simulation (e.g. 54 for "retire 1 year early"). Omit to use the saved value.',
          },
          monthly_expenses_override: {
            type: 'number',
            description: 'Override total monthly retirement expenses in dollars for a what-if simulation. Omit to use the saved value.',
          },
          return_rate_override: {
            type: 'number',
            description: 'Override the assumed annual portfolio return rate as a decimal (e.g. 0.06 for 6%) for a what-if simulation. Applies to both pre- and post-retirement. Omit to use the saved value.',
          },
          life_expectancy_override: {
            type: 'number',
            description: 'Override life expectancy age for a what-if simulation. Omit to use the saved value.',
          },
          ssa_start_age_override: {
            type: 'number',
            description: 'Override the age at which Social Security (SSA) income begins. E.g. 62 for early claiming or 70 for delayed claiming.',
          },
          ssa_annual_amount_override: {
            type: 'number',
            description: 'Override the annual Social Security benefit amount in dollars. Targets income sources named "Social Security" or "SSA" in the plan. If none exist, a simulated SSA income source is added.',
          },
          pre_medicare_monthly_premium_override: {
            type: 'number',
            description: 'Override the monthly health insurance premium before age 65 (pre-Medicare) in dollars. E.g. 800 for $800/month ACA coverage.',
          },
          post_medicare_monthly_premium_override: {
            type: 'number',
            description: 'Override the monthly Medicare/supplemental insurance premium after age 65 in dollars.',
          },
          inflation_rate_override: {
            type: 'number',
            description: 'Override the annual inflation rate as a decimal (e.g. 0.04 for 4%). Affects expense growth and income adjustments throughout the projection.',
          },
          annual_contribution_override: {
            type: 'number',
            description: 'Override the total annual contribution to all retirement accounts in dollars. Existing contributions are scaled proportionally across accounts.',
          },
        },
        required: ['plan_id', 'scenario_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_monte_carlo',
      description:
        'Run a Monte Carlo simulation (randomized market return scenarios) for the given retirement plan and scenario. ' +
        'Returns success rate, percentile outcomes (P5/P25/median/P75/P95 net worth), and stress test results. ' +
        'Use this when the user asks about retirement risk, probability of running out of money, or worst-case scenarios. ' +
        'Supports the same what-if override parameters as calculate_retirement_projection ' +
        '(retirement_age, monthly_expenses_override, return_rate_override, life_expectancy_override).',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          scenario_id: { type: 'number', description: 'Scenario ID from context' },
          num_simulations: {
            type: 'number',
            description: 'Number of simulations to run. Defaults to 500 for speed; max 1000.',
          },
          retirement_age: {
            type: 'number',
            description: 'Override retirement age for a what-if simulation. Omit to use the saved value.',
          },
          monthly_expenses_override: {
            type: 'number',
            description: 'Override total monthly retirement expenses in dollars for a what-if simulation. Omit to use the saved value.',
          },
          return_rate_override: {
            type: 'number',
            description: 'Override the assumed annual portfolio return rate as a decimal for a what-if simulation. Omit to use the saved value.',
          },
          life_expectancy_override: {
            type: 'number',
            description: 'Override life expectancy age for a what-if simulation. Omit to use the saved value.',
          },
          ssa_start_age_override: {
            type: 'number',
            description: 'Override the age at which Social Security income begins (e.g. 62 for early or 70 for delayed claiming).',
          },
          ssa_annual_amount_override: {
            type: 'number',
            description: 'Override the annual Social Security benefit in dollars.',
          },
          pre_medicare_monthly_premium_override: {
            type: 'number',
            description: 'Override the monthly health insurance premium before age 65 in dollars.',
          },
          post_medicare_monthly_premium_override: {
            type: 'number',
            description: 'Override the monthly Medicare/supplemental insurance premium after age 65 in dollars.',
          },
          inflation_rate_override: {
            type: 'number',
            description: 'Override the annual inflation rate as a decimal (e.g. 0.04 for 4%).',
          },
          annual_contribution_override: {
            type: 'number',
            description: 'Override the total annual retirement account contribution in dollars.',
          },
        },
        required: ['plan_id', 'scenario_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_tax_estimate',
      description:
        'Estimate federal income tax liability for a given gross income and filing status. ' +
        'Returns taxable income, effective tax rate, marginal tax rate, tax owed, and bracket breakdown. ' +
        'Uses 2024 tax brackets. Does NOT account for state taxes, itemized deductions, or credits beyond the standard deduction.',
      parameters: {
        type: 'object',
        properties: {
          gross_income: { type: 'number', description: 'Annual gross income in dollars' },
          filing_status: {
            type: 'string',
            enum: ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household'],
            description: 'IRS filing status',
          },
        },
        required: ['gross_income', 'filing_status'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_debt_payoff',
      description:
        'Calculate how long it will take to pay off the user\'s debts and the total interest paid, ' +
        'comparing avalanche (highest-rate first) and snowball (lowest-balance first) strategies. ' +
        'Reads debt data from the user\'s Financial Pulse profile.',
      parameters: {
        type: 'object',
        properties: {
          extra_monthly_payment: {
            type: 'number',
            description: 'Optional extra amount to add to minimum payments each month. Defaults to 0.',
          },
        },
        required: [],
      },
    },
  },
]

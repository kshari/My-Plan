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
  update_pi_property: 'mutate',
  // read
  get_pulse_check_history: 'read',
  get_retirement_scenario_projection: 'read',
  get_property_financial_scenarios: 'read',
  // calculate
  calculate_future_value: 'calculate',
  calculate_retirement_projection: 'calculate',
  run_monte_carlo: 'calculate',
  calculate_property_metrics: 'calculate',
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
  {
    type: 'function' as const,
    function: {
      name: 'update_pi_property',
      description: 'Update a property investment.',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: 'Property ID from context' },
          updates: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              type: { type: 'string' },
              'Number of Units': { type: 'number' },
              'Has HOA': { type: 'boolean' },
              'Asking Price': { type: 'number' },
              'Gross Income': { type: 'number' },
              'Operating Expenses': { type: 'number' },
            },
          },
        },
        required: ['property_id', 'updates'],
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
  {
    type: 'function' as const,
    function: {
      name: 'get_property_financial_scenarios',
      description:
        'Retrieve all financial scenarios (loan terms, down payments, price assumptions) for a property. ' +
        'Returns full scenario rows so you can discuss or compare them.',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: 'Property ID from context' },
        },
        required: ['property_id'],
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
        'Run the full retirement projection engine for the given plan and scenario using the user\'s actual data. ' +
        'Returns key metrics: confidence score, portfolio value at retirement, estimated monthly income, ' +
        'years money lasts, and total taxes paid. Call this for questions about retirement readiness, ' +
        '"when can I retire", or "will I run out of money".',
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
  {
    type: 'function' as const,
    function: {
      name: 'run_monte_carlo',
      description:
        'Run a Monte Carlo simulation (randomized market return scenarios) for the given retirement plan and scenario. ' +
        'Returns success rate, percentile outcomes (P5/P25/median/P75/P95 net worth), and stress test results. ' +
        'Use this when the user asks about retirement risk, probability of running out of money, or worst-case scenarios.',
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'number', description: 'Retirement plan ID from context' },
          scenario_id: { type: 'number', description: 'Scenario ID from context' },
          num_simulations: {
            type: 'number',
            description: 'Number of simulations to run. Defaults to 500 for speed; max 1000.',
          },
        },
        required: ['plan_id', 'scenario_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'calculate_property_metrics',
      description:
        'Calculate investment metrics for a property: cap rate, NOI, cash-on-cash return (CoCR), ' +
        'gross rent multiplier (GRM), 1% rule ratio, and an investment score (0–100). ' +
        'Requires the user to have at least one financial scenario saved for the property.',
      parameters: {
        type: 'object',
        properties: {
          property_id: { type: 'number', description: 'Property ID from context' },
        },
        required: ['property_id'],
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

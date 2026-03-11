/**
 * Tool definitions for OpenAI / Gemini so the model can request app updates.
 * Keep in sync with lib/agent/actions.ts allowlist.
 */
export const AGENT_TOOLS_OPENAI = [
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
]

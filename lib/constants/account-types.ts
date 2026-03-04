/**
 * Retirement account type constants.
 * Single source of truth for account type strings used throughout the app.
 */

export const ACCOUNT_TYPE_401K     = '401k'       as const
export const ACCOUNT_TYPE_IRA      = 'IRA'        as const
export const ACCOUNT_TYPE_ROTH_IRA = 'Roth IRA'   as const
export const ACCOUNT_TYPE_HSA      = 'HSA'        as const
export const ACCOUNT_TYPE_TAXABLE  = 'Taxable'    as const
export const ACCOUNT_TYPE_OTHER    = 'Other'      as const

/** All supported account types (for dropdowns, iterations, etc.) */
export const ACCOUNT_TYPES = [
  ACCOUNT_TYPE_401K,
  ACCOUNT_TYPE_IRA,
  ACCOUNT_TYPE_ROTH_IRA,
  ACCOUNT_TYPE_HSA,
  ACCOUNT_TYPE_TAXABLE,
  ACCOUNT_TYPE_OTHER,
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** Tax-deferred (traditional) accounts whose withdrawals are ordinary income */
export const TAX_DEFERRED_ACCOUNTS: readonly AccountType[] = [
  ACCOUNT_TYPE_401K,
  ACCOUNT_TYPE_IRA,
]

/** Tax-free accounts whose withdrawals are not taxable */
export const TAX_FREE_ACCOUNTS: readonly AccountType[] = [
  ACCOUNT_TYPE_ROTH_IRA,
  ACCOUNT_TYPE_HSA,
]

/** Default accounts for a new plan */
export const DEFAULT_PLAN_ACCOUNTS: { account_name: string; account_type: AccountType; balance: number }[] = [
  { account_name: '401(k)',       account_type: ACCOUNT_TYPE_401K,     balance: 0 },
  { account_name: 'IRA',          account_type: ACCOUNT_TYPE_IRA,      balance: 0 },
  { account_name: 'Roth IRA',     account_type: ACCOUNT_TYPE_ROTH_IRA, balance: 0 },
  { account_name: 'HSA',          account_type: ACCOUNT_TYPE_HSA,      balance: 0 },
  { account_name: 'Taxable',      account_type: ACCOUNT_TYPE_TAXABLE,  balance: 0 },
  { account_name: 'Other',        account_type: ACCOUNT_TYPE_OTHER,    balance: 0 },
]

/** Default expense categories for a new plan */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { expense_name: 'Housing (Rent/Mortgage)', annual_amount: 36000 },
  { expense_name: 'Healthcare & Insurance',  annual_amount: 12000 },
  { expense_name: 'Food & Groceries',        annual_amount: 9600 },
  { expense_name: 'Transportation',          annual_amount: 6000 },
  { expense_name: 'Utilities & Services',    annual_amount: 4800 },
  { expense_name: 'Personal & Leisure',      annual_amount: 3600 },
] as const

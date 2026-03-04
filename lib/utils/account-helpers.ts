import {
  TAX_DEFERRED_ACCOUNTS,
  TAX_FREE_ACCOUNTS,
  type AccountType,
} from '@/lib/constants/account-types'

type NormalizedType = AccountType | 'Roth 401k'

const NORMALIZATION_MAP: Record<string, NormalizedType> = {
  '401k': '401k',
  '401(k)': '401k',
  'traditional 401k': '401k',
  'ira': 'IRA',
  'traditional ira': 'IRA',
  'roth ira': 'Roth IRA',
  'roth': 'Roth IRA',
  'roth 401k': 'Roth 401k',
  'roth 401(k)': 'Roth 401k',
  'hsa': 'HSA',
  'taxable': 'Taxable',
  'brokerage': 'Taxable',
}

/** Normalize an account type string to a canonical key. */
export function normalizeAccountType(type: string | null | undefined): NormalizedType {
  const key = (type || 'Other').trim().toLowerCase()
  return NORMALIZATION_MAP[key] ?? 'Other'
}

/** Check if an account type is tax-deferred (Traditional IRA, 401k, etc.) */
export function isTaxDeferred(type: string): boolean {
  const normalized = normalizeAccountType(type)
  return (TAX_DEFERRED_ACCOUNTS as readonly string[]).includes(normalized)
}

/** Check if an account type is tax-free (Roth IRA, Roth 401k, HSA) */
export function isTaxFree(type: string): boolean {
  const normalized = normalizeAccountType(type)
  return (TAX_FREE_ACCOUNTS as readonly string[]).includes(normalized) || normalized === 'Roth 401k'
}

/** Get the balance field name for a projection detail row. */
export function getProjectionBalanceField(accountType: string): string {
  const t = normalizeAccountType(accountType)
  switch (t) {
    case '401k': return 'balance_401k'
    case 'IRA': return 'balance_ira'
    case 'Roth IRA': return 'balance_roth'
    case 'Roth 401k': return 'balance_roth_401k'
    case 'HSA': return 'balance_hsa'
    case 'Taxable': return 'balance_taxable'
    default: return 'balance_other'
  }
}

/** Get the distribution field name for a projection detail row. */
export function getProjectionDistributionField(accountType: string): string {
  const t = normalizeAccountType(accountType)
  switch (t) {
    case '401k': return 'distribution_401k'
    case 'IRA': return 'distribution_ira'
    case 'Roth IRA': return 'distribution_roth'
    case 'Roth 401k': return 'distribution_roth_401k'
    case 'HSA': return 'distribution_hsa'
    case 'Taxable': return 'distribution_taxable'
    default: return 'distribution_other'
  }
}

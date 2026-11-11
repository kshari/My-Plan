export type AppId = 'pulse' | 'retirement' | 'property' | 'partnerships' | 'family'

export interface SetupStep {
  label: string
  done: boolean
}

export interface SetupState {
  steps: SetupStep[]
  /** 0–100 */
  pctComplete: number
}

export type MetricTone = 'positive' | 'negative' | 'neutral' | 'warning'

export interface AppMetric {
  label: string
  value: string
  tone?: MetricTone
}

export interface AppSummary {
  app: AppId
  /** null means user has not started the app at all */
  started: boolean
  setup: SetupState
  metrics: AppMetric[]
  /** The single most important next action. href links into the app. */
  primaryCta: { label: string; href: string }
  /**
   * Net worth contribution for this app (for Plan Health strip aggregation).
   * undefined when not computable.
   */
  netWorth?: number
}

/** Shape stored in the `setup_state` jsonb column */
export type CachedSetupState = SetupState

/** Shape stored in the `metrics` jsonb column */
export interface CachedMetrics {
  items: AppMetric[]
  netWorth?: number
  started: boolean
}

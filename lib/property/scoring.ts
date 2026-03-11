/**
 * Shared investment scoring logic with user-configurable weights and targets.
 * Used by property-list, property-details, portfolio-summary, property-compare, and city-county-analytics.
 */

export interface ScoringConfig {
  capRateWeight: number
  capRateTarget: number
  roiWeight: number
  roiTarget: number
  cashFlowWeight: number
  onePercentWeight: number
  onePercentTarget: number
  grmWeight: number
  grmFullTarget: number
  grmZeroTarget: number
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  capRateWeight: 25,
  capRateTarget: 10,
  roiWeight: 25,
  roiTarget: 15,
  cashFlowWeight: 20,
  onePercentWeight: 15,
  onePercentTarget: 2,
  grmWeight: 15,
  grmFullTarget: 8,
  grmZeroTarget: 15,
}

export interface ScoreComponent {
  label: string
  pts: number
  maxPts: number
  description: string
}

export interface ScoreResult {
  score: number
  components: ScoreComponent[]
}

export function computeInvestmentScore(
  config: ScoringConfig,
  data: {
    capRate: number
    roi: number
    annualCashFlow: number
    noiForCalcs: number
    onePercentRatio: number | null
    grm: number | null
  },
  formatDollars: (v: number) => string,
): ScoreResult {
  const { capRate, roi, annualCashFlow, noiForCalcs, onePercentRatio, grm } = data

  const capPts = Math.min(config.capRateWeight, (capRate / config.capRateTarget) * config.capRateWeight)
  const roiPts = Math.min(config.roiWeight, Math.max(0, (roi / config.roiTarget) * config.roiWeight))
  const cfPts = annualCashFlow > 0
    ? config.cashFlowWeight
    : Math.max(0, config.cashFlowWeight + (annualCashFlow / (noiForCalcs || 1)) * config.cashFlowWeight)
  const onePctPts = onePercentRatio != null
    ? Math.min(config.onePercentWeight, (onePercentRatio / config.onePercentTarget) * config.onePercentWeight)
    : 0
  const grmRange = config.grmZeroTarget - config.grmFullTarget
  const grmPts = grm != null && grmRange > 0
    ? Math.max(0, Math.min(config.grmWeight, ((config.grmZeroTarget - grm) / grmRange) * config.grmWeight))
    : 0

  const total = config.capRateWeight + config.roiWeight + config.cashFlowWeight + config.onePercentWeight + config.grmWeight
  const rawScore = capPts + roiPts + cfPts + onePctPts + grmPts
  const score = Math.round(Math.max(0, Math.min(100, (rawScore / total) * 100)))

  const norm = (pts: number, weight: number) => Math.round((pts / weight) * (weight / total) * 100)

  const components: ScoreComponent[] = [
    {
      label: 'Cap Rate',
      pts: norm(capPts, config.capRateWeight),
      maxPts: Math.round((config.capRateWeight / total) * 100),
      description: `${capRate.toFixed(2)}% (target ≥ ${config.capRateTarget}% for full score)`,
    },
    {
      label: 'ROI / CoCR',
      pts: norm(roiPts, config.roiWeight),
      maxPts: Math.round((config.roiWeight / total) * 100),
      description: `${roi.toFixed(1)}% cash-on-cash return (target ≥ ${config.roiTarget}% for full score)`,
    },
    {
      label: 'Cash Flow',
      pts: norm(cfPts, config.cashFlowWeight),
      maxPts: Math.round((config.cashFlowWeight / total) * 100),
      description: annualCashFlow > 0 ? `Positive ${formatDollars(annualCashFlow)}/yr` : `Negative ${formatDollars(annualCashFlow)}/yr`,
    },
    {
      label: '1% Rule',
      pts: norm(onePctPts, config.onePercentWeight),
      maxPts: Math.round((config.onePercentWeight / total) * 100),
      description: onePercentRatio != null
        ? `${onePercentRatio.toFixed(2)}% (target ≥ ${config.onePercentTarget}% for full score; ≥ 1% to pass)`
        : 'No rent data',
    },
    {
      label: 'GRM',
      pts: norm(grmPts, config.grmWeight),
      maxPts: Math.round((config.grmWeight / total) * 100),
      description: grm != null
        ? `${grm.toFixed(1)}× (target ≤ ${config.grmFullTarget} for full score; ≤ ${config.grmZeroTarget} is fair)`
        : 'No rent data',
    },
  ]

  return { score, components }
}

/**
 * Quick score-only computation (no component descriptions) for list/summary views.
 */
export function computeScoreOnly(
  config: ScoringConfig,
  data: {
    capRate: number
    roi: number | null
    annualCashFlow: number
    noiForCalcs: number
    onePercentRatio: number | null
    grm: number | null
  },
): number {
  const { capRate, roi, annualCashFlow, noiForCalcs, onePercentRatio, grm } = data

  const capPts = Math.min(config.capRateWeight, (capRate / config.capRateTarget) * config.capRateWeight)
  const roiPts = roi != null ? Math.min(config.roiWeight, Math.max(0, (roi / config.roiTarget) * config.roiWeight)) : 0
  const cfPts = annualCashFlow > 0
    ? config.cashFlowWeight
    : Math.max(0, config.cashFlowWeight + (annualCashFlow / (noiForCalcs || 1)) * config.cashFlowWeight)
  const onePctPts = onePercentRatio != null
    ? Math.min(config.onePercentWeight, (onePercentRatio / config.onePercentTarget) * config.onePercentWeight)
    : 0
  const grmRange = config.grmZeroTarget - config.grmFullTarget
  const grmPts = grm != null && grmRange > 0
    ? Math.max(0, Math.min(config.grmWeight, ((config.grmZeroTarget - grm) / grmRange) * config.grmWeight))
    : 0

  const total = config.capRateWeight + config.roiWeight + config.cashFlowWeight + config.onePercentWeight + config.grmWeight
  const rawScore = capPts + roiPts + cfPts + onePctPts + grmPts
  return Math.round(Math.max(0, Math.min(100, (rawScore / total) * 100)))
}

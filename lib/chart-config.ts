/**
 * Theme-aware chart color palette.
 * Uses CSS custom properties defined in globals.css so charts adapt to dark mode.
 */

export const CHART_COLORS = {
  primary: "var(--color-chart-1)",
  secondary: "var(--color-chart-2)",
  tertiary: "var(--color-chart-3)",
  quaternary: "var(--color-chart-4)",
  quinary: "var(--color-chart-5)",
  // Semantic aliases
  positive: "#16a34a",   // green-600 — gains, income
  negative: "#dc2626",   // red-600  — losses, expenses
  neutral: "var(--color-muted-foreground)",
  grid: "var(--color-border)",
} as const

export const CHART_GRID_STYLE = {
  strokeDasharray: "3 3",
  stroke: "var(--color-border)",
  strokeOpacity: 0.8,
}

export const CHART_AXIS_STYLE = {
  tick: { fill: "var(--color-muted-foreground)", fontSize: 11 },
  axisLine: { stroke: "var(--color-border)" },
  tickLine: { stroke: "var(--color-border)" },
}

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    color: "var(--color-popover-foreground)",
    fontSize: "12px",
    padding: "8px 12px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
  },
  labelStyle: {
    color: "var(--color-foreground)",
    fontWeight: 600,
    marginBottom: "4px",
  },
  itemStyle: {
    color: "var(--color-muted-foreground)",
  },
}

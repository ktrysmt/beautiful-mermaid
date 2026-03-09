// ============================================================================
// Design tokens — shared typography and chart-size scales.
//
// This is the single source of truth for cross-diagram visual rhythm.
// Existing modules can keep their local/public constant names and map to these
// semantic tokens to avoid breaking imports while centralizing values.
// ============================================================================

/** Semantic typography roles (size in px + font weight). */
export const TYPOGRAPHY = {
  /** Primary diagram title text */
  title: { size: 18, weight: 600 },

  /** Axis title text (e.g. "Revenue", "Time") */
  axisTitle: { size: 15, weight: 500 },

  /** Axis tick labels + secondary section labels */
  axisLabel: { size: 14, weight: 400 },

  /** Primary in-node/primary label text */
  primaryLabel: { size: 13, weight: 500 },

  /** Secondary label text (point/task/event labels) */
  secondaryLabel: { size: 12, weight: 400 },

  /** Small meta labels (edge labels, compact axis ticks) */
  edgeMeta: { size: 11, weight: 400 },

  /** Emphasized headers (e.g. subgraph headers) */
  groupHeader: { size: 12, weight: 600 },

  /** Emphasized quadrant labels */
  emphasisLabel: { size: 16, weight: 500 },

  /** Tooltip labels/values */
  tooltipLabel: { size: 15, weight: 500 },

  /** Heavier section headings */
  sectionHeading: { size: 14, weight: 600 },
} as const

/** Shared chart spacing primitives. */
export const SPACING = {
  padding: 22,
} as const

/** Fixed chart-size profiles for chart-like diagrams. */
export const CHART_SIZE_PROFILES = {
  compact: {
    xy: { plotWidth: 520, plotHeight: 300 },
    quadrant: { plotSize: 400 },
    gantt: { plotWidth: 520 },
  },
  default: {
    xy: { plotWidth: 600, plotHeight: 340 },
    quadrant: { plotSize: 460 },
    gantt: { plotWidth: 600 },
  },
  large: {
    xy: { plotWidth: 680, plotHeight: 380 },
    quadrant: { plotSize: 500 },
    gantt: { plotWidth: 680 },
  },
} as const

/** Current runtime profile (kept as default for backwards-compatible output). */
export const CHART_SIZES = CHART_SIZE_PROFILES.default

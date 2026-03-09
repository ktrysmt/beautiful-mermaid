// ============================================================================
// Shared chart constants — used by all chart-type diagrams.
//
// Provides consistent typography, spacing, and layout values so that
// xychart, gantt, timeline, and quadrant charts share the same visual
// language. Diagram-specific constants live in their own layout/renderer.
// ============================================================================

import { SPACING, TYPOGRAPHY } from './design-tokens'

/** Shared font metrics for chart titles, axes, and labels */
export const CHART = {
  /** Chart title */
  titleFontSize: TYPOGRAPHY.title.size,
  titleFontWeight: TYPOGRAPHY.title.weight,
  titleHeight: 42,

  /** Axis tick labels (date labels, category labels) */
  axisLabelFontSize: TYPOGRAPHY.axisLabel.size,
  axisLabelFontWeight: TYPOGRAPHY.axisLabel.weight,

  /** Axis titles ("Revenue", "Time") */
  axisTitleFontSize: TYPOGRAPHY.axisTitle.size,
  axisTitleFontWeight: TYPOGRAPHY.axisTitle.weight,

  /** Section / group labels */
  labelFontSize: TYPOGRAPHY.primaryLabel.size,
  labelFontWeight: TYPOGRAPHY.primaryLabel.weight,

  /** Legend text */
  legendFontSize: TYPOGRAPHY.axisLabel.size,
  legendFontWeight: TYPOGRAPHY.axisLabel.weight,

  /** Canvas padding around all edges */
  padding: SPACING.padding,
} as const

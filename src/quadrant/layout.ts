import type { QuadrantChart, PositionedQuadrantChart, PositionedLabel, PositionedQuadrantPoint } from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { CHART_SIZES, TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Quadrant chart layout engine
//
// Custom coordinate layout — a square plot area divided into four quadrants
// with axis labels and data points. No ELK needed.
// ============================================================================

const QC = {
  plotSize: CHART_SIZES.quadrant.plotSize,
  padding: CHART.padding,
  // Slightly smaller than shared chart title size for quadrant charts.
  titleFontSize: 16,
  titleFontWeight: CHART.titleFontWeight,
  titleHeight: CHART.titleHeight,
  axisLabelFontSize: CHART.axisLabelFontSize,
  axisLabelFontWeight: CHART.axisLabelFontWeight,
  axisLabelPad: 24,
  quadrantLabelFontSize: TYPOGRAPHY.emphasisLabel.size,
  quadrantLabelFontWeight: TYPOGRAPHY.emphasisLabel.weight,
  pointRadius: 6,
  pointLabelFontSize: TYPOGRAPHY.secondaryLabel.size,
  pointLabelFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  pointLabelOffset: 10,
} as const

export function layoutQuadrantChart(
  chart: QuadrantChart,
  _options: RenderOptions = {},
): PositionedQuadrantChart {
  const hasTitle = !!chart.title
  const hasYLabel = !!(chart.yAxis.bottom || chart.yAxis.top)
  const hasXLabel = !!(chart.xAxis.left || chart.xAxis.right)

  const top = QC.padding + (hasTitle ? QC.titleHeight : 0)
  const bottom = QC.padding + (hasXLabel ? QC.axisLabelPad : 0)
  const left = QC.padding + (hasYLabel ? QC.axisLabelPad : 0)
  const right = QC.padding

  const plotSize = QC.plotSize
  const totalH = top + plotSize + bottom

  const plotArea = { x: left, y: top, width: plotSize, height: plotSize }
  const midX = left + plotSize / 2
  const midY = top + plotSize / 2

  // Divider lines
  const dividers = [
    { x1: midX, y1: top, x2: midX, y2: top + plotSize },          // vertical
    { x1: left, y1: midY, x2: left + plotSize, y2: midY },         // horizontal
  ]

  // Axis labels
  const xAxis: PositionedQuadrantChart['xAxis'] = {}
  if (chart.xAxis.left) {
    xAxis.left = {
      text: chart.xAxis.left,
      x: left + plotSize * 0.25,
      y: top + plotSize + QC.axisLabelPad - 4,
      textAnchor: 'middle',
    }
  }
  if (chart.xAxis.right) {
    xAxis.right = {
      text: chart.xAxis.right,
      x: left + plotSize * 0.75,
      y: top + plotSize + QC.axisLabelPad - 4,
      textAnchor: 'middle',
    }
  }

  const yAxis: PositionedQuadrantChart['yAxis'] = {}
  if (chart.yAxis.bottom) {
    yAxis.bottom = {
      text: chart.yAxis.bottom,
      x: left - QC.axisLabelPad + 4,
      y: top + plotSize * 0.75,
      textAnchor: 'middle',
    }
  }
  if (chart.yAxis.top) {
    yAxis.top = {
      text: chart.yAxis.top,
      x: left - QC.axisLabelPad + 4,
      y: top + plotSize * 0.25,
      textAnchor: 'middle',
    }
  }

  // Quadrant labels (centered in each quadrant)
  const quadrantLabels: PositionedLabel[] = []
  const quadrantPositions = [
    { x: left + plotSize * 0.75, y: top + plotSize * 0.25 },  // Q1 top-right
    { x: left + plotSize * 0.25, y: top + plotSize * 0.25 },  // Q2 top-left
    { x: left + plotSize * 0.25, y: top + plotSize * 0.75 },  // Q3 bottom-left
    { x: left + plotSize * 0.75, y: top + plotSize * 0.75 },  // Q4 bottom-right
  ]
  for (let i = 0; i < 4; i++) {
    if (chart.quadrants[i]) {
      quadrantLabels.push({
        text: chart.quadrants[i]!,
        x: quadrantPositions[i]!.x,
        y: quadrantPositions[i]!.y,
        textAnchor: 'middle',
      })
    }
  }

  // Data points
  const points: PositionedQuadrantPoint[] = chart.points.map(p => {
    const cx = left + p.x * plotSize
    const cy = top + (1 - p.y) * plotSize  // y is inverted (0=bottom, 1=top)
    const radius = p.style?.radius ?? QC.pointRadius
    return {
      name: p.name,
      cx,
      cy,
      radius,
      labelX: cx + radius + QC.pointLabelOffset,
      labelY: cy,
      style: p.style,
    }
  })

  // Expand right margin when point labels would overflow the SVG width.
  // Example: points near x=1 with long names (e.g. "jQuery") should remain visible.
  const plotRight = left + plotSize
  let requiredRightPadding = right
  for (const p of points) {
    const textW = estimateTextWidth(p.name, QC.pointLabelFontSize, QC.pointLabelFontWeight)
    const labelRight = p.labelX + textW
    const overflow = labelRight - plotRight
    if (overflow > 0) {
      requiredRightPadding = Math.max(requiredRightPadding, overflow + QC.padding)
    }
  }

  const totalW = left + plotSize + requiredRightPadding

  // Title
  const title = hasTitle
    ? { text: chart.title!, x: totalW / 2, y: QC.padding + QC.titleFontSize }
    : undefined

  return {
    width: totalW,
    height: totalH,
    title,
    plotArea,
    xAxis,
    yAxis,
    quadrantLabels,
    dividers,
    points,
  }
}

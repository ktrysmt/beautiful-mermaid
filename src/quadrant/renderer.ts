import type { PositionedQuadrantChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Quadrant chart SVG renderer
//
// Renders a positioned quadrant chart to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   1. Quadrant background fills (subtle alternating tints)
//   2. Divider lines (cross-hair at 0.5)
//   3. Quadrant labels (large, muted)
//   4. Data points (filled circles)
//   5. Point labels
//   6. Axis labels
//   7. Title
// ============================================================================

const QR = {
  pointLabelFontSize: TYPOGRAPHY.secondaryLabel.size,
  pointLabelFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  // Keep quadrant labels softer than the previous emphasized size.
  quadrantLabelFontSize: 14,
  quadrantLabelFontWeight: TYPOGRAPHY.emphasisLabel.weight,
  // Slightly smaller title than shared chart default for quadrant charts.
  titleFontSize: 16,
  titleFontWeight: CHART.titleFontWeight,
  quadrantCornerRadius: 8,
} as const

export function renderQuadrantSvg(
  chart: PositionedQuadrantChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  const { plotArea: pa } = chart
  const midX = pa.x + pa.width / 2
  const midY = pa.y + pa.height / 2

  // 1. Quadrant background fills (alternating subtle tints)
  // Rounded only on the OUTER border via clipPath; center divider stays sharp.
  const quadClipId = 'quadrant-plot-clip'
  parts.push(
    `<defs><clipPath id="${quadClipId}" clipPathUnits="userSpaceOnUse">` +
    `<rect x="${pa.x}" y="${pa.y}" width="${pa.width}" height="${pa.height}" ` +
    `rx="${QR.quadrantCornerRadius}" ry="${QR.quadrantCornerRadius}"/></clipPath></defs>`
  )

  // Q2 (top-left), Q1 (top-right), Q3 (bottom-left), Q4 (bottom-right)
  const quads = [
    { x: pa.x, y: pa.y, w: pa.width / 2, h: pa.height / 2, fill: 'var(--_node-fill)' },           // Q2
    { x: midX, y: pa.y, w: pa.width / 2, h: pa.height / 2, fill: 'var(--_group-hdr)' },            // Q1
    { x: pa.x, y: midY, w: pa.width / 2, h: pa.height / 2, fill: 'var(--_group-hdr)' },            // Q3
    { x: midX, y: midY, w: pa.width / 2, h: pa.height / 2, fill: 'var(--_node-fill)' },            // Q4
  ]
  parts.push(`<g clip-path="url(#${quadClipId})">`)
  for (const q of quads) {
    parts.push(`<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${q.fill}" rx="0" ry="0"/>`)
  }
  parts.push('</g>')

  // 2. Divider lines
  for (const d of chart.dividers) {
    parts.push(`<line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="var(--_inner-stroke)" stroke-width="1"/>`)
  }

  // 3. Quadrant labels
  for (const ql of chart.quadrantLabels) {
    parts.push(
      `<text x="${ql.x}" y="${ql.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="${ql.textAnchor ?? 'middle'}" ` +
      `font-size="${QR.quadrantLabelFontSize}" font-weight="${QR.quadrantLabelFontWeight}" ` +
      `fill="var(--_text-faint)" ` +
      `style="pointer-events:none">${escapeXml(ql.text)}</text>`
    )
  }

  // 4. Data points
  for (const p of chart.points) {
    const fill = p.style?.color ?? 'var(--_arrow)'
    const strokeColor = p.style?.strokeColor ?? 'none'
    const strokeWidth = p.style?.strokeWidth ?? 0
    parts.push(
      `<circle cx="${p.cx}" cy="${p.cy}" r="${p.radius}" ` +
      `fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`
    )
  }

  // 5. Point labels
  for (const p of chart.points) {
    parts.push(
      `<text x="${p.labelX}" y="${p.labelY}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="start" ` +
      `font-size="${QR.pointLabelFontSize}" font-weight="${QR.pointLabelFontWeight}" ` +
      `fill="var(--_text)">${escapeXml(p.name)}</text>`
    )
  }

  // 6. Axis labels
  const axisLabels = [chart.xAxis.left, chart.xAxis.right, chart.yAxis.bottom, chart.yAxis.top]
    .filter((l): l is NonNullable<typeof l> => !!l)

  for (const label of axisLabels) {
    const isVertical = label === chart.yAxis.bottom || label === chart.yAxis.top
    const rotate = isVertical ? ` transform="rotate(-90, ${label.x}, ${label.y})"` : ''
    parts.push(
      `<text x="${label.x}" y="${label.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="${label.textAnchor ?? 'middle'}" ` +
      `font-size="${CHART.axisLabelFontSize}" font-weight="${CHART.axisLabelFontWeight}" ` +
      `fill="var(--_text-muted)"${rotate}>${escapeXml(label.text)}</text>`
    )
  }

  // 7. Title
  if (chart.title) {
    parts.push(
      `<text x="${chart.title.x}" y="${chart.title.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="middle" ` +
      `font-size="${QR.titleFontSize}" font-weight="${QR.titleFontWeight}" ` +
      `fill="var(--_text)">${escapeXml(chart.title.text)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

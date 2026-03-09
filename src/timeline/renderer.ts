import type { PositionedTimelineDiagram } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Timeline diagram SVG renderer
//
// Renders a positioned timeline to SVG with:
//   1. Section header bars (colored, with label)
//   2. Central horizontal arrow line
//   3. Period boxes sitting on the arrow
//   4. Dashed vertical connectors from periods to events
//   5. Event cards (above or below the timeline)
//   6. Title
//
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
// ============================================================================

const TR = {
  periodFontSize: CHART.labelFontSize,
  periodFontWeight: CHART.labelFontWeight,
  eventFontSize: TYPOGRAPHY.secondaryLabel.size,
  eventFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  sectionFontSize: CHART.axisLabelFontSize,
  sectionFontWeight: TYPOGRAPHY.sectionHeading.weight,
  arrowStrokeWidth: 2,
  arrowHeadSize: 5,
} as const

export function renderTimelineSvg(
  diagram: PositionedTimelineDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // Defs: arrowhead marker + fade-in gradient
  parts.push(
    `<defs>` +
    `<marker id="arrow-head" markerWidth="${TR.arrowHeadSize}" markerHeight="${TR.arrowHeadSize}" ` +
    `refX="${TR.arrowHeadSize}" refY="${TR.arrowHeadSize / 2}" orient="auto">` +
    `<polygon points="0,0 ${TR.arrowHeadSize},${TR.arrowHeadSize / 2} 0,${TR.arrowHeadSize}" ` +
    `fill="var(--_line)"/>` +
    `</marker>` +
    `<linearGradient id="arrow-fade" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0%" stop-color="var(--_line)" stop-opacity="0"/>` +
    `<stop offset="100%" stop-color="var(--_line)" stop-opacity="1"/>` +
    `</linearGradient>` +
    `</defs>`
  )

  // 1. Section header bars
  for (const section of diagram.sections) {
    if (section.name) {
      parts.push(
        `<rect x="${section.bgX}" y="${section.bgY}" width="${section.bgW}" height="${section.bgH}" ` +
        `fill="var(--_group-hdr)" rx="0" ry="0" opacity="0.6"/>`
      )
      parts.push(
        `<text x="${section.labelX}" y="${section.labelY}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
        `font-size="${TR.sectionFontSize}" font-weight="${TR.sectionFontWeight}" ` +
        `fill="var(--_text)">${escapeXml(section.name)}</text>`
      )
    }
  }

  // 2. Central timeline line (no arrowhead, spans first to last box)
  parts.push(
    `<line x1="${diagram.arrow.x1}" y1="${diagram.arrow.y1}" ` +
    `x2="${diagram.arrow.x2}" y2="${diagram.arrow.y2}" ` +
    `stroke="var(--_line)" stroke-width="${TR.arrowStrokeWidth}"/>`
  )

  // 3. Period boxes + labels, 4. Dashed drop connectors, 5. Event cards
  for (const section of diagram.sections) {
    for (const period of section.periods) {
      // Dashed drop connector
      if (period.drop) {
        parts.push(
          `<line x1="${period.drop.x}" y1="${period.drop.y1}" ` +
          `x2="${period.drop.x}" y2="${period.drop.y2}" ` +
          `stroke="var(--_line)" stroke-width="1" stroke-dasharray="4,3" opacity="0.5"/>`
        )
      }

      // Period box
      parts.push(
        `<rect x="${period.boxX}" y="${period.boxY}" width="${period.boxW}" height="${period.boxH}" ` +
        `fill="var(--_node-fill)" stroke="var(--_node-stroke)" stroke-width="0.75" rx="0" ry="0"/>`
      )

      // Period label (centered in box)
      parts.push(
        `<text x="${period.boxX + period.boxW / 2}" y="${period.boxY + period.boxH / 2}" ` +
        `dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
        `font-size="${TR.periodFontSize}" font-weight="${TR.periodFontWeight}" ` +
        `fill="var(--_text)">${escapeXml(period.time)}</text>`
      )

      // Event labels (no boxes, just text)
      for (const event of period.events) {
        parts.push(
          `<text x="${event.x + event.width / 2}" y="${event.y + event.height / 2}" ` +
          `dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
          `font-size="${TR.eventFontSize}" font-weight="${TR.eventFontWeight}" ` +
          `fill="var(--_text-sec)">${escapeXml(event.text)}</text>`
        )
      }
    }
  }

  // 6. Title
  if (diagram.title) {
    parts.push(
      `<text x="${diagram.title.x}" y="${diagram.title.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="middle" ` +
      `font-size="${CHART.titleFontSize}" font-weight="${CHART.titleFontWeight}" ` +
      `fill="var(--_text)">${escapeXml(diagram.title.text)}</text>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

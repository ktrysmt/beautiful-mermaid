import type { PositionedTimelineDiagram } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Timeline diagram SVG renderer
//
// Renders a positioned timeline to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   1. Section backgrounds
//   2. Connecting lines between periods
//   3. Period boxes
//   4. Period labels (inside boxes)
//   5. Event cards
//   6. Event text
//   7. Section labels
//   8. Title
// ============================================================================

const TR = {
  periodFontSize: CHART.labelFontSize,
  periodFontWeight: CHART.labelFontWeight,
  eventFontSize: TYPOGRAPHY.secondaryLabel.size,
  eventFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  sectionFontSize: CHART.axisLabelFontSize,
  sectionFontWeight: TYPOGRAPHY.sectionHeading.weight,
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

  // 1. Section backgrounds
  for (const section of diagram.sections) {
    if (section.name) {
      parts.push(
        `<rect x="${section.bgX}" y="${section.bgY}" width="${section.bgW}" height="${section.bgH}" ` +
        `fill="var(--_group-hdr)" rx="0" ry="0" opacity="0.5"/>`
      )
    }
  }

  // 2. Connecting lines
  for (const conn of diagram.connectors) {
    parts.push(
      `<line x1="${conn.x1}" y1="${conn.y1}" x2="${conn.x2}" y2="${conn.y2}" ` +
      `stroke="var(--_line)" stroke-width="1"/>`
    )
  }

  // 3 & 4. Period boxes + labels
  for (const section of diagram.sections) {
    for (const period of section.periods) {
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

      // 5 & 6. Event cards + text
      for (const event of period.events) {
        parts.push(
          `<rect x="${event.x}" y="${event.y}" width="${event.width}" height="${event.height}" ` +
          `fill="var(--_node-fill)" stroke="var(--_inner-stroke)" stroke-width="0.75" rx="0" ry="0"/>`
        )

        parts.push(
          `<text x="${event.x + event.width / 2}" y="${event.y + event.height / 2}" ` +
          `dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
          `font-size="${TR.eventFontSize}" font-weight="${TR.eventFontWeight}" ` +
          `fill="var(--_text-sec)">${escapeXml(event.text)}</text>`
        )
      }
    }
  }

  // 7. Section labels
  for (const section of diagram.sections) {
    if (section.name) {
      parts.push(
        `<text x="${section.labelX}" y="${section.labelY}" dy="${TEXT_BASELINE_SHIFT}" ` +
        `text-anchor="start" ` +
        `font-size="${TR.sectionFontSize}" font-weight="${TR.sectionFontWeight}" ` +
        `fill="var(--_text-sec)">${escapeXml(section.name)}</text>`
      )
    }
  }

  // 8. Title
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

import type { PositionedGanttChart } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Gantt chart SVG renderer
//
// Renders a positioned gantt chart to SVG.
// All colors use CSS custom properties (var(--_xxx)) from the theme system.
//
// Render order (back to front):
//   1. Section backgrounds (alternating subtle tints)
//   2. Grid lines (vertical at date ticks)
//   3. Task bars (sharp rectangles)
//   4. Milestone diamonds
//   5. Task labels
//   6. Section labels
//   7. Axis tick labels
//   8. Title
// ============================================================================

const GR = {
  taskFontSize: TYPOGRAPHY.secondaryLabel.size,
  taskFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  sectionFontSize: CHART.labelFontSize,
  sectionFontWeight: CHART.labelFontWeight,
  axisLabelFontSize: TYPOGRAPHY.edgeMeta.size,
  axisLabelFontWeight: TYPOGRAPHY.edgeMeta.weight,
  milestoneSize: 8,
} as const

export function renderGanttSvg(
  chart: PositionedGanttChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))

  // 1. Section backgrounds (alternating)
  for (let i = 0; i < chart.sections.length; i++) {
    const section = chart.sections[i]!
    const fill = i % 2 === 0 ? 'var(--_node-fill)' : 'var(--_group-hdr)'
    parts.push(
      `<rect x="${section.bgX}" y="${section.bgY}" width="${section.bgW}" height="${section.bgH}" ` +
      `fill="${fill}" rx="0" ry="0" opacity="0.5"/>`
    )
  }

  // 2. Grid lines
  for (const gl of chart.gridLines) {
    parts.push(
      `<line x1="${gl.x1}" y1="${gl.y1}" x2="${gl.x2}" y2="${gl.y2}" ` +
      `stroke="var(--_inner-stroke)" stroke-width="0.75"/>`
    )
  }

  // 3 & 4. Task bars and milestones
  for (const section of chart.sections) {
    for (const task of section.tasks) {
      if (task.isMilestone) {
        // Diamond
        const cx = task.x
        const cy = task.y + task.height / 2
        const s = GR.milestoneSize
        const fill = task.tags.includes('crit') ? 'var(--_arrow)' : 'var(--_line)'
        parts.push(
          `<path d="M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z" ` +
          `fill="${fill}" stroke="var(--_node-stroke)" stroke-width="0.75"/>`
        )
      } else {
        // Task bar
        let fill = 'var(--_node-fill)'
        let stroke = 'var(--_node-stroke)'
        if (task.tags.includes('active')) {
          fill = 'var(--_arrow)'
          stroke = 'var(--_arrow)'
        } else if (task.tags.includes('done')) {
          fill = 'var(--_line)'
          stroke = 'var(--_line)'
        }
        if (task.tags.includes('crit')) {
          fill = 'var(--_arrow)'
          stroke = 'var(--_arrow)'
        }

        const opacity = task.tags.includes('done') ? '0.5' : '1'
        parts.push(
          `<rect x="${task.x}" y="${task.y}" width="${task.width}" height="${task.height}" ` +
          `fill="${fill}" stroke="${stroke}" stroke-width="0.75" rx="0" ry="0" opacity="${opacity}"/>`
        )
      }

      // 5. Task label
      parts.push(
        `<text x="${task.labelX}" y="${task.labelY}" dy="${TEXT_BASELINE_SHIFT}" ` +
        `text-anchor="${task.labelAnchor}" ` +
        `font-size="${GR.taskFontSize}" font-weight="${GR.taskFontWeight}" ` +
        `fill="var(--_text)">${escapeXml(task.name)}</text>`
      )
    }
  }

  // 6. Section labels
  for (const section of chart.sections) {
    parts.push(
      `<text x="${section.labelX}" y="${section.labelY}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="start" ` +
      `font-size="${GR.sectionFontSize}" font-weight="${GR.sectionFontWeight}" ` +
      `fill="var(--_text-sec)">${escapeXml(section.name)}</text>`
    )
  }

  // 7. Axis tick labels
  for (const tick of chart.axisTicks) {
    parts.push(
      `<text x="${tick.x}" y="${tick.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="middle" ` +
      `font-size="${GR.axisLabelFontSize}" font-weight="${GR.axisLabelFontWeight}" ` +
      `fill="var(--_text-muted)">${escapeXml(tick.label)}</text>`
    )
  }

  // 8. Title
  if (chart.title) {
    parts.push(
      `<text x="${chart.title.x}" y="${chart.title.y}" dy="${TEXT_BASELINE_SHIFT}" ` +
      `text-anchor="middle" ` +
      `font-size="${CHART.titleFontSize}" font-weight="${CHART.titleFontWeight}" ` +
      `fill="var(--_text)">${escapeXml(chart.title.text)}</text>`
    )
  }

  // Today marker
  if (chart.todayLine) {
    parts.push(
      `<line x1="${chart.todayLine.x}" y1="${chart.todayLine.y1}" ` +
      `x2="${chart.todayLine.x}" y2="${chart.todayLine.y2}" ` +
      `stroke="var(--_arrow)" stroke-width="1.5" stroke-dasharray="4 4"/>`
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

import type { PositionedGanttChart, PositionedGanttTask } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { TEXT_BASELINE_SHIFT, estimateTextWidth } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Gantt chart SVG renderer
//
// Compact SVG gantt:
//   - left task labels (ASCII-inspired)
//   - dense timeline bars
//   - stronger grid / row structure
//   - optional hover highlight + tooltip
// ============================================================================

const GR = {
  taskFontSize: TYPOGRAPHY.secondaryLabel.size,
  taskFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  taskLabelWeight: 500,
  sectionFontSize: TYPOGRAPHY.sectionHeading.size,
  sectionFontWeight: TYPOGRAPHY.sectionHeading.weight,
  axisLabelFontSize: TYPOGRAPHY.edgeMeta.size,
  axisLabelFontWeight: TYPOGRAPHY.edgeMeta.weight,
  milestoneSize: 8,
  barRadius: 5,
} as const

const TIP = {
  fontSize: TYPOGRAPHY.tooltipLabel.size,
  fontWeight: TYPOGRAPHY.tooltipLabel.weight,
  rowFontSize: TYPOGRAPHY.secondaryLabel.size,
  rowFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  rowHeight: 18,
  padX: 12,
  padY: 8,
  offsetY: 10,
  rx: 8,
  minY: 4,
  pointerSize: 6,
} as const

export function renderGanttSvg(
  chart: PositionedGanttChart,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false,
  interactive: boolean = false,
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(chart.width, chart.height, colors, transparent).replace('<svg ', '<svg data-gantt-interactive="' + (interactive ? '1' : '0') + '" '))
  parts.push(buildStyleBlock(font, false))
  parts.push(ganttStyles(interactive))

  // 1. Section backgrounds
  for (let i = 0; i < chart.sections.length; i++) {
    const section = chart.sections[i]!
    const cls = i % 2 === 0 ? 'gantt-section-bg gantt-section-bg-a' : 'gantt-section-bg gantt-section-bg-b'
    parts.push(
      `<rect x="${section.bgX}" y="${section.bgY}" width="${section.bgW}" height="${section.bgH}" class="${cls}"/>`
    )
  }

  // 2. Grid + plot framing lines
  for (const gl of chart.gridLines) {
    parts.push(
      `<line x1="${gl.x1}" y1="${gl.y1}" x2="${gl.x2}" y2="${gl.y2}" class="gantt-grid"/>`
    )
  }
  for (const line of chart.rowLines) {
    parts.push(
      `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" class="gantt-row-line"/>`
    )
  }
  parts.push(
    `<line x1="${chart.plotArea.x}" y1="${chart.plotArea.y}" x2="${chart.plotArea.x + chart.plotArea.width}" y2="${chart.plotArea.y}" class="gantt-axis-line"/>`
  )

  // 3. Base tasks
  const overlays: string[] = []
  for (const section of chart.sections) {
    for (const task of section.tasks) {
      parts.push(renderTask(task))
      if (interactive) overlays.push(renderTaskOverlay(task, chart.height))
    }
  }

  // 4. Section labels
  for (const section of chart.sections) {
    parts.push(
      `<text x="${section.labelX}" y="${section.labelY}" dy="${TEXT_BASELINE_SHIFT}" text-anchor="start" ` +
      `font-size="${GR.sectionFontSize}" font-weight="${GR.sectionFontWeight}" class="gantt-section-label">${escapeXml(section.name)}</text>`
    )
  }

  // 5. Axis labels
  for (const tick of chart.axisTicks) {
    parts.push(
      `<text x="${tick.x}" y="${tick.y}" dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
      `font-size="${GR.axisLabelFontSize}" font-weight="${GR.axisLabelFontWeight}" class="gantt-axis-label">${escapeXml(tick.label)}</text>`
    )
  }

  // 6. Title
  if (chart.title) {
    parts.push(
      `<text x="${chart.title.x}" y="${chart.title.y}" dy="${TEXT_BASELINE_SHIFT}" text-anchor="middle" ` +
      `font-size="${CHART.titleFontSize}" font-weight="${CHART.titleFontWeight}" class="gantt-title">${escapeXml(chart.title.text)}</text>`
    )
  }

  // 7. Today marker
  if (chart.todayLine) {
    parts.push(
      `<line x1="${chart.todayLine.x}" y1="${chart.todayLine.y1}" x2="${chart.todayLine.x}" y2="${chart.todayLine.y2}" class="gantt-today-line"/>`
    )
  }

  // 8. Interactive overlay last so tooltips stay on top
  for (const overlay of overlays) parts.push(overlay)

  parts.push('</svg>')
  return parts.join('\n')
}

function ganttStyles(interactive: boolean): string {
  return `<style>
  .gantt-section-bg { rx: 8; ry: 8; }
  .gantt-section-bg-a { fill: color-mix(in srgb, var(--_group-hdr) 78%, transparent); }
  .gantt-section-bg-b { fill: color-mix(in srgb, var(--_node-fill) 84%, transparent); }
  .gantt-grid { stroke: color-mix(in srgb, var(--_text) 26%, transparent); stroke-width: 1; }
  .gantt-row-line { stroke: var(--_inner-stroke); stroke-width: 0.75; }
  .gantt-axis-line { stroke: color-mix(in srgb, var(--_text) 34%, transparent); stroke-width: 1; }
  .gantt-title { fill: var(--_text); }
  .gantt-axis-label { fill: var(--_text-muted); }
  .gantt-section-label { fill: var(--_text-sec); }
  .gantt-row-label { fill: var(--_text); }
  .gantt-bar { stroke-width: 1.5; }
  .gantt-bar-default { stroke: var(--accent, var(--_arrow)); fill: color-mix(in srgb, var(--bg) 68%, var(--accent, var(--_arrow)) 32%); }
  .gantt-bar-done { stroke: var(--_line); fill: color-mix(in srgb, var(--bg) 74%, var(--_line) 26%); }
  .gantt-bar-active { stroke: var(--_arrow); fill: color-mix(in srgb, var(--bg) 56%, var(--_arrow) 44%); }
  .gantt-bar-crit { stroke: var(--_arrow); fill: color-mix(in srgb, var(--bg) 44%, var(--_arrow) 56%); }
  .gantt-milestone { stroke: var(--_node-stroke); stroke-width: 1.5; fill: color-mix(in srgb, var(--bg) 48%, var(--accent, var(--_arrow)) 52%); }
  .gantt-milestone-crit { fill: var(--_arrow); }
  .gantt-today-line { stroke: var(--_arrow); stroke-width: 1.5; stroke-dasharray: 4 4; opacity: 0.9; }
  .gantt-hover { opacity: 0; pointer-events: none; }
  ${interactive ? `
  .gantt-hit { fill: transparent; }
  .gantt-tip { opacity: 0; pointer-events: none; }
  .gantt-tip-bg { fill: var(--_text); filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--fg) 20%, transparent)); }
  .gantt-tip-ptr { fill: var(--_text); }
  .gantt-tip-title { fill: var(--bg); font-size: ${TIP.fontSize}px; font-weight: 600; }
  .gantt-tip-label, .gantt-tip-value { fill: var(--bg); font-size: ${TIP.rowFontSize}px; font-weight: ${TIP.rowFontWeight}; }
  .gantt-hit-group:hover .gantt-tip,
  .gantt-hit-group:hover .gantt-hover { opacity: 1; }
  ` : ''}
</style>`
}

function renderTask(task: PositionedGanttTask): string {
  const parts: string[] = []

  parts.push(
    `<text x="${task.rowLabelX}" y="${task.rowLabelY}" dy="${TEXT_BASELINE_SHIFT}" text-anchor="start" ` +
    `font-size="${GR.taskFontSize}" font-weight="${GR.taskLabelWeight}" class="gantt-row-label">${escapeXml(task.rowLabel)}</text>`
  )

  if (task.isMilestone) {
    parts.push(renderMilestone(task, 'gantt-milestone'))
  } else {
    parts.push(
      `<rect x="${task.x}" y="${task.y}" width="${task.width}" height="${task.height}" rx="${GR.barRadius}" ry="${GR.barRadius}" ` +
      `class="gantt-bar ${barVariantClass(task)}"/>`
    )
  }

  return parts.join('')
}

function renderTaskOverlay(task: PositionedGanttTask, chartHeight: number): string {
  const parts: string[] = []
  const tip = ganttTooltip(task, chartHeight)
  const titleText = compactTitle(task)

  parts.push(`<g class="gantt-hit-group">`)

  if (task.isMilestone) {
    const hitSize = Math.max(18, GR.milestoneSize * 2 + 6)
    parts.push(
      `<rect x="${r(task.x - hitSize / 2)}" y="${r(task.rowY)}" width="${r(hitSize)}" height="${r(task.rowH)}" class="gantt-hit"/>`
    )
    parts.push(renderMilestone(task, task.tags.includes('crit') ? 'gantt-hover gantt-milestone gantt-milestone-crit' : 'gantt-hover gantt-milestone'))
  } else {
    const minHitW = 14
    const hitX = task.x - 4
    const hitW = Math.max(minHitW, task.width + 8)
    parts.push(
      `<rect x="${r(hitX)}" y="${r(task.rowY)}" width="${r(hitW)}" height="${r(task.rowH)}" class="gantt-hit"/>`
    )
    parts.push(
      `<rect x="${r(task.x - 1)}" y="${r(task.y - 1)}" width="${r(task.width + 2)}" height="${r(task.height + 2)}" ` +
      `rx="${GR.barRadius + 1}" ry="${GR.barRadius + 1}" class="gantt-hover ${barVariantClass(task)}"/>`
    )
  }

  parts.push(`<title>${escapeXml(titleText)}</title>`)
  parts.push(tip)
  parts.push(`</g>`)
  return parts.join('')
}

function renderMilestone(task: PositionedGanttTask, className: string): string {
  const cx = task.x
  const cy = task.y + task.height / 2
  const s = GR.milestoneSize
  const crit = task.tags.includes('crit') ? ' gantt-milestone-crit' : ''
  return `<path d="M${r(cx)},${r(cy - s)} L${r(cx + s)},${r(cy)} L${r(cx)},${r(cy + s)} L${r(cx - s)},${r(cy)} Z" class="${className}${crit}"/>`
}

function ganttTooltip(task: PositionedGanttTask, chartHeight: number): string {
  const rows = [
    { label: 'Section', value: task.sectionName },
    ...(task.startLabel ? [{ label: 'Start', value: task.startLabel }] : []),
    ...(task.endLabel ? [{ label: 'End', value: task.endLabel }] : []),
    ...(task.durationLabel ? [{ label: 'Duration', value: task.durationLabel }] : []),
    ...(task.tags.length > 0 ? [{ label: 'Tags', value: task.tags.join(', ') }] : []),
  ]

  const titleW = estimateTextWidth(task.tooltipLabel, TIP.fontSize, 600)
  const rowLabelW = Math.max(...rows.map(row => estimateTextWidth(row.label, TIP.rowFontSize, TIP.rowFontWeight)), 0)
  const rowValueW = Math.max(...rows.map(row => estimateTextWidth(row.value, TIP.rowFontSize, TIP.rowFontWeight)), 0)
  const contentW = Math.max(titleW, rowLabelW + 16 + rowValueW)
  const bgW = contentW + TIP.padX * 2
  const bgH = TIP.padY * 2 + TIP.rowHeight * (1 + rows.length)

  const cx = task.isMilestone ? task.x : task.x + task.width / 2
  let tipY = Math.max(TIP.minY, task.y - TIP.offsetY - bgH - TIP.pointerSize)
  if (tipY + bgH + TIP.pointerSize > chartHeight - 4) {
    tipY = Math.max(TIP.minY, chartHeight - bgH - TIP.pointerSize - 4)
  }
  const bgX = cx - bgW / 2
  const pointerY = tipY + bgH
  const ps = TIP.pointerSize

  let svg = `<g class="gantt-tip">`
  svg += `<rect x="${r(bgX)}" y="${r(tipY)}" width="${r(bgW)}" height="${r(bgH)}" rx="${TIP.rx}" class="gantt-tip-bg"/>`
  svg += `<polygon points="${r(cx - ps)},${r(pointerY)} ${r(cx + ps)},${r(pointerY)} ${r(cx)},${r(pointerY + ps)}" class="gantt-tip-ptr"/>`

  let textY = tipY + TIP.padY + TIP.rowHeight / 2
  svg += `<text x="${r(cx)}" y="${r(textY)}" text-anchor="middle" dy="${TEXT_BASELINE_SHIFT}" class="gantt-tip-title">${escapeXml(task.tooltipLabel)}</text>`

  const leftX = bgX + TIP.padX
  const rightX = bgX + bgW - TIP.padX
  for (const row of rows) {
    textY += TIP.rowHeight
    svg += `<text x="${r(leftX)}" y="${r(textY)}" text-anchor="start" dy="${TEXT_BASELINE_SHIFT}" class="gantt-tip-label">${escapeXml(row.label)}</text>`
    svg += `<text x="${r(rightX)}" y="${r(textY)}" text-anchor="end" dy="${TEXT_BASELINE_SHIFT}" class="gantt-tip-value">${escapeXml(row.value)}</text>`
  }

  svg += `</g>`
  return svg
}

function barVariantClass(task: PositionedGanttTask): string {
  if (task.tags.includes('crit')) return 'gantt-bar-crit'
  if (task.tags.includes('active')) return 'gantt-bar-active'
  if (task.tags.includes('done')) return 'gantt-bar-done'
  return 'gantt-bar-default'
}

function compactTitle(task: PositionedGanttTask): string {
  const parts = [task.name]
  if (task.sectionName) parts.push(`Section: ${task.sectionName}`)
  if (task.startLabel) parts.push(`Start: ${task.startLabel}`)
  if (task.endLabel) parts.push(`End: ${task.endLabel}`)
  if (task.durationLabel) parts.push(`Duration: ${task.durationLabel}`)
  if (task.tags.length > 0) parts.push(`Tags: ${task.tags.join(', ')}`)
  return parts.join(' · ')
}

function r(n: number): string {
  return String(Math.round(n * 10) / 10)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

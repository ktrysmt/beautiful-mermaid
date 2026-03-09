import type {
  GanttChart, PositionedGanttChart, PositionedGanttSection, PositionedGanttTask,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { CHART_SIZES, TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Gantt chart layout engine
//
// Custom coordinate layout: time axis horizontal, tasks stacked vertically,
// grouped by section. No ELK needed.
// ============================================================================

const GA = {
  padding: CHART.padding,
  titleFontSize: CHART.titleFontSize,
  titleFontWeight: CHART.titleFontWeight,
  titleHeight: CHART.titleHeight,
  axisLabelFontSize: TYPOGRAPHY.edgeMeta.size,
  axisLabelFontWeight: TYPOGRAPHY.edgeMeta.weight,
  sectionFontSize: CHART.labelFontSize,
  sectionFontWeight: CHART.labelFontWeight,
  taskFontSize: TYPOGRAPHY.secondaryLabel.size,
  taskFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  /** Left column width for section labels */
  labelColWidth: 120,
  /** Plot area width for the timeline */
  plotWidth: CHART_SIZES.gantt.plotWidth,
  /** Height per task row */
  taskRowHeight: 32,
  /** Task bar height (within row) */
  taskBarHeight: 22,
  /** Section header row height */
  sectionHeaderHeight: 28,
  /** Axis row height */
  axisHeight: 28,
  /** Milestone diamond size */
  milestoneSize: 12,
} as const

export function layoutGanttChart(
  chart: GanttChart,
  _options: RenderOptions = {},
): PositionedGanttChart {
  const hasTitle = !!chart.title

  // Compute global date range
  const allTasks = chart.sections.flatMap(s => s.tasks)
  const { minDate, maxDate } = computeDateRange(allTasks)

  // Fallback if no valid dates
  const startMs = minDate.getTime()
  const endMs = maxDate.getTime()
  const rangeMs = endMs - startMs || 1

  // Label column: measure section name widths
  const maxLabelW = Math.max(
    GA.labelColWidth,
    ...chart.sections.map(s =>
      estimateTextWidth(s.name, GA.sectionFontSize, GA.sectionFontWeight) + 16
    )
  )

  const plotLeft = GA.padding + maxLabelW
  const plotWidth = GA.plotWidth
  const plotRight = plotLeft + plotWidth

  // Date-to-pixel scale
  const dateToX = (d: Date) => plotLeft + ((d.getTime() - startMs) / rangeMs) * plotWidth

  // Layout vertical positions
  let cursorY = GA.padding + (hasTitle ? GA.titleHeight : 0) + GA.axisHeight
  const sections: PositionedGanttSection[] = []

  for (const section of chart.sections) {
    const sectionStartY = cursorY
    const tasks: PositionedGanttTask[] = []

    for (const task of section.tasks) {
      const isMilestone = task.tags.includes('milestone')
      const taskStart = task.startDate ?? minDate
      const taskEnd = task.endDate ?? (isMilestone ? taskStart : maxDate)

      const barX = dateToX(taskStart)
      const barEndX = dateToX(taskEnd)
      const barW = Math.max(isMilestone ? 0 : 2, barEndX - barX)
      const barY = cursorY + (GA.taskRowHeight - GA.taskBarHeight) / 2

      tasks.push({
        name: task.name,
        tags: task.tags,
        x: barX,
        y: barY,
        width: barW,
        height: GA.taskBarHeight,
        labelX: isMilestone ? barX + GA.milestoneSize + 6 : barX + barW + 8,
        labelY: cursorY + GA.taskRowHeight / 2,
        labelAnchor: 'start',
        isMilestone,
      })

      cursorY += GA.taskRowHeight
    }

    const sectionH = cursorY - sectionStartY

    sections.push({
      name: section.name,
      labelX: GA.padding + 8,
      labelY: sectionStartY + sectionH / 2,
      bgX: GA.padding,
      bgY: sectionStartY,
      bgW: plotRight - GA.padding,
      bgH: sectionH,
      tasks,
    })
  }

  const totalW = plotRight + GA.padding
  const totalH = cursorY + GA.padding

  // Time axis ticks
  const axisTicks = computeAxisTicks(minDate, maxDate, dateToX)
  const axisY = GA.padding + (hasTitle ? GA.titleHeight : 0)

  // Grid lines at tick positions
  const gridLines = axisTicks.map(t => ({
    x1: t.x,
    y1: axisY + GA.axisHeight,
    x2: t.x,
    y2: cursorY,
  }))

  const title = hasTitle
    ? { text: chart.title!, x: totalW / 2, y: GA.padding + GA.titleFontSize }
    : undefined

  return {
    width: totalW,
    height: totalH,
    title,
    axisTicks: axisTicks.map(t => ({ ...t, y: axisY + GA.axisHeight - 6 })),
    gridLines,
    sections,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function computeDateRange(tasks: GanttChart['sections'][0]['tasks']): { minDate: Date; maxDate: Date } {
  let min = Infinity
  let max = -Infinity

  for (const task of tasks) {
    if (task.startDate) {
      min = Math.min(min, task.startDate.getTime())
      max = Math.max(max, task.startDate.getTime())
    }
    if (task.endDate) {
      min = Math.min(min, task.endDate.getTime())
      max = Math.max(max, task.endDate.getTime())
    }
  }

  if (!isFinite(min)) {
    const now = new Date()
    return { minDate: now, maxDate: new Date(now.getTime() + 30 * 86400000) }
  }

  // Add 5% padding
  const range = max - min || 86400000
  return {
    minDate: new Date(min - range * 0.02),
    maxDate: new Date(max + range * 0.02),
  }
}

function computeAxisTicks(
  minDate: Date,
  maxDate: Date,
  dateToX: (d: Date) => number,
): { label: string; x: number }[] {
  const rangeMs = maxDate.getTime() - minDate.getTime()
  const DAY = 86400000
  const WEEK = 7 * DAY
  const MONTH = 30 * DAY

  // Choose tick interval based on range
  let interval: number
  let formatter: (d: Date) => string

  if (rangeMs <= 14 * DAY) {
    interval = DAY
    formatter = d => `${d.getMonth() + 1}/${d.getDate()}`
  } else if (rangeMs <= 90 * DAY) {
    interval = WEEK
    formatter = d => `${d.getMonth() + 1}/${d.getDate()}`
  } else if (rangeMs <= 365 * DAY) {
    interval = MONTH
    formatter = d => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return months[d.getMonth()]!
    }
  } else {
    interval = 3 * MONTH
    formatter = d => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${months[d.getMonth()]!} ${d.getFullYear()}`
    }
  }

  const ticks: { label: string; x: number }[] = []
  let t = new Date(Math.ceil(minDate.getTime() / interval) * interval)

  while (t.getTime() <= maxDate.getTime()) {
    ticks.push({
      label: formatter(t),
      x: dateToX(t),
    })
    t = new Date(t.getTime() + interval)
  }

  return ticks
}

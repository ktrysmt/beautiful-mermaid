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
// Compact, ASCII-inspired coordinate layout:
//   - section labels in a left column
//   - task labels in a left row-label column
//   - dense timeline plot on the right
//   - subtle row separators and section banding
// ============================================================================

const GA = {
  padding: CHART.padding,
  titleFontSize: CHART.titleFontSize,
  titleFontWeight: CHART.titleFontWeight,
  titleHeight: CHART.titleHeight,
  axisLabelFontSize: TYPOGRAPHY.edgeMeta.size,
  axisLabelFontWeight: TYPOGRAPHY.edgeMeta.weight,
  sectionFontSize: TYPOGRAPHY.sectionHeading.size,
  sectionFontWeight: TYPOGRAPHY.sectionHeading.weight,
  taskFontSize: TYPOGRAPHY.secondaryLabel.size,
  taskFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  sectionLabelColMin: 82,
  sectionLabelColMax: 124,
  taskLabelColMin: 118,
  taskLabelColMax: 208,
  labelGap: 12,
  plotWidth: CHART_SIZES.gantt.plotWidth,
  taskRowHeight: 24,
  taskBarHeight: 16,
  sectionHeaderHeight: 26,
  axisHeight: 28,
  milestoneSize: 8,
} as const

export function layoutGanttChart(
  chart: GanttChart,
  _options: RenderOptions = {},
): PositionedGanttChart {
  const hasTitle = !!chart.title

  const allTasks = chart.sections.flatMap(s => s.tasks)
  const { minDate, maxDate } = computeDateRange(allTasks)
  const startMs = minDate.getTime()
  const endMs = maxDate.getTime()
  const rangeMs = endMs - startMs || 1

  const sectionLabelColWidth = clamp(
    Math.max(...chart.sections.map(s => estimateTextWidth(s.name, GA.sectionFontSize, GA.sectionFontWeight) + 16), GA.sectionLabelColMin),
    GA.sectionLabelColMin,
    GA.sectionLabelColMax,
  )
  const taskLabelColWidth = clamp(
    Math.max(...allTasks.map(t => estimateTextWidth(t.name, GA.taskFontSize, GA.taskFontWeight) + 18), GA.taskLabelColMin),
    GA.taskLabelColMin,
    GA.taskLabelColMax,
  )

  const plotLeft = GA.padding + sectionLabelColWidth + taskLabelColWidth + GA.labelGap
  const plotWidth = GA.plotWidth
  const plotRight = plotLeft + plotWidth

  const dateToX = (d: Date) => plotLeft + ((d.getTime() - startMs) / rangeMs) * plotWidth

  const topY = GA.padding + (hasTitle ? GA.titleHeight : 0)
  const axisY = topY
  const plotTop = axisY + GA.axisHeight

  let cursorY = plotTop
  const sections: PositionedGanttSection[] = []
  const rowLines: PositionedGanttChart['rowLines'] = []

  for (const section of chart.sections) {
    const sectionStartY = cursorY
    cursorY += GA.sectionHeaderHeight

    const tasks: PositionedGanttTask[] = []

    for (const task of section.tasks) {
      const rowY = cursorY
      const isMilestone = task.tags.includes('milestone')
      const taskStart = task.startDate ?? minDate
      const taskEnd = task.endDate ?? (isMilestone ? taskStart : maxDate)
      const barX = dateToX(taskStart)
      const barEndX = dateToX(taskEnd)
      const barW = Math.max(isMilestone ? 0 : 4, barEndX - barX)
      const barY = rowY + (GA.taskRowHeight - GA.taskBarHeight) / 2
      const rowLabel = ellipsize(task.name, taskLabelColWidth - 12, GA.taskFontSize, GA.taskFontWeight)

      tasks.push({
        name: task.name,
        sectionName: section.name,
        tags: task.tags,
        x: barX,
        y: barY,
        width: barW,
        height: GA.taskBarHeight,
        rowX: plotLeft,
        rowY,
        rowW: plotWidth,
        rowH: GA.taskRowHeight,
        rowLabel,
        rowLabelX: GA.padding + sectionLabelColWidth + 6,
        rowLabelY: rowY + GA.taskRowHeight / 2,
        isMilestone,
        startLabel: task.startDate ? formatDate(task.startDate) : undefined,
        endLabel: task.endDate ? formatDate(task.endDate) : undefined,
        durationLabel: task.duration,
        tooltipLabel: task.name,
      })

      cursorY += GA.taskRowHeight
      rowLines.push({
        x1: plotLeft,
        y1: cursorY,
        x2: plotRight,
        y2: cursorY,
      })
    }

    sections.push({
      name: section.name,
      labelX: GA.padding + 4,
      labelY: sectionStartY + GA.sectionHeaderHeight / 2,
      bgX: GA.padding,
      bgY: sectionStartY,
      bgW: plotRight - GA.padding,
      bgH: cursorY - sectionStartY,
      tasks,
    })
  }

  const totalW = plotRight + GA.padding
  const totalH = cursorY + GA.padding
  const axisTicks = computeAxisTicks(minDate, maxDate, dateToX, chart.axisFormat)
  const gridLines = axisTicks.map(t => ({
    x1: t.x,
    y1: plotTop,
    x2: t.x,
    y2: cursorY,
  }))

  const title = hasTitle
    ? { text: chart.title!, x: totalW / 2, y: GA.padding + GA.titleFontSize }
    : undefined

  const now = new Date()
  const todayMs = now.getTime()
  const todayLine = todayMs >= startMs && todayMs <= endMs
    ? {
        x: dateToX(now),
        y1: plotTop,
        y2: cursorY,
      }
    : undefined

  return {
    width: totalW,
    height: totalH,
    title,
    axisTicks: axisTicks.map(t => ({ ...t, y: axisY + GA.axisHeight - 6 })),
    gridLines,
    rowLines,
    plotArea: { x: plotLeft, y: plotTop, width: plotWidth, height: cursorY - plotTop },
    sections,
    todayLine,
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
  axisFormat?: string,
): { label: string; x: number }[] {
  const DAY = 86400000
  const rangeMs = maxDate.getTime() - minDate.getTime()
  const ticks: { label: string; x: number }[] = []

  let current: Date
  let advance: (d: Date) => Date
  let defaultFormat: string

  if (rangeMs <= 14 * DAY) {
    current = startOfDay(minDate)
    current.setDate(current.getDate() + 1)
    advance = d => addDays(d, 1)
    defaultFormat = 'MM/DD'
  } else if (rangeMs <= 90 * DAY) {
    current = startOfWeek(minDate)
    current = addDays(current, 7)
    advance = d => addDays(d, 7)
    defaultFormat = 'MM/DD'
  } else if (rangeMs <= 365 * DAY) {
    current = startOfMonth(minDate)
    current = addMonths(current, 1)
    advance = d => addMonths(d, 1)
    defaultFormat = 'MMM'
  } else {
    current = startOfQuarter(minDate)
    current = addMonths(current, 3)
    advance = d => addMonths(d, 3)
    defaultFormat = 'MMM YYYY'
  }

  while (current.getTime() <= maxDate.getTime()) {
    ticks.push({
      label: formatDateToken(current, axisFormat ?? defaultFormat),
      x: dateToX(current),
    })
    current = advance(current)
  }

  return ticks
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatDateToken(d: Date, format: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MMM/g, months[d.getMonth()]!)
    .replace(/MM/g, pad2(d.getMonth() + 1))
    .replace(/DD/g, pad2(d.getDate()))
}

function ellipsize(text: string, maxWidth: number, fontSize: number, fontWeight: number): string {
  if (estimateTextWidth(text, fontSize, fontWeight) <= maxWidth) return text
  let low = 0
  let high = text.length
  let best = '…'
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = `${text.slice(0, mid).trimEnd()}…`
    if (estimateTextWidth(candidate, fontSize, fontWeight) <= maxWidth) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function startOfDay(d: Date): Date {
  const next = new Date(d)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfWeek(d: Date): Date {
  const next = startOfDay(d)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  return next
}

function startOfMonth(d: Date): Date {
  const next = startOfDay(d)
  next.setDate(1)
  return next
}

function startOfQuarter(d: Date): Date {
  const next = startOfMonth(d)
  next.setMonth(Math.floor(next.getMonth() / 3) * 3)
  return next
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  next.setMonth(next.getMonth() + months)
  return next
}
